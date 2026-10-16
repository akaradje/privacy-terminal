# -*- coding: utf-8 -*-
"""Daily history snapshot: history/YYYY-MM-DD.json.gz

One compact record per asset per day (price, mcap, v1 score, v2 score + coverage),
so rankings and scores can be compared over time. Scores come from engine/score.js
via node — the formula is never duplicated here.
"""
import datetime
import gzip
import json
import os
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'
HIST = ROOT / 'history'



def _asof():
    """Snapshot date, so pillar D is diffable: the same data always yields the same score."""
    day = subprocess.run(['date', '-u', '+%Y-%m-%d'], capture_output=True, text=True).stdout.strip()
    if not day:
        day = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
    return day
    return day


def main():
    node = shutil.which('node')
    if not node:
        print('node not found — cannot score without engine/score.js', file=sys.stderr)
        return 1

    # Score with the engine itself — all six pillars plus the composite, so a divergence
    # chart (score vs price) can be plotted later without recomputing anything retroactively.
    script = (
        "const fs=require('fs'),p=require('path'),R=process.argv[1],ASOF=process.argv[2];"
        "const dna=JSON.parse(fs.readFileSync(p.join(R,'data/dna3.json'),'utf8'));"
        "eval(fs.readFileSync(p.join(R,'engine/score.js'),'utf8'));"
        "eval(fs.readFileSync(p.join(R,'engine/flags.js'),'utf8'));"
        "const ids={};for(const row of JSON.parse(fs.readFileSync(p.join(R,'data/ids.json'),'utf8')))"
        "  ids[String(row[0]).toUpperCase()]=row[1];"
        "const mkt={};for(const f of fs.readdirSync(p.join(R,'data'))){"
        "  if(!/^cat_.*_p\d+\.json$/.test(f))continue;"
        "  try{for(const c of JSON.parse(fs.readFileSync(p.join(R,'data',f),'utf8'))){"
        "    mkt[String(c.symbol).toUpperCase()]={m:c.market_cap,v:c.total_volume,"
        "    cs:c.circulating_supply,ms:c.max_supply,mi:(c.market_cap?0:1)};}}catch(e){}}"
        "const o={};for(const k in dna){"
        "  let det=null;try{const cid=ids[k];if(cid)"
        "    det=JSON.parse(fs.readFileSync(p.join(R,'data/detail',cid+'.json'),'utf8'));}catch(e){}"
        "  const coin=mkt[k]||null;const pl=pillarsOf(dna[k],coin,det,ASOF);const p2=scoreP(dna[k]);"
        "  let comp=null;try{comp=compositeOf(dna[k],coin,det,ASOF,'privacy_investor',true);}catch(e){}"
        "  o[k]={P:pl.P,D:pl.D,L:pl.L,T:pl.T,S:pl.S,R:pl.R,comp:comp,"
        "  v1:scoreV1(dna[k]),v2:p2?p2.P:null,band:p2?p2.band:null,cov:p2?p2.coverage:null,"
        "  ins:p2?p2.insufficient:null};}"
        "process.stdout.write(JSON.stringify(o));"
    )
    r = subprocess.run([node, '-e', script, str(ROOT), _asof()], capture_output=True, text=True,
                       cwd=str(ROOT), timeout=180)
    if r.returncode != 0:
        print('score engine failed: %s' % r.stderr.strip()[:200], file=sys.stderr)
        return 1
    scores = json.loads(r.stdout)

    IDS = {}
    idf = DATA / 'ids.json'
    if idf.exists():
        for row in json.loads(idf.read_text(encoding='utf-8')):
            if isinstance(row, (list, tuple)) and len(row) >= 2:
                IDS[str(row[0]).upper()] = row[1]

    prices = {}
    for f in sorted(DATA.glob('cat_*_p1.json')):
        try:
            for c in json.loads(f.read_text(encoding='utf-8')):
                prices[c['symbol'].upper()] = {
                    'p': c.get('current_price'), 'm': c.get('market_cap'),
                    'v': c.get('total_volume'), 'c1y': c.get('price_change_percentage_1y_in_currency'),
                }
        except Exception:
            continue

    day = _asof()

    out = {
        'date': day,
        'scoring_version': '2.7.0-preview',
        'scoring_v1': 'dna-v1 (primary)',
        'assets': {},
    }
    flags_script = (
        "const fs=require('fs');"
        "const d=JSON.parse(fs.readFileSync('data/detail/'.concat(process.argv[1],'.json'),'utf8'));"
        "eval(fs.readFileSync('engine/flags.js','utf8'));"
        "process.stdout.write(JSON.stringify(evaluateFlags(metricsFor({},d,{})).map(f=>f.id)));"
    )
    for sym, sc in scores.items():
        rec = dict(sc)
        rec.update(prices.get(sym, {}))
        rec['pillars'] = {'P': sc.get('P'), 'D': sc.get('D'), 'L': sc.get('L'),
                          'T': sc.get('T'), 'S': sc.get('S'), 'R': sc.get('R'),
                          'P_v1': sc.get('v1'), 'composite': sc.get('comp')}
        rec['flags'] = []
        cid = IDS.get(sym)
        if cid:
            try:
                fr = subprocess.run([node, '-e', flags_script, cid], capture_output=True, text=True,
                                    cwd=str(ROOT), timeout=30)
                if fr.returncode == 0 and fr.stdout.strip():
                    rec['flags'] = json.loads(fr.stdout)
            except Exception:
                pass
        out['assets'][sym] = rec

    HIST.mkdir(exist_ok=True)
    path = HIST / ('%s.json.gz' % day)
    with gzip.open(path, 'wt', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print('history snapshot: %s (%d assets, %d bytes)' % (path.name, len(out['assets']), path.stat().st_size))
    return 0


if __name__ == '__main__':
    sys.exit(main())
