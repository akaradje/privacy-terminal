# -*- coding: utf-8 -*-
"""Daily history snapshot: history/YYYY-MM-DD.json.gz

One compact record per asset per day (price, mcap, v1 score, v2 score + coverage),
so rankings and scores can be compared over time. Scores come from engine/score.js
via node — the formula is never duplicated here.
"""
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


def main():
    node = shutil.which('node')
    if not node:
        print('node not found — cannot score without engine/score.js', file=sys.stderr)
        return 1

    script = (
        "const fs=require('fs');"
        "const dna=JSON.parse(fs.readFileSync('data/dna3.json','utf8'));"
        "eval(fs.readFileSync('engine/score.js','utf8'));"
        "const o={};for(const k in dna){const p=scoreP(dna[k]);"
        "o[k]={v1:scoreV1(dna[k]),v2:p?p.P:null,cov:p?p.coverage:null,ins:p?p.insufficient:null};}"
        "process.stdout.write(JSON.stringify(o));"
    )
    r = subprocess.run([node, '-e', script], capture_output=True, text=True, cwd=str(ROOT), timeout=90)
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

    day = subprocess.run(['date', '-u', '+%Y-%m-%d'], capture_output=True, text=True).stdout.strip()
    if not day:
        import datetime
        day = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')

    out = {
        'date': day,
        'scoring_version': '2.0.0-preview',
        'scoring_v1': 'dna-v1 (primary)',
        'assets': {},
    }
    for sym, sc in scores.items():
        rec = dict(sc)
        rec.update(prices.get(sym, {}))
        out['assets'][sym] = rec

    HIST.mkdir(exist_ok=True)
    path = HIST / ('%s.json.gz' % day)
    with gzip.open(path, 'wt', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print('history snapshot: %s (%d assets, %d bytes)' % (path.name, len(out['assets']), path.stat().st_size))
    return 0


if __name__ == '__main__':
    sys.exit(main())
