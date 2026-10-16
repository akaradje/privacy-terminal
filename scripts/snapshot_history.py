# -*- coding: utf-8 -*-
"""Daily history snapshot: history/YYYY-MM-DD.json.gz

One compact record per asset per day (price, mcap, v1 score, v2 score + coverage,
6 pillars, composite, Bull-Run Asymmetry score, and red/green flags), so rankings
and scores can be compared over time. Scores come from engine/score.js via node —
the formula is never duplicated here.
"""
import datetime
import gzip
import json
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'
HIST = ROOT / 'history'


def _asof():
    """Snapshot date, so pillar D is diffable: the same data always yields the same score."""
    try:
        day = subprocess.run(['date', '-u', '+%Y-%m-%d'], capture_output=True, text=True).stdout.strip()
    except Exception:
        day = ''
    if not day or len(day) != 10:
        day = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
    return day


def main():
    node = shutil.which('node')
    if not node:
        print('node not found — cannot score without engine/score.js', file=sys.stderr)
        return 1

    day = _asof()

    # Score with the engine itself — all six pillars, composites, Bull-Run Asymmetry, and flags/positives
    script = (
        "const fs=require('fs'),p=require('path'),R=process.argv[1],ASOF=process.argv[2];"
        "const dna=JSON.parse(fs.readFileSync(p.join(R,'data/dna3.json'),'utf8'));"
        "eval(fs.readFileSync(p.join(R,'engine/score.js'),'utf8'));"
        "eval(fs.readFileSync(p.join(R,'engine/flags.js'),'utf8'));"
        "const ids={},idToSym={};for(const row of JSON.parse(fs.readFileSync(p.join(R,'data/ids.json'),'utf8'))){"
        "  const s=String(row[0]).toUpperCase();ids[s]=row[1];idToSym[row[1]]=s;}"
        "const mkt={};for(const f of fs.readdirSync(p.join(R,'data'))){"
        "  if(!/^cat_.*_p\\d+\\.json$/.test(f))continue;"
        "  try{for(const c of JSON.parse(fs.readFileSync(p.join(R,'data',f),'utf8'))){"
        "    const s=idToSym[c.id]||String(c.symbol||'').toUpperCase();"
        "    if(ids[s]&&ids[s]!==c.id)continue;"
        "    let m=c.market_cap,mi=0,pr=c.current_price,cs=c.circulating_supply,ms=c.max_supply,fdv=c.fully_diluted_valuation;"
        "    if((!m||m<=0)&&pr&&pr>0){"
        "      let imp=cs&&cs>0?cs:(fdv&&fdv>0?fdv/pr:null);"
        "      if(imp&&imp>0&&(!ms||imp<=ms)){m=pr*imp;mi=1;}"
        "    }"
        "    mkt[s]={p:pr,m:m,v:c.total_volume,cs:cs,ms:ms,mi:mi,"
        "    c24:c.price_change_percentage_24h_in_currency,"
        "    c7:c.price_change_percentage_7d_in_currency,"
        "    c30:c.price_change_percentage_30d_in_currency,"
        "    c1y:c.price_change_percentage_1y_in_currency};}}catch(e){}}"
        "const o={};for(const k in dna){"
        "  let det=null;try{const cid=ids[k];if(cid)"
        "    det=JSON.parse(fs.readFileSync(p.join(R,'data/detail',cid+'.json'),'utf8'));}catch(e){}"
        "  const coin=mkt[k]||null;const pl=pillarsOf(dna[k],coin,det,ASOF);const p2=scoreP(dna[k]);"
        "  let comp=null,bh=null,asy=null;"
        "  try{comp=compositeOf(dna[k],coin,det,ASOF,'privacy_investor',true);}catch(e){}"
        "  try{bh=compositeOf(dna[k],coin,det,ASOF,'bull_hunter',true);}catch(e){}"
        "  try{asy=asymmetryOf(dna[k],coin,det,ASOF);}catch(e){}"
        "  const m=metricsFor(coin,det,dna[k],ASOF);"
        "  const flags=evaluateFlags(m).map(f=>f.id);"
        "  const positives=evaluatePositives(m).map(f=>f.id);"
        "  o[k]={P:pl.P,D:pl.D,L:pl.L,T:pl.T,S:pl.S,R:pl.R,comp:comp,bh:bh,"
        "  bull:asy?asy.score:null,arch:asy?asy.archetype:null,"
        "  v1:scoreV1(dna[k]),v2:p2?p2.P:null,band:p2?p2.band:null,cov:p2?p2.coverage:null,"
        "  ins:p2?p2.insufficient:null,flags:flags,positives:positives};}"
        "process.stdout.write(JSON.stringify(o));"
    )
    r = subprocess.run([node, '-e', script, str(ROOT), day], capture_output=True, text=True,
                       cwd=str(ROOT), timeout=180)
    if r.returncode != 0:
        print('score engine failed: %s' % r.stderr.strip()[:200], file=sys.stderr)
        return 1
    scores = json.loads(r.stdout)

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

    out = {
        'date': day,
        'scoring_version': '2.8.0-preview',
        'scoring_v1': 'dna-v1 (primary)',
        'assets': {},
    }
    for sym, sc in scores.items():
        rec = dict(sc)
        rec.update(prices.get(sym, {}))
        rec['pillars'] = {
            'P': sc.get('P'), 'D': sc.get('D'), 'L': sc.get('L'),
            'T': sc.get('T'), 'S': sc.get('S'), 'R': sc.get('R'),
            'P_v1': sc.get('v1'), 'composite': sc.get('comp'),
            'bull_hunter': sc.get('bh'), 'bull_asymmetry': sc.get('bull')
        }
        out['assets'][sym] = rec

    HIST.mkdir(exist_ok=True)
    path = HIST / ('%s.json.gz' % day)
    with gzip.open(path, 'wt', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print('history snapshot: %s (%d assets, %d bytes)' % (path.name, len(out['assets']), path.stat().st_size))
    return 0


if __name__ == '__main__':
    sys.exit(main())
