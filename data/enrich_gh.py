# -*- coding: utf-8 -*-
"""Enrich dossiers with GitHub repo stats (stars/forks/issues/last push) + Reddit subscribers."""
import json, os, io, glob, subprocess, urllib.request, time

D = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(D, 'detail')
HDR = {'User-Agent': 'Mozilla/5.0 (research script)'}


def gh_repo(url):
    try:
        m = url.rstrip('/').split('github.com/')[-1]
        parts = [p for p in m.split('/') if p]
        if len(parts) < 2:
            return None
        full = parts[0] + '/' + parts[1]
        out = subprocess.run(
            ['gh', 'api', 'repos/' + full,
             '--jq', '{stars:.stargazers_count,forks:.forks_count,issues:.open_issues_count,'
                     'lang:.language,pushed:.pushed_at,lic:(.license.spdx_id),archived:.archived,'
                     'watchers:.subscribers_count,desc:.description}'],
            capture_output=True, text=True, timeout=45, shell=False)
        if out.returncode != 0:
            return None
        return json.loads(out.stdout)
    except Exception as e:
        print('  gh err', url, e, flush=True)
        return None


def reddit_subs(url):
    try:
        u = url.rstrip('/')
        if not u.startswith('http'):
            return None
        if 'reddit.com/r/' not in u:
            return None
        r = u.split('reddit.com/r/')[-1].strip('/')
        req = urllib.request.Request('https://www.reddit.com/r/%s/about.json' % r, headers=HDR)
        with urllib.request.urlopen(req, timeout=25) as resp:
            d = json.loads(resp.read().decode('utf-8'))
        return (d.get('data') or {}).get('subscribers')
    except Exception:
        return None


n_gh = n_rd = 0
for f in sorted(glob.glob(os.path.join(OUT, '*.json'))):
    try:
        rec = json.load(io.open(f, encoding='utf-8'))
    except Exception:
        continue
    changed = False
    if rec.get('gh') and not rec.get('stars'):
        g = gh_repo(rec['gh'])
        if g:
            rec['stars'] = g.get('stars')
            rec['forks'] = g.get('forks')
            rec['gh_issues'] = g.get('issues')
            rec['gh_lang'] = g.get('lang')
            rec['gh_pushed'] = (g.get('pushed') or '')[:10]
            rec['gh_lic'] = g.get('lic')
            rec['gh_watch'] = g.get('watchers')
            rec['gh_archived'] = g.get('archived')
            n_gh += 1
            changed = True
    if rec.get('reddit') and not rec.get('reddit_sub'):
        s = reddit_subs(rec['reddit'])
        if s:
            rec['reddit_sub'] = s
            n_rd += 1
            changed = True
        time.sleep(1.2)
    if changed:
        io.open(f, 'w', encoding='utf-8').write(json.dumps(rec, ensure_ascii=False))
        print('%s stars=%s reddit=%s pushed=%s' % (rec.get('sym'), rec.get('stars'), rec.get('reddit_sub'), rec.get('gh_pushed')), flush=True)

print('DONE github=%d reddit=%d' % (n_gh, n_rd))
