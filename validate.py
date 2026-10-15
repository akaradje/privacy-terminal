# -*- coding: utf-8 -*-
"""Data-contract validator for PRIVACY//TERMINAL.

Checks that every pure-privacy asset in data/tiers.json has a CoinGecko id,
a detail dossier, and complete DNA gene flags; validates gene ranges, the
nst/hst rule and the DNA score band (0-100). Exit code 0 = all good.

Usage:  python validate.py
"""
import json
import pathlib
import sys

D = pathlib.Path(__file__).parent / 'data'
ID_LOCK = {'ZKP': 'zkpass'}  # symbols shared by two coins -> DNA belongs to this id only


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

        for k in ('hs', 'hr', 'ha', 'hst'):
            v = g.get(k, 0)
            if v not in (0, 1, 2):
                errs.append('%s: %s=%r must be 0, 1 or 2 (ternary)' % (s, k, v))
        for k in ('man', 'tl', 'big', 'nst'):
            v = g.get(k, 0)
            if v not in (0, 1):
                errs.append('%s: %s=%r must be 0 or 1 (binary)' % (s, k, v))
        if g.get('nst') and g.get('hst'):
            errs.append('%s: nst=1 but hst=%r (state gene must be off)' % (s, g.get('hst')))
        if g.get('g') not in ('coin', 'proto', 'net', 'compute'):
            errs.append('%s: group %r not in coin|proto|net|compute' % (s, g.get('g')))
        if not g.get('yr'):
            warns.append('%s: no mainnet year (yr)' % s)
        if not g.get('hist') and g.get('g') == 'coin':
            warns.append('%s: pure currency coin without an event timeline (hist)' % s)

        denom = 8 - (2 if g.get('nst') else 0)
        cov = min((g.get('hs', 0) + g.get('hr', 0) + g.get('ha', 0) + g.get('hst', 0)) / float(denom), 1.0)
        score = round(cov * 60 + g.get('man', 0) * 15 + g.get('tl', 0) * 15 + g.get('big', 0) * 10)
        scores[s] = score
        if not 0 <= score <= 100:
            errs.append('%s: DNA score %s outside 0-100' % (s, score))

    # reverse check: DNA entries that are not in the pure list
    for s in dna3:
        if s not in [str(x).upper() for x in syms]:
            warns.append('%s: has gene flags in dna3.json but is not in tiers.t1' % s)

    print('checked %d pure-privacy assets' % len(syms))
    if scores:
        ranked = sorted(scores.items(), key=lambda kv: -kv[1])
        print('score band: %d..%d  |  A+ (>=85): %d  |  median: %d' % (
            min(scores.values()), max(scores.values()),
            sum(1 for v in scores.values() if v >= 85),
            sorted(scores.values())[len(scores) // 2]))
        print('top 5: ' + ', '.join('%s=%d' % kv for kv in ranked[:5]))
    for w in warns:
        print('  ! %s' % w)
    for e in errs:
        print('  x %s' % e)
    print('RESULT: %d error(s), %d warning(s)' % (len(errs), len(warns)))
    return 1 if errs else 0


if __name__ == '__main__':
    sys.exit(main())
