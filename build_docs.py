# -*- coding: utf-8 -*-
"""Build docs.html — a browsable hub for every artifact in this repository.

Everything in the repo is already served by GitHub Pages, but markdown and JSON
arrive as raw text. This page renders the documents as HTML and indexes every
data / engine / history file with its size, so the whole project is readable on
the live site.
"""
import html
import io
import os
import re
import json

D = os.path.dirname(os.path.abspath(__file__))

DOCS = [
    ('pilot/result.md', 'Pilot round — result', 'ผลรอบ pilot 6 เหรียญ: คะแนน, เกณฑ์ที่ไม่ผ่าน, ค่าที่หาแหล่งอ้างอิงไม่ได้'),
    ('pilot/expected.md', 'Pilot — expected ranking (pre-registered)', 'อันดับที่เขียนไว้ก่อนกรอกข้อมูล + เงื่อนไขที่ทำให้รู้ว่า engine ผิด'),
    ('pilot/aset-probes.md', 'aset tier-2 probes (what was tried)', 'ผล probe API สาธารณะสำหรับ aset: อะไรเข้าได้/ไม่ได้ + เหตุผลที่ AZTEC ต้องไม่ถูกตั้งเป็น 0'),
    ('pilot/round3-pillars.md', 'T/S dedup + Pillar R + Compare', 'แยกการนับซ้ำ T/S, brk แบบ 3 ระดับพร้อมประวัติ, pillar R และโหมดเปรียบเทียบเรดาร์'),
    ('pilot/round2-pillars.md', 'MW hmeta cap · MWC mcap · Pillars T/S', 'แก้ 3 ข้อ: เพดาน hmeta ของ Mimblewimble, market cap fallback ของ MWC, และ pillar T/S + risk-adjusted composite'),
    ('pilot/pass-pillars-result.md', 'P-core close + Pillars D/L', 'ปิดแกน P: hst ขยาย, hnet/hmeta เกณฑ์โปรโตคอล, band floor + anomaly detection + pillar D/L และ composite 4 presets'),
    ('pilot/batch3-4-result.md', 'Batch 3+4 — complete (51/51)', 'ผล Batch 3 และ 4: ครบ 51 เหรียญ พร้อมการแก้ความไม่สอดคล้อง 2 จุดที่พบระหว่างกรอก'),
    ('pilot/batch2-result.md', 'Batch 2 — Zcash forks / masternode / legacy', 'ผล Batch 2: 11 เหรียญ พร้อมตาราง gene, ที่มา, และสิ่งที่พบ'),
    ('pilot/aset-probes-round2.md', 'aset probes — round 2 (replacement list)', 'ผล probe รอบ 2: 8/10 ตาย, 2 ที่ได้จริงไม่ใช่ anonymity set — ยืนยันว่าต้องใช้ fallback ชั้น 3'),
    ('pilot/result-rubric-2.1.md', 'Pilot round 2 — after rubric 2.1', 'ผลรอบสองหลังแก้ rubric: NYM ตกจากอันดับ 2, อันดับในกลุ่ม value-transfer ตรงกับที่คาดไว้'),
    ('pilot/plan-review-v4.md', 'Review of the v4 upgrade plan', 'ประเมินแผนอัปเกรด v4: อะไรทำก่อน/ทีหลัง/ไม่ทำ พร้อมเหตุผล และลำดับที่ถูกต้อง'),
    ('CHANGELOG.md', 'Changelog', 'ทุกการเปลี่ยนสูตรและ data contract พร้อม scoring_version'),
    ('HANDOVER.md', 'Handover', 'คู่มือส่งต่องาน: สถาปัตยกรรม, data model, runbook, QA, roadmap'),
    ('README.md', 'README', 'ภาพรวมโปรเจกต์ + วิธี rebuild + แหล่งข้อมูล'),
]

SECTIONS = [
    ('เอกสาร / Documents', 'doc', None),
    ('ข้อมูลที่คนคัด / Curated data', 'file', ['data/tiers.json', 'data/dna1.json', 'data/dna2.json', 'data/dna3.json',
                                              'data/curation.json', 'data/ids.json', 'data/curated/repos.json',
                                              'data/schema/rubric.json', 'data/schema/curated.schema.json',
                                              'data/categories.txt']),
    ('ข้อมูลที่ดึงอัตโนมัติ / Generated', 'file', None),   # filled by scan
    ('Engine (สูตรคะแนน + flags)', 'file', ['engine/score.js', 'engine/flags.js']),
    ('Pipeline', 'file', ['build.py', 'template.html', 'app.js', 'validate.py', 'scripts/snapshot.sh',
                          'scripts/snapshot_history.py', 'data/fetch_detail.py', 'data/enrich_gh.py',
                          'data/fill_gaps.py', 'pilot/fill_pilot.py', '.github/workflows/refresh.yml']),
    ('History snapshots', 'file', None),
]


def esc(t):
    return html.escape(t, quote=False)


def inline(t):
    t = esc(t)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<em>\1</em>', t)
    t = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', t)
    return t


def md_to_html(md):
    out, i = [], 0
    lines = md.split('\n')
    while i < len(lines):
        ln = lines[i]
        # fenced code
        if ln.strip().startswith('```'):
            buf = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith('```'):
                buf.append(esc(lines[i]))
                i += 1
            i += 1
            out.append('<pre class="code">' + '\n'.join(buf) + '</pre>')
            continue
        # table
        if ln.strip().startswith('|') and i + 1 < len(lines) and set(lines[i + 1].strip()) <= set('|-: '):
            head = [c.strip() for c in ln.strip().strip('|').split('|')]
            i += 2
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')])
                i += 1
            out.append('<table class="tbl"><tr>' + ''.join('<th>' + inline(h) + '</th>' for h in head) + '</tr>' +
                       ''.join('<tr>' + ''.join('<td>' + inline(c) + '</td>' for c in r) + '</tr>' for r in rows) +
                       '</table>')
            continue
        m = re.match(r'^(#{1,4})\s+(.*)$', ln)
        if m:
            lv = len(m.group(1))
            out.append('<h%d>%s</h%d>' % (lv, inline(m.group(2)), lv))
            i += 1
            continue
        if re.match(r'^\s*[-*]\s+', ln):
            buf = []
            while i < len(lines) and re.match(r'^\s*[-*]\s+', lines[i]):
                buf.append('<li>' + inline(re.sub(r'^\s*[-*]\s+', '', lines[i])) + '</li>')
                i += 1
            out.append('<ul>' + ''.join(buf) + '</ul>')
            continue
        if re.match(r'^\s*\d+\.\s+', ln):
            buf = []
            while i < len(lines) and re.match(r'^\s*\d+\.\s+', lines[i]):
                buf.append('<li>' + inline(re.sub(r'^\s*\d+\.\s+', '', lines[i])) + '</li>')
                i += 1
            out.append('<ol>' + ''.join(buf) + '</ol>')
            continue
        if ln.strip().startswith('>'):
            out.append('<blockquote>' + inline(ln.strip().lstrip('>').strip()) + '</blockquote>')
            i += 1
            continue
        if not ln.strip():
            i += 1
            continue
        out.append('<p>' + inline(ln) + '</p>')
        i += 1
    return '\n'.join(out)


def resolve(rel):
    a = os.path.join(D, rel.replace('/', os.sep))
    b = os.path.join(D, 'site', rel.replace('/', os.sep))
    return a if os.path.exists(a) else b


def size_of(rel):
    p = resolve(rel)
    if not os.path.exists(p):
        return None
    n = os.path.getsize(p)
    for unit in ('B', 'KB', 'MB'):
        if n < 1024 or unit == 'MB':
            return ('%.0f %s' % (n, unit)) if unit == 'B' else ('%.1f %s' % (n, unit))
        n /= 1024.0


def scan(pat, folder, limit=None):
    base = os.path.join(D, folder)
    if not os.path.isdir(base):
        return []
    hits = sorted(f for f in os.listdir(base) if f.endswith(pat))
    if limit:
        hits = hits[:limit]
    return [folder + '/' + h for h in hits]


def file_row(rel):
    sz = size_of(rel)
    if sz is None:
        return ''
    return '<li><a href="%s">%s</a> <span class="sz">%s</span></li>' % (rel, rel, sz)


def main():
    tabs, panes = [], []
    for idx, (path, title, blurb) in enumerate(DOCS):
        p = resolve(path)
        body = md_to_html(io.open(p, encoding='utf-8').read()) if os.path.exists(p) else '<p class="dim">missing: %s</p>' % esc(path)
        on = ' on' if idx == 0 else ''
        tabs.append('<button class="tab%s" data-pane="doc%d">%s</button>' % (on, idx, esc(title)))
        panes.append('<section class="pane%s" id="doc%d"><div class="src">%s · <a href="%s">raw</a></div>%s</section>'
                     % (on, idx, esc(path), path, body))

    blocks = []
    for name, kind, files in SECTIONS:
        if kind == 'doc':
            blocks.append('<h2>%s</h2><ul class="files">%s</ul>' %
                          (esc(name), ''.join(file_row(d[0]) for d in DOCS)))
            continue
        if files is None:
            if 'Generated' in name:
                files = scan('.json', 'data', 40)
            else:
                files = scan('.json.gz', 'history')
        rows = ''.join(file_row(f) for f in files)
        blocks.append('<h2>%s</h2><ul class="files">%s</ul>' % (esc(name), rows or '<li class="dim">—</li>'))

    total = 0
    for root, dirs, fs in os.walk(D):
        dirs[:] = [d for d in dirs if d not in ('.git', '__pycache__', 'output')]
        for f in fs:
            total += os.path.getsize(os.path.join(root, f))

    page = '''<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PRIVACY//TERMINAL — docs &amp; data</title>
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<style>
:root{--bg:#0b0f14;--panel:#10161f;--line:#1e2936;--tx:#c9d4e0;--bright:#eef4fb;--dim:#6b7a8d;--accent:#4cc2ff;--up:#2ecc71;--down:#ff4d4f;--mono:ui-monospace,'Cascadia Mono',Consolas,monospace}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--tx);font:12px/1.6 var(--mono);padding:0 0 40px}
header{padding:18px 20px 12px;border-bottom:1px solid var(--line)}
h1{font-size:19px;color:var(--bright);letter-spacing:.5px}
h1 span{color:var(--accent)}
.sub{color:var(--dim);font-size:11px;margin-top:4px}
nav{display:flex;flex-wrap:wrap;gap:2px;padding:8px 20px 0;border-bottom:1px solid var(--line)}
.tab{background:none;border:1px solid transparent;border-bottom:none;color:var(--dim);font:600 11px var(--mono);padding:6px 12px;cursor:pointer;border-radius:4px 4px 0 0}
.tab:hover{color:var(--tx)}
.tab.on{color:var(--accent);border-color:var(--line);background:var(--panel)}
main{padding:16px 20px;max-width:1100px}
.pane{display:none}
.pane.on{display:block}
.src{color:var(--dim);font-size:10px;margin-bottom:10px}
h2{font-size:13px;color:var(--accent);margin:22px 0 8px;letter-spacing:.4px}
h3{font-size:12px;color:var(--bright);margin:16px 0 6px}
h4{font-size:11px;color:var(--tx);margin:12px 0 4px}
p{margin:6px 0}
ul,ol{margin:6px 0 6px 20px}
li{margin:2px 0}
code{background:#151d27;padding:0 4px;border-radius:3px;font-size:11px}
pre.code{background:#0d1319;border:1px solid var(--line);border-radius:4px;padding:9px 11px;overflow-x:auto;font-size:10.5px;margin:8px 0}
table.tbl{border-collapse:collapse;margin:10px 0;width:100%}
table.tbl th{background:var(--panel);text-align:left}
table.tbl th,table.tbl td{border:1px solid var(--line);padding:4px 7px;font-size:10.5px;vertical-align:top}
blockquote{border-left:3px solid var(--accent);background:var(--panel);padding:6px 10px;margin:8px 0}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
ul.files{list-style:none;margin-left:0;columns:2;column-gap:24px}
ul.files li{margin:1px 0;font-size:10.5px;break-inside:avoid}
.sz{color:var(--dim);font-size:9.5px}
.dim{color:var(--dim)}
footer{border-top:1px solid var(--line);margin-top:26px;padding:12px 20px;color:var(--dim);font-size:10px}
</style></head><body>
<header>
  <h1>&gt;_ PRIVACY<span>//</span>TERMINAL <span>· docs &amp; data</span></h1>
  <div class="sub">ทุกไฟล์ของโปรเจกต์เปิดอ่านได้จากหน้านี้ — เอกสาร, ข้อมูลที่คนคัด, engine, pipeline และ history · <a href="./">กลับไปหน้า terminal</a> · ข้อมูลรวม __SIZE__ MB</div>
</header>
<nav>__TABS__</nav>
<main>__BODY__</main>
<footer>เพื่อการวิจัย ไม่ใช่คำแนะนำการลงทุน · ทุกค่าที่คนคัดมี src/asof; ค่าที่หาแหล่งอ้างอิงไม่ได้จะเว้นว่าง ไม่เดา</footer>
<script>
document.querySelectorAll('.tab').forEach(function(b){b.addEventListener('click',function(){
  document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('on')});
  document.querySelectorAll('.pane').forEach(function(x){x.classList.remove('on')});
  b.classList.add('on');
  document.getElementById(b.getAttribute('data-pane')).classList.add('on');
});});
</script>
</body></html>'''
    page = (page.replace('__SIZE__', '%.1f' % (total / 1048576.0))
                .replace('__TABS__', ''.join(tabs))
                .replace('__BODY__', ''.join(panes) + ''.join(blocks)))

    outp = os.path.join(D, 'docs.html') if os.path.basename(D) == 'site' else os.path.join(D, 'site', 'docs.html')
    io.open(outp, 'w', encoding='utf-8').write(page)
    print('wrote docs.html (%.1f KB)' % (os.path.getsize(outp) / 1024.0))


if __name__ == '__main__':
    main()
