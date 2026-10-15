# -*- coding: utf-8 -*-
"""Data-contract validator for PRIVACY//TERMINAL.

Checks that every pure-privacy asset in data/tiers.json has a CoinGecko id,
a detail dossier, and complete DNA gene flags; validates gene ranges, the
nst/hst rule and the DNA score band (0-100). Exit code 0 = all good.

Usage:  python validate.py
"""
import json
import pathlib
import shutil
import subprocess
import sys

D = pathlib.Path(__file__).parent / 'data'
ID_LOCK = {'ZKP': 'zkpass'}  # symbols shared by two coins -> DNA belongs to this id only


def unwrap(v):
    """A gene is either a bare number (v1) or an evidence object {v, conf, src, asof} (v2)."""
    if isinstance(v, dict):
        return v.get('v')
    return v


def load(name, default=None):
    p = D / name
    if not p.exists():
        return default
    return json.loads(p.read_text(encoding='utf-8'))


def main():
    tiers = load('tiers.json', {})
    ids_raw = load('ids.json', [])
    dna3 = load('dna3.json', {})
    curation = load('curation.json', {})

    syms = tiers.get('t1') if isinstance(tiers, dict) else tiers
    if not syms:
        print('FATAL: tiers.json has no t1 list')
        return 1

    # ids.json is a list of [symbol, coingecko_id] pairs
    ids = {}
    if isinstance(ids_raw, dict):
        ids = dict(ids_raw)
    else:
        for row in ids_raw:
            if isinstance(row, (list, tuple)) and len(row) >= 2:
                ids[str(row[0]).upper()] = row[1]

    errs = []
    warns = []
    scores = {}

    for s in syms:
        s = str(s).upper()
        cid = ids.get(s)
        if not cid:
            errs.append('%s: missing CoinGecko id in ids.json' % s)
            continue
        if not (D / 'detail' / ('%s.json' % cid)).exists():
            errs.append('%s: missing data/detail/%s.json' % (s, cid))

        g = dna3.get(s)
        if not g:
            errs.append('%s: missing gene flags in dna3.json' % s)
            continue
        if s not in curation:
            warns.append('%s: no entry in curation.json' % s)

        for k in ('hs', 'hr', 'ha', 'hst', 'hmeta', 'hnet', 'mat', 'pq'):
            v = unwrap(g.get(k))
            if v is not None and v not in (0, 1, 2):
                errs.append('%s: %s=%r must be 0, 1 or 2 (ternary)' % (s, k, v))
        for k in ('nst', 'brk'):
            v = unwrap(g.get(k))
            if v is not None and v not in (0, 1):
                errs.append('%s: %s=%r must be 0 or 1 (binary)' % (s, k, v))
        mv = unwrap(g.get('man'))
        if mv is not None and mv not in (0, 0.5, 1):
            errs.append('%s: man=%r must be 0, 0.5 or 1' % (s, mv))
        tv = unwrap(g.get('tl'))
        if tv is not None and tv not in (0, 1, 2):
            errs.append('%s: tl=%r must be 0, 1 or 2' % (s, tv))
        av = unwrap(g.get('aset'))
        if av is not None and (not isinstance(av, (int, float)) or av < 0):
            errs.append('%s: aset=%r must be a non-negative number' % (s, av))
        if unwrap(g.get('nst')) and unwrap(g.get('hst')):
            errs.append('%s: nst=1 but hst=%r (state gene must be off)' % (s, g.get('hst')))
        if g.get('g') not in ('coin', 'proto', 'net', 'compute'):
            errs.append('%s: group %r not in coin|proto|net|compute' % (s, g.get('g')))
        if not g.get('yr'):
            warns.append('%s: no mainnet year (yr)' % s)
        if not g.get('hist') and g.get('g') == 'coin':
            warns.append('%s: pure currency coin without an event timeline (hist)' % s)

        # scores come from engine/score.js only (never re-implemented here)

    # reverse check: DNA entries that are not in the pure list
    for s in dna3:
        if s not in [str(x).upper() for x in syms]:
            warns.append('%s: has gene flags in dna3.json but is not in tiers.t1' % s)

    # ---- v3: curated evidence schema (gene value may be {v, conf, src, asof}) ----
    schema = load('schema/curated.schema.json', {})
    v2_ok = 0
    v2_missing_src = 0
    for s_ in syms:
        s_ = str(s_).upper()
        g = dna3.get(s_) or {}
        for k, v in g.items():
            if isinstance(v, dict) and 'v' in v:
                if not v.get('src'):
                    v2_missing_src += 1
                    warns.append('%s.%s: evidence object without src -> treated as conf=low' % (s_, k))
                if v.get('conf') not in (None, 'high', 'med', 'low'):
                    errs.append('%s.%s: bad conf %r' % (s_, k, v.get('conf')))
                v2_ok += 1
    bare = 0
    for s_ in syms:
        g = dna3.get(str(s_).upper()) or {}
        for k, v in g.items():
            if k in ('hs', 'hr', 'ha', 'hst', 'man', 'tl', 'hmeta', 'hnet', 'mat', 'pq', 'aset', 'brk', 'nst') and not isinstance(v, dict):
                bare += 1
    ev_total = v2_ok + bare
    ev_pct = (100.0 * v2_ok / ev_total) if ev_total else 0.0
    print('evidence: %d/%d gene values carry src (%.0f%%) | bare numbers %d | missing src %d' % (
        v2_ok, ev_total, ev_pct, bare, v2_missing_src))
    if ev_pct < 80:
        warns.append('evidence coverage %.0f%% < 80%% — v2 stays PREVIEW until Phase 2 fills the genes' % ev_pct)
    if not schema:
        warns.append('data/schema/curated.schema.json is missing (v3 curated schema)')

    # ---- v3: scores are computed by engine/score.js only (never re-implemented here) ----
    node = shutil.which('node')
    v2_scores = {}
    if node:
        script = (
            "const fs=require('fs');"
            "const dna=JSON.parse(fs.readFileSync('data/dna3.json','utf8'));"
            "eval(fs.readFileSync('engine/score.js','utf8'));"
            "const o={};for(const k in dna){const p=scoreP(dna[k]);o[k]={v1:scoreV1(dna[k]),v2:p?p.P:null,band:p?p.band:null,conf:p?p.conf:null};}"
            "process.stdout.write(JSON.stringify(o));"
        )
        try:
            r = subprocess.run([node, '-e', script], capture_output=True, text=True, timeout=60)
            if r.returncode == 0 and r.stdout.strip():
                v2_scores = json.loads(r.stdout)
            else:
                warns.append('engine/score.js run failed: %s' % (r.stderr.strip()[:120]))
        except Exception as e:
            warns.append('engine/score.js not runnable: %s' % e)
    else:
        warns.append('node not found — v2 scores not checked')

    for s_, sc in v2_scores.items():
        if sc.get('v2') is None:
            errs.append('%s: engine returned no v2 score' % s_)
        elif not 0 <= sc['v2'] <= 100:
            errs.append('%s: v2 score %s outside 0-100' % (s_, sc['v2']))

    print('checked %d pure-privacy assets' % len(syms))
    v1s = [x['v1'] for x in v2_scores.values() if x.get('v1') is not None]
    if v1s:
        ranked = sorted([(k, v['v1']) for k, v in v2_scores.items() if v.get('v1') is not None],
                        key=lambda kv: -kv[1])
        print('v1 score range: %d..%d  |  A+ (>=85): %d  |  median: %d' % (
            min(v1s), max(v1s), sum(1 for v in v1s if v >= 85), sorted(v1s)[len(v1s) // 2]))
        print('top 5 (v1, the ranking score): ' + ', '.join('%s=%d' % kv for kv in ranked[:5]))
    for w in warns:
        print('  ! %s' % w)
    for e in errs:
        print('  x %s' % e)
    if v2_scores:
        v2 = [x['v2'] for x in v2_scores.values() if x.get('v2') is not None]
        if v2:
            print('DNA v2 (engine/score.js, PREVIEW): band %d..%d | median %d' % (
                min(v2), max(v2), sorted(v2)[len(v2) // 2]))
    print('RESULT: %d error(s), %d warning(s)' % (len(errs), len(warns)))
    return 1 if errs else 0


if __name__ == '__main__':
    sys.exit(main())
