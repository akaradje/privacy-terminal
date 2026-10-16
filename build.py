# -*- coding: utf-8 -*-
"""Build privacy-terminal.html from CoinGecko category snapshots."""
import json, glob, os, datetime

D = os.path.dirname(os.path.abspath(__file__))
DD = os.path.join(D, 'data')

FILE_TAGS = {
    'cat_privacy-coins_p1.json': 'pc',
    'cat_zero-knowledge-zk_p1.json': 'zk',
    'cat_privacy-infrastructure_p1.json': 'pi',
    'cat_privacy-blockchain_p1.json': 'pb',
    'cat_privacy-focused-browser_p1.json': 'misc',
    'cat_zero-network-ecosystem_p1.json': 'misc',
    'cat_beamprivacy-ecosystem_p1.json': 'misc',
}

coins = {}
for fname, tag in FILE_TAGS.items():
    path = os.path.join(DD, fname)
    if not os.path.exists(path):
        continue
    for c in json.load(open(path, encoding='utf-8')):
        if c.get('id') in coins:
            coins[c['id']]['tags'].append(tag)
        else:
            c2 = dict(c)
            c2['tags'] = [tag]
            coins[c['id']] = c2

# parent category 'privacy' — include members that are in no specific subcategory
p1 = os.path.join(DD, 'cat_privacy_p1.json')
if os.path.exists(p1):
    for c in json.load(open(p1, encoding='utf-8')):
        if c.get('id') not in coins:
            c2 = dict(c)
            c2['tags'] = []
            coins[c['id']] = c2

priv = set()
if os.path.exists(p1):
    for c in json.load(open(p1, encoding='utf-8')):
        priv.add(c['id'])

recs = []
for c in coins.values():
    mcap = c.get('market_cap')
    price = c.get('current_price')
    cs = c.get('circulating_supply')
    ms = c.get('max_supply')
    fdv = c.get('fully_diluted_valuation')
    # CoinGecko occasionally reports market_cap = 0 while the coin is live (observed on MWC,
    # which has a price of $11.84 and volume but market_cap AND circulating_supply = 0).
    # Imputing the cap keeps pillar L meaningful instead of reading a working coin as worthless.
    # Fallback order, each step guarded so a nonsense number can never be produced:
    #   1. price x circulating_supply                       (the normal case)
    #   2. price x (FDV / price) = FDV, i.e. the supply figure CoinGecko itself used, only when
    #      that implied supply is > 0 and no larger than max_supply
    # The record carries `mi` so the UI, the flags and the anomaly check can all say the number
    # was derived rather than reported.
    mcap_imputed = False
    if (not mcap or mcap <= 0) and price and price > 0:
        implied_supply = None
        if cs and cs > 0:
            implied_supply = cs
        elif fdv and fdv > 0:
            implied_supply = fdv / price
            if implied_supply > 0 and ms and implied_supply > ms:
                implied_supply = None
        if implied_supply and implied_supply > 0:
            mcap = price * implied_supply
            mcap_imputed = True
    recs.append({
        'id': c['id'],
        's': c['symbol'].upper(),
        'n': c['name'],
        'p': price,
        'm': mcap,
        'mi': 1 if mcap_imputed else 0,
        'v': c.get('total_volume'),
        'c24': c.get('price_change_percentage_24h_in_currency'),
        'c7': c.get('price_change_percentage_7d_in_currency'),
        'c30': c.get('price_change_percentage_30d_in_currency'),
        'c1y': c.get('price_change_percentage_1y_in_currency'),
        'cs': c.get('circulating_supply'),
        'ms': c.get('max_supply'),
        'img': c.get('image'),
        'tags': sorted(set(c['tags'])),
        'priv': c['id'] in priv,
    })

recs.sort(key=lambda r: -(r['m'] or 0))

CUR = json.load(open(os.path.join(DD, 'curation.json'), encoding='utf-8'))

# tier assignment (hand-classified: t1 = pure privacy / t2 = adjacent / t3 = zk-infra)
# ID_LOCK: symbols shared by two different coins — DNA/tier belongs to this id only
ID_LOCK = {'ZKP': 'zkpass'}
_t = json.load(open(os.path.join(DD, 'tiers.json'), encoding='utf-8'))
TIER = {}
for _k in ('t1', 't2', 't3'):
    for _s in _t.get(_k, []):
        if _s not in TIER:
            TIER[_s] = _k
for r in recs:
    _lock = ID_LOCK.get(r['s'], r['id'])
    r['tier'] = TIER.get(r['s'], 't3') if _lock == r['id'] else 't3'

# deep DNA (hand-curated technical profiles)
DNA = {}
for _f in ('dna1.json', 'dna2.json'):
    _p = os.path.join(DD, _f)
    if os.path.exists(_p):
        DNA.update(json.load(open(_p, encoding='utf-8')))
_syms = set(r['s'] for r in recs)
DNA = dict((k, v) for k, v in DNA.items() if k in _syms)
for r in recs:
    _lock = ID_LOCK.get(r['s'], r['id'])
    r['dna'] = 1 if (r['s'] in DNA and _lock == r['id']) else 0

# structured gene layer (flags / group / audit / gov / risk)
_p3 = os.path.join(DD, 'dna3.json')
if os.path.exists(_p3):
    for _k, _v in json.load(open(_p3, encoding='utf-8')).items():
        if _k in DNA:
            DNA[_k].update(_v)

# PURE ONLY — keep assets where privacy is the protocol's core AND a DNA profile exists
recs = [r for r in recs if r['tier'] == 't1' and r['dna'] == 1]
for r in recs:
    r['g'] = DNA.get(r['s'], {}).get('g', 'proto')

# full project dossiers (CoinGecko /coins/{id}) — description, links, community, dev, 7d sparkline
DETAIL = {}
_dd = os.path.join(DD, 'detail')
if os.path.isdir(_dd):
    for _f in os.listdir(_dd):
        if _f.endswith('.json'):
            try:
                _rec = json.load(open(os.path.join(_dd, _f), encoding='utf-8'))
                if _rec.get('id'):
                    DETAIL[_rec['id']] = _rec
            except Exception as _e:
                print('detail load error', _f, _e)
DETAIL = dict((k, v) for k, v in DETAIL.items() if k in set(r['id'] for r in recs))

sector_mcap = sum(r['m'] or 0 for r in recs)
y1s = [r['c1y'] for r in recs if r['c1y'] is not None]
y1s.sort()
median_1y = y1s[len(y1s)//2] if y1s else None
snap = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')

STATS = {
    'n': len(recs),
    'scoring_version': '2.7.0-preview',
    'scoring_v1': 'dna-v1 (primary)',
    'sector_mcap': sector_mcap,
    'median_1y': median_1y,
    'n_cur': len(CUR),
    'n_t1': len(recs),
    'n_dna': len(DNA),
    'n_cut': 251 - len(recs),
    'snap': snap,
}
for _g in ('coin', 'proto', 'net', 'compute'):
    STATS['n_' + _g] = sum(1 for r in recs if r.get('g') == _g)

# ---- docs + data index, rendered into the bundle so everything lives in one page ----
try:
    import build_docs as BD
    _docs, _idx = [], []
    for _path, _title, _blurb in BD.DOCS:
        _fp = BD.resolve(_path)
        if os.path.exists(_fp):
            _docs.append({'p': _path, 't': _title, 'b': _blurb,
                          'h': BD.md_to_html(open(_fp, encoding='utf-8').read())})
    for _name, _kind, _files in BD.SECTIONS:
        if _kind == 'doc':
            continue
        if _files is None:
            _files = BD.scan('.json', 'data', 40) if 'Generated' in _name else BD.scan('.json.gz', 'history')
        _items = []
        for _f in _files:
            _sz = BD.size_of(_f)
            if _sz:
                _items.append({'p': _f, 's': _sz})
        _idx.append({'n': _name, 'items': _items})
    DOCSPAY = {'docs': _docs, 'idx': _idx}
    print('docs embedded:', len(_docs), '| index sections:', len(_idx))
except Exception as _e:
    DOCSPAY = {'docs': [], 'idx': []}
    print('docs embed skipped:', _e)

tpl = open(os.path.join(D, 'template.html'), encoding='utf-8').read()
enginejs = ''
for _ef in ('engine/score.js', 'engine/flags.js'):
    _ep = os.path.join(D, _ef)
    if os.path.exists(_ep):
        enginejs += open(_ep, encoding='utf-8').read() + '\n'
appjs = enginejs + open(os.path.join(D, 'app.js'), encoding='utf-8').read()
tpl = tpl.replace('/*__APPJS__*/', appjs)
html = tpl.replace('__DATA__', json.dumps(recs, ensure_ascii=False, separators=(',', ':')))
html = html.replace('__CUR__', json.dumps(CUR, ensure_ascii=False, separators=(',', ':')))
html = html.replace('__DNA__', json.dumps(DNA, ensure_ascii=False, separators=(',', ':')))
html = html.replace('__DETAIL__', json.dumps(DETAIL, ensure_ascii=False, separators=(',', ':')))
html = html.replace('__STATS__', json.dumps(STATS, ensure_ascii=False))
html = html.replace('__SNAP__', STATS['snap'])
# __DOCS__ must be substituted LAST: the embedded documents contain the other
# placeholder tokens as literal text (the file map in HANDOVER.md lists them).
html = html.replace('__DOCS__', json.dumps(DOCSPAY, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/'))

out = os.path.join(D, 'privacy-terminal.html')
open(out, 'w', encoding='utf-8').write(html)
print('scoring: v2.7.0-preview (preview) | v1 primary')
print('coins:', len(recs), '| t1 pure:', STATS['n_t1'], '| DNA profiles:', len(DNA), '| dossiers:', len(DETAIL))
print('sector_mcap: %.1fB | median 1y: %.0f%%' % (sector_mcap/1e9, median_1y or 0))
print('wrote', out)
