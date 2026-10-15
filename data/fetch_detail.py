# -*- coding: utf-8 -*-
"""Fetch project dossiers (light pass) + 7d sparkline (second pass) for pure privacy coins."""
import json, os, time, urllib.request, urllib.error, re, io

D = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(D, 'detail')
os.makedirs(OUT, exist_ok=True)
ids = json.load(io.open(os.path.join(D, 'ids.json'), encoding='utf-8'))
BASE = 'https://api.coingecko.com/api/v3'
HDR = {'User-Agent': 'Mozilla/5.0 (compatible; research)', 'Accept': 'application/json'}
SLEEP = 8.0


def get(url, tries=4):
    for a in range(tries):
        try:
            req = urllib.request.Request(url, headers=HDR)
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            wait = 75 if e.code == 429 else 10
            print('   http %s -> sleep %ds' % (e.code, wait), flush=True)
            time.sleep(wait * (a + 1) / 2.0)
        except Exception as e:
            print('   err', type(e).__name__, flush=True)
            time.sleep(12)
    return None


def clean(t):
    if not t or not isinstance(t, str):
        return ''
    t = re.sub(r'<[^>]+>', ' ', t)
    t = re.sub(r'&[a-z]+;', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


def downsample(arr, n=42):
    if not arr:
        return []
    if len(arr) <= n:
        return [round(float(p), 8) for p in arr]
    step = len(arr) / float(n)
    return [round(float(arr[int(i * step)]), 8) for i in range(n)]


done = 0
for sym, cid in ids:
    path = os.path.join(OUT, cid + '.json')
    rec = {}
    if os.path.exists(path) and os.path.getsize(path) > 120:
        try:
            rec = json.load(io.open(path, encoding='utf-8'))
        except Exception:
            rec = {}
    if not rec.get('desc') and not rec.get('home'):
        got = get(BASE + '/coins/' + cid + '?localization=false&tickers=false&market_data=false'
                  '&community_data=true&developer_data=true&sparkline=false')
        if not got:
            print('FAILED', cid, flush=True)
            time.sleep(SLEEP)
            continue
        cd = got.get('community_data') or {}
        dd = got.get('developer_data') or {}
        lk = got.get('links') or {}
        repo = (lk.get('repos_url') or {}).get('github') or []
        rec = {
            'sym': sym, 'id': cid,
            'desc': clean((got.get('description') or {}).get('en'))[:1000],
            'home': (lk.get('homepage') or [''])[0],
            'wp': lk.get('whitepaper') or '',
            'gh': repo[0] if repo else '',
            'tw': lk.get('twitter_screen_name') or '',
            'tg': lk.get('telegram_channel_identifier') or '',
            'dc': (lk.get('chat_url') or [''])[0],
            'reddit': lk.get('subreddit_url') or '',
            'forum': (lk.get('official_forum_url') or [''])[0],
            'explorer': (lk.get('blockchain_site') or [''])[0],
            'genesis': got.get('genesis_date'),
            'cats': (got.get('categories') or [])[:6],
            'algo': got.get('hashing_algorithm'),
            'tw_fol': cd.get('twitter_followers'),
            'reddit_sub': cd.get('reddit_subscribers'),
            'tg_users': cd.get('telegram_channel_user_count'),
            'stars': dd.get('stars'), 'forks': dd.get('forks'),
            'commits4w': dd.get('commit_count_4_weeks'),
            'contrib': dd.get('pull_request_contributors'),
            'closed_issues': dd.get('closed_issues'),
            'sent_up': got.get('sentiment_votes_up_percentage'),
            'watch': got.get('watchlist_users'),
            'spark': rec.get('spark') or [],
        }
        io.open(path, 'w', encoding='utf-8').write(json.dumps(rec, ensure_ascii=False))
        done += 1
        print('[%d] %s dossier ok (desc %d)' % (done, cid, len(rec['desc'])), flush=True)
        time.sleep(SLEEP)

# pass B — 7d sparkline via market_chart (daily, 8 points)
print('--- sparkline pass ---', flush=True)
sp = 0
for sym, cid in ids:
    path = os.path.join(OUT, cid + '.json')
    if not os.path.exists(path):
        continue
    try:
        rec = json.load(io.open(path, encoding='utf-8'))
    except Exception:
        continue
    if rec.get('spark'):
        continue
    got = get(BASE + '/coins/' + cid + '/market_chart?vs_currency=usd&days=7&interval=daily')
    if not got or not got.get('prices'):
        print('spark FAILED', cid, flush=True)
        time.sleep(SLEEP)
        continue
    rec['spark'] = downsample([p[1] for p in got['prices']], 42)
    io.open(path, 'w', encoding='utf-8').write(json.dumps(rec, ensure_ascii=False))
    sp += 1
    print('spark [%d] %s (%d pts)' % (sp, cid, len(rec['spark'])), flush=True)
    time.sleep(SLEEP)
print('DONE dossiers=%d sparklines=%d' % (done, sp))
