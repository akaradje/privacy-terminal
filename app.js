var DATA = __DATA__;
var CUR = __CUR__;
var DNA = __DNA__;
var DETAIL = __DETAIL__;
var DOCSPAY = (function () { try { var el = document.getElementById('docsData'); return JSON.parse((el && el.textContent) || '{"docs":[],"idx":[]}'); } catch (e) { return { docs: [], idx: [] }; } })();
var STATS = __STATS__;
/* Snapshot date. Pillar D is a recency measure, so it must be computed against a fixed date —
 * using "now" would make the same data produce a different score tomorrow and break diffing. */
var ASOF_DATE = (STATS && STATS.snap) ? String(STATS.snap).slice(0, 10) : new Date().toISOString().slice(0, 10);
var state = { view: 'table', q: '', sortKey: 'm', dir: -1, minMcap: 0, minGrade: 0, sel: -1, expanded: null, compare: [] };
var view = [];
var TIERMAP = {};
var IDMAP = {};

function $(id) { return document.getElementById(id); }

function fmtCompact(n) {
  if (n == null || !isFinite(n)) return '—';
  var a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(2);
}
function fmtNum(n) {
  if (n == null || !isFinite(n)) return '—';
  var a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}
function fmtPrice(p) {
  if (p == null || !isFinite(p) || p === 0) return '—';
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 1) return '$' + p.toFixed(2);
  if (p >= 0.01) return '$' + p.toFixed(4);
  return '$' + p.toFixed(6);
}
function fmtPct(v) {
  if (v == null || !isFinite(v)) return '<span class="dim">n/a</span>';
  var cls = v > 0 ? 'up' : (v < 0 ? 'down' : 'dim');
  var tri = v > 0 ? '▲' : (v < 0 ? '▼' : '');
  return '<span class="' + cls + '">' + tri + (v > 0 ? '+' : '') + v.toFixed(1) + '%</span>';
}
function badge(model) {
  if (!model) return '<span class="dim">—</span>';
  var m = model.toLowerCase();
  var c = 'b-opt';
  if (m.indexOf('mand') === 0) c = 'b-mand';
  else if (m.indexOf('def') === 0) c = 'b-def';
  else if (m.indexOf('sel') === 0) c = 'b-sel';
  else if (m.indexOf('infra') === 0) c = 'b-inf';
  return '<span class="badge ' + c + '">' + model + '</span>';
}
function cur(sym) { return CUR[sym] || {}; }
function dna(c) {
  if (!c) return {};
  var has = c.dna || (IDMAP[c.id] && IDMAP[c.id].dna);
  return has ? (DNA[c.s] || {}) : {};
}
function tierOf(c) { return c.tier || (IDMAP[c.id] && IDMAP[c.id].tier) || TIERMAP[c.s] || 't3'; }
function grpOf(c) { return c.g || dna(c).g || 'proto'; }
function det(c) { return DETAIL[c.id] || {}; }
function sparkColor(arr) {
  if (!arr || arr.length < 2) return '#5d6a7a';
  return arr[arr.length - 1] >= arr[0] ? '#2ecc71' : '#ff4d4f';
}
function sparkSvg(arr, w, h, col) {
  if (!arr || arr.length < 2) return '';
  var mn = Math.min.apply(null, arr), mx = Math.max.apply(null, arr);
  var span = (mx - mn) || 1, pts = [];
  for (var i = 0; i < arr.length; i++) {
    var x = (i / (arr.length - 1)) * w;
    var y = h - ((arr[i] - mn) / span) * h;
    pts.push(x.toFixed(1) + ',' + y.toFixed(1));
  }
  return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
    '<polyline fill="none" stroke="' + col + '" stroke-width="1.2" points="' + pts.join(' ') + '"/></svg>';
}
function dossierHtml(c) {
  var d = det(c);
  if (!d || (!d.desc && !d.home)) return '';
  function lnk(url, label) { return url ? '<a class="lk" href="' + url + '" target="_blank" rel="noopener">' + label + '</a>' : ''; }
  var links = lnk(d.home, 'เว็บไซต์') + lnk(d.wp, 'whitepaper') + lnk(d.gh, 'GitHub') +
    lnk(d.tw ? 'https://x.com/' + d.tw : '', 'X/Twitter') + lnk(d.tg ? 'https://t.me/' + d.tg : '', 'Telegram') +
    lnk(d.dc, 'Discord/Chat') + lnk(d.reddit, 'Reddit') + lnk(d.forum, 'Forum') + lnk(d.explorer, 'Explorer');
  var stats = [];
  if (d.genesis) stats.push(['genesis', d.genesis]);
  if (d.algo) stats.push(['algorithm', d.algo]);
  if (d.ex_count) stats.push(['กระดานเทรด', d.ex_count + ' แห่ง' + (d.ex_top && d.ex_top.length ? ' · ' + d.ex_top.slice(0, 4).join(', ') : '')]);
  if (d.tw_fol) stats.push(['X followers', fmtNum(d.tw_fol)]);
  if (d.reddit_sub) stats.push(['Reddit subscribers', fmtNum(d.reddit_sub)]);
  if (d.tg_users) stats.push(['Telegram members', fmtNum(d.tg_users)]);
  var repo = d.gh_org_repo || d.gh_repo_used || '';
  var orgNote = d.gh_org_repo ? ' · repo ดาวมากสุดใน org' : '';
  if (!repo && d.gh) {
    try { repo = d.gh.split('github.com/')[1].replace(/\/+$/, ''); } catch (e) { repo = ''; }
  }
  if (repo) stats.push(['GitHub repo', repo + orgNote]);
  if (d.stars) stats.push(['GitHub stars', fmtNum(d.stars) + (d.forks ? ' · forks ' + fmtNum(d.forks) : '') + (d.gh_lang ? ' · ' + d.gh_lang : '')]);
  if (d.gh_pushed) stats.push(['commit ล่าสุด', d.gh_pushed + (d.gh_issues != null ? ' · issues เปิด ' + fmtNum(d.gh_issues) : '')]);
  if (d.gh_lic) stats.push(['license', d.gh_lic]);
  if (d.gh_archived) stats.push(['สถานะ repo', 'ARCHIVED']);
  if (d.commits4w != null) stats.push(['commits 4 สัปดาห์', d.commits4w + (d.contrib ? ' · contributors ' + d.contrib : '')]);
  if (d.closed_issues) stats.push(['issues ปิดแล้ว', fmtNum(d.closed_issues)]);
  if (d.watch) stats.push(['CoinGecko watchlist', fmtNum(d.watch)]);
  if (d.sent_up != null) stats.push(['sentiment บวก', Math.round(d.sent_up) + '%']);
  if (d.cats && d.cats.length) stats.push(['หมวดหมู่', d.cats.join(' · ')]);
  var sg = '';
  for (var i = 0; i < stats.length; i++) sg += '<div><div class="k">' + stats[i][0] + '</div><div class="v">' + stats[i][1] + '</div></div>';
  var spark = (d.spark && d.spark.length > 2)
    ? '<div class="sparkBox"><div class="k">ราคา 7 วัน</div>' + sparkSvg(d.spark, 280, 58, sparkColor(d.spark)) +
      '<div class="dim" style="font-size:10px">' + fmtPrice(Math.min.apply(null, d.spark)) + ' – ' + fmtPrice(Math.max.apply(null, d.spark)) + '</div></div>'
    : '';
  return '<div class="dossier"><div class="dTitle">PROJECT DOSSIER</div>' +
    (links ? '<div class="links">' + links + '</div>' : '') +
    (d.desc ? '<p class="desc">' + d.desc + '</p>' : '') +
    (spark || '') +
    (sg ? '<div class="dnaGrid">' + sg + '</div>' : '') +
    '</div>';
}
function tierChip(t) {
  var lbl = t === 't1' ? 'T1 PURE' : (t === 't2' ? 'T2 ADJ' : 'T3 INFRA');
  return '<span class="chip tier-' + t + '">' + lbl + '</span>';
}
function famChip(f) { return f ? '<span class="chip fam">' + f + '</span>' : ''; }
function archOf(d) {
  var x = (d || {}).arch;
  return x == null ? null : (typeof x === 'object' ? x.v : x);
}
function archChip(d) {
  var a = archOf(d);
  if (!a) return '';
  var cls = a === 'value-transfer' ? 'tier-t1' : (a === 'transport' ? 'tier-t2' : 'tier-t3');
  return '<span class="chip ' + cls + '" title="แยก leaderboard ตามสถาปัตยกรรม — ห้ามเทียบข้ามกลุ่ม">' + a + '</span>';
}
function geneCell(v) {
  if (v === 2) return '<span class="gene g2">FULL</span>';
  if (v === 1) return '<span class="gene g1">OPT</span>';
  return '<span class="gene g0">—</span>';
}
function gradeOf(d) {
  if (!d || d.hs == null) return null;
  var denom = 8 - (d.nst ? 2 : 0);
  // clamp: bad data (e.g. nst=1 with hst>0) must never push the score above the 100 cap
  var cov = Math.min(((d.hs || 0) + (d.hr || 0) + (d.ha || 0) + (d.hst || 0)) / denom, 1);
  return Math.round(cov * 60 + (d.man ? 15 : 0) + (d.tl ? 15 : 0) + (d.big ? 10 : 0));
}
function gradeLetter(s) {
  if (s == null) return '—';
  if (s >= 85) return 'A+';
  if (s >= 70) return 'A';
  if (s >= 55) return 'B';
  if (s >= 40) return 'C';
  return 'D';
}
function gradeCls(s) {
  if (s == null) return 'g0';
  if (s >= 85) return 'gA';
  if (s >= 70) return 'gB';
  if (s >= 55) return 'gC';
  return 'gD';
}

function renderStats() {
  var mcap = 0, nA = 0, n1y = 0;
  for (var i = 0; i < DATA.length; i++) {
    var c = DATA[i];
    mcap += (c.m || 0);
    if (c.c1y != null) n1y++;
    var g = gradeOf(dna(c));
    if (g != null && g >= 70) nA++;
  }
  var med = STATS.median_1y;
  $('statsbar').innerHTML =
    '<div class="stat">PURE PRIVACY <b>' + DATA.length + '</b> assets</div>' +
    '<div class="stat">mcap รวม <b>$' + (mcap / 1e9).toFixed(2) + 'B</b></div>' +
    '<div class="stat">DNA grade A ขึ้นไป <b>' + nA + '</b></div>' +
    '<div class="stat">DNA profiles <b>' + STATS.n_dna + '</b></div>' +
    '<div class="stat">median 1Y <b>' + (med == null ? 'n/a' : (med > 0 ? '+' : '') + med.toFixed(0) + '%') + '</b></div>' +
    '<div class="stat">ตัดออก <b>' + STATS.n_cut + '</b> (ไม่ใช่ privacy แท้)</div>' +
    '<div class="stat">snapshot <b>' + STATS.snap + '</b></div>' +
    '<button id="liveBtn" title="ดึงราคาสดจาก CoinGecko">⟳ LIVE</button>' +
    '<span id="liveStatus"></span>';
  $('liveBtn').onclick = liveRefresh;
}

var SPOT = ['ZEC', 'XMR', 'AZTEC', 'ZAMA', 'RAIL', 'NIGHT', 'DASH', 'FIRO', 'ARRR', 'DERO', 'TORN'];
var CHIPS = { 'TORN': ['SANCTIONED', 'r'], 'AZTEC': ['ALPHA · VULN DISCLOSED', 'a'], 'XMR': ['NO ETF', ''], 'ZEC': ['ETF · ZCSH', 'a'], 'SCRT': ['TEE-NOT-ZK', 'a'] };

function renderSpot() {
  var out = [];
  for (var i = 0; i < SPOT.length; i++) {
    var c = null;
    for (var j = 0; j < DATA.length; j++) if (DATA[j].s === SPOT[i]) { c = DATA[j]; break; }
    if (!c) continue;
    var q = cur(c.s);
    var note = (q.note || '').length > 110 ? q.note.slice(0, 110) + '…' : (q.note || '');
    var chips = '';
    if (CHIPS[c.s]) chips = '<span class="chip ' + CHIPS[c.s][1] + '">' + CHIPS[c.s][0] + '</span>';
    out.push('<div class="card ' + (c.s === 'TORN' ? 'risk' : '') + '">' +
      '<span class="cs">' + c.s + '</span><span class="cn">' + c.n + '</span>' +
      '<div class="cp num">' + fmtPrice(c.p) + '</div>' +
      '<div class="chg num">24h ' + fmtPct(c.c24) + ' &nbsp;·&nbsp; 1Y ' + fmtPct(c.c1y) + '</div>' +
      '<div>' + badge(q.model) + chips + '</div>' +
      '<div class="note">' + (q.mech || '') + (note ? ' — ' + note : '') + '</div></div>');
  }
  $('spotCards').innerHTML = out.join('');
}

function hayOf(c) {
  var k = cur(c.s), dd = dna(c);
  return (c.s + ' ' + c.n + ' ' + grpOf(c) + ' ' + (k.mech || '') + ' ' + (k.note || '') + ' ' + (k.access || '') + ' ' +
    (dd.fam || '') + ' ' + (dd.prim || '') + ' ' + (dd.hides || '') + ' ' + (dd.trust || '') + ' ' + (dd.anonset || '') + ' ' +
    (dd.sec || '') + ' ' + (dd.comp || '') + ' ' + (dd.stage || '') + ' ' + (dd.setup || '') + ' ' + (dd.audit || '') + ' ' +
    (dd.gov || '') + ' ' + (dd.risk || '')).toLowerCase();
}
function matchesQuery(c) {
  if ((c.m || 0) < state.minMcap) return false;
  if (state.minGrade) {
    var gr = gradeOf(dna(c));
    if (gr == null || gr < state.minGrade) return false;
  }
  var q = state.q.trim().toLowerCase();
  if (q && hayOf(c).indexOf(q) < 0) return false;
  return true;
}
function passFilter(c) { return matchesQuery(c); }
function sortVal(c, k) {
  if (k === 's' || k === 'n') return c.s;
  var v = c[k];
  return (v == null ? -1e18 : v);
}
function dnaPanel(c) {
  var d = dna(c), q = cur(c.s), g = gradeOf(d);
  var head = '<div class="dnaHead"><b>' + c.s + '</b><span class="dim">' + c.n + '</span>' +
    '<span class="chip">' + (c.g || 'proto') + '</span>' + archChip(d) + famChip(d.fam) + badge(q.model) +
    (g == null ? '' : '<span class="' + gradeCls(g) + '">DNA ' + g + '/100 · ' + gradeLetter(g) + '</span>') + '</div>';
  var strip = '<div class="geneRow"><span class="lbl">ซ่อน:</span>' +
    '<span class="lbl">ผู้ส่ง</span>' + geneCell(d.hs) +
    '<span class="lbl">ผู้รับ</span>' + geneCell(d.hr) +
    '<span class="lbl">จำนวน</span>' + geneCell(d.ha) +
    '<span class="lbl">state</span>' + geneCell(d.hst) +
    '<span class="lbl">· บังคับใช้</span>' + (d.man ? '<span class="gene g2">YES</span>' : '<span class="gene g1">OPT</span>') +
    '<span class="lbl">trustless</span>' + (d.tl ? '<span class="gene g2">YES</span>' : '<span class="gene g0">NO</span>') + '</div>';
  function kv(k, v) { return v ? '<div><div class="k">' + k + '</div><div class="v">' + v + '</div></div>' : ''; }
  var grid = '<div class="dnaGrid">' +
    kv('primitive (แกนคริปโต)', d.prim) +
    kv('hides (ซ่อนอะไรจริง)', d.hides) +
    kv('trust assumption', d.trust) +
    kv('trusted setup', d.setup) +
    kv('anonymity set / pool', d.anonset) +
    kv('audit', d.audit) +
    kv('governance', d.gov) +
    kv('security history', d.sec) +
    kv('compliance / access', d.comp || q.access) +
    kv('stage', d.stage) +
    kv('ปี mainnet', d.yr ? String(d.yr) : '') +
    kv('ไทม์ไลน์สำคัญ', d.hist) +
    kv('ความเสี่ยงหลัก', d.risk) +
    kv('notes', q.note) +
    '</div>';
  return head + strip + grid + v3Block(c) + dossierHtml(c);
}

/* v3 surface: DNA v2 (engine/score.js) + red flags (engine/flags.js)
 * v2 is PREVIEW: the new genes are still being populated, so v1 remains the score the UI ranks on. */
function v3Block(c) {
  var d = dna(c), det_ = det(c), out = '';
  var p2 = null;
  try { p2 = scoreP(d); } catch (e) { p2 = null; }
  var v1 = null;
  try { v1 = scoreV1(d); } catch (e) { v1 = null; }

  if (p2) {
    var pct = Math.round(p2.coverage * 100);
    out += '<div class="v3"><div class="v3t">DNA v2 <span class="dim">(' + p2.version + ')</span> <span class="chip fl-MED">PREVIEW</span></div>';
    var imp = p2.imputed || [];
    if (p2.insufficient) {
      out += '<div class="dim" style="font-size:11px">ข้อมูลไม่พอสำหรับจัดอันดับ (มีข้อมูล ' + pct + '% ของน้ำหนัก — ขาด: ' + p2.missing.join(', ') + ') → ตัวเลขนี้ไม่ใช้จัดอันดับ ใช้คะแนน v1 แทน</div>';
    } else {
      out += '<div class="v3score">P = <b>' + p2.P + '</b> / 100 <span class="dim">± ' + p2.band + '</span> <span class="dim">· ข้อมูลจริง ' + pct + '% · conf ' + p2.conf + '</span></div>';
    }
    out += '<div class="v3parts">' + Object.keys(p2.parts).map(function (k) {
        var v = p2.parts[k];
        if (v == null) return '<span class="chip">' + k + ' ?</span>';
        var isImp = imp.indexOf(k) >= 0;
        return '<span class="chip' + (v < 0 ? ' tier-t1' : (isImp ? ' imp' : '')) + '"' +
          (isImp ? ' title="ค่าประมาณฐานล่าง: ยังไม่มีหลักฐาน aset — น้ำหนักนี้ยังอยู่ในตัวหาร แต่ได้ 0 คะแนน (ไม่ให้เครดิตฟรี)"' : '') + '>' +
          k + ' ' + (v > 0 ? '+' : '') + v + (isImp ? ' ฐานล่าง' : '') + '</span>';
      }).join('') + '</div>';
    if (imp.length) {
      out += '<div class="dim" style="font-size:10px">มี component ที่ยังไม่มีหลักฐาน: <b>' + imp.join(', ') + '</b> — คิดเป็นค่าฐานล่าง (0) โดยไม่ตัดน้ำหนักออกจากตัวหาร เพื่อไม่ให้เหรียญที่ไม่มีหลักฐานได้คะแนนฟรี</div>';
    }
    out += '<div class="dim" style="font-size:10px">คะแนนที่ใช้จัดอันดับจริง = v1 ' + (v1 == null ? '—' : v1 + ' / 100') + ' · v2 (' + p2.version + ') ต้องมีหลักฐาน ≥ 80% จึงมีสิทธิ์ถูกจัดอันดับ</div>';
    out += '</div>';
  }

  var fl = [];
  try { fl = evaluateFlags(metricsFor(c, det_, d)); } catch (e) { fl = []; }
  out += '<div class="v3"><div class="v3t">RED FLAGS <span class="dim">(' + fl.length + ')</span></div>';
  if (fl.length) {
    out += '<div class="v3flags">' + fl.map(function (f) { return '<span class="chip fl-' + f.lv + '">' + f.lv + ' · ' + f.id + '</span> '; }).join('') + '</div>' +
      '<div class="dim" style="font-size:10px">' + fl.map(function (f) { return f.msg; }).join(' · ') + '</div>';
  } else {
    out += '<div class="dim" style="font-size:10px">ไม่พบ flag จากเกณฑ์ปัจจุบัน (threshold เป็นค่าตั้งต้น ปรับได้ที่ engine/flags.js)</div>';
  }
  if (det_ && det_.repo_note) out += '<div class="dim" style="font-size:10px">! ' + det_.repo_note + '</div>';
  out += '</div>';

  /* --- pillars D / L + composite: the part that turns "strong mechanism" into "worth looking at" */
  var pl = null;
  try { pl = pillarsOf(d, c, det_, ASOF_DATE); } catch (e) { pl = null; }
  if (pl) {
    var pos = [];
    try { pos = evaluatePositives(metricsFor(c, det_, d)); } catch (e) { pos = []; }
    var dd = pl.Ddetail;
    out += '<div class="v3"><div class="v3t">PILLAR D · L · T · S · R <span class="dim">(developer · liquidity · maturity · security · regulatory)</span></div><div class="v3parts">' +
      plChip('D', pl.D) + plChip('L', pl.L) + plChip('T', pl.T) + plChip('S', pl.S) + plChip('P', pl.P) +
      '</div>';
    if (dd) {
      out += '<div class="dim" style="font-size:10px">' + (dd.repo || 'repo ไม่ระบุ') + ' · push ล่าสุด ' + dd.pushed +
        ' (' + dd.days + ' วันที่แล้ว)' + (dd.archived ? ' · <span class="chip fl-CRITICAL">archived</span>' : '') +
        (dd.stars ? ' · ★ ' + dd.stars : '') + '</div>';
    } else {
      out += '<div class="dim" style="font-size:10px">ไม่มี repo ที่ยืนยันได้ — pillar D ประเมินไม่ได้ (D เป็นตัวแทนของความเคลื่อนไหวจากวันที่ push และสถานะ archive เพราะ GitHub GraphQL pass ยังอยู่ใน roadmap)</div>';
    }
    var cr = compositeRank(c), cb = compositeRank(c, 'investor');
    if (cr) {
      out += '<div class="dim" style="font-size:10px">composite = <b>' + cr.v + '</b> / 100 → อันดับ <b>' + cr.r + '/' + cr.n +
        '</b> <span class="dim">(preset privacy-investor: P 45 / D 30 / L 25 · preset investor ของ blueprint: ' +
        (cb ? cb.v + ' → #' + cb.r : 'n/a') + ')</span></div>';
    }
    if (pos.length) {
      out += '<div class="v3flags">' + pos.map(function (f) { return '<span class="chip b-sel">+ ' + f.id + '</span> '; }).join('') + '</div>' +
        '<div class="dim" style="font-size:10px">' + pos.map(function (f) { return f.msg; }).join(' · ') + '</div>';
    }
    out += '</div>';
  }
  return out;
}

/* D/L/P chip: >=55 shown as a strength colour, null shown as unavailable (never as 0) */
function plChip(k, v) {
  if (v == null) return '<span class="chip" title="ประเมินไม่ได้ — ข้อมูลไม่พอ">' + k + ' ?</span>';
  return '<span class="chip' + (v >= 55 ? ' b-sel' : '') + '">' + k + ' ' + v + '</span>';
}

var _compCache = null;
function compositeRank(c, preset) {
  var key = preset || 'privacy_investor';
  if (!_compCache) _compCache = {};
  if (!_compCache[key]) {
    var cache = { bySym: {}, n: 0 };
    var list = [];
    for (var i = 0; i < DATA.length; i++) {
      var x = DATA[i], s = null;
      try { s = compositeOf(dna(x), x, det(x), ASOF_DATE, key, key === 'privacy_investor'); } catch (e) { s = null; }
      if (s != null) list.push([x.s, s]);
    }
    list.sort(function (a, b) { return b[1] - a[1]; });
    cache.n = list.length;
    for (var j = 0; j < list.length; j++) cache.bySym[list[j][0]] = { v: list[j][1], r: j + 1 };
    _compCache[key] = cache;
  }
  var e = _compCache[key].bySym[c.s];
  return e ? { v: e.v, r: e.r, n: _compCache[key].n } : null;
}

function renderTable() {
  var mw = $('matrixWrap'), tw = $('tblWrap');
  var dw = $('docsWrap');
  if (state.view === 'docs') {
    if (tw) tw.style.display = 'none';
    if (mw) mw.style.display = 'none';
    if (dw) { dw.style.display = 'block'; renderDocs(); }
    return;
  }
  if (dw) dw.style.display = 'none';
  if (state.view === 'compare') {
    if (tw) tw.style.display = 'none';
    if (mw) mw.style.display = 'none';
    var cw = $('cmpWrap');
    if (cw) { cw.style.display = 'block'; renderCompare(); }
    return;
  }
  var cw2 = $('cmpWrap');
  if (cw2) cw2.style.display = 'none';
  if (state.view === 'matrix') {
    if (tw) tw.style.display = 'none';
    if (mw) mw.style.display = 'block';
    renderMatrix();
    return;
  }
  if (tw) tw.style.display = 'block';
  if (mw) mw.style.display = 'none';
  view = [];
  for (var i = 0; i < DATA.length; i++) if (passFilter(DATA[i])) view.push(DATA[i]);
  view.sort(function (a, b) {
    var x = sortVal(a, state.sortKey), y = sortVal(b, state.sortKey);
    if (typeof x === 'string') return state.dir * x.localeCompare(y);
    return state.dir * (x - y);
  });
  var rows = [];
  for (var j = 0; j < view.length; j++) {
    var c = view[j], k = cur(c.s), d = dna(c);
    var supply = '—';
    if (c.cs) {
      supply = c.ms
        ? fmtNum(c.cs) + ' / ' + fmtNum(c.ms) + ' <span class="dim">' + Math.round(100 * c.cs / c.ms) + '%</span>'
        : fmtNum(c.cs) + ' / ∞';
    }
    var sel = (j === state.sel ? ' sel' : '');
    rows.push('<tr data-sym="' + c.s + '" class="row' + sel + '">' +
      '<td class="num dim">' + (j + 1) + '</td>' +
      '<td class="coin">' + (c.img ? '<img src="' + c.img + '" alt="">' : '') + '<span class="sym">' + c.s + '</span><span class="nm">' + c.n + '</span>' +
      (det(c).spark && det(c).spark.length > 2 ? sparkSvg(det(c).spark, 56, 14, sparkColor(det(c).spark)) : '') + '</td>' +
      '<td class="num">' + fmtPrice(c.p) + '</td>' +
      '<td class="num">' + fmtPct(c.c24) + '</td>' +
      '<td class="num">' + fmtPct(c.c7) + '</td>' +
      '<td class="num">' + fmtPct(c.c30) + '</td>' +
      '<td class="num">' + fmtPct(c.c1y) + '</td>' +
      '<td class="num">' + (c.m == null ? '—' : '$' + fmtCompact(c.m)) + '</td>' +
      '<td class="num dim">' + (c.v ? '$' + fmtCompact(c.v) : '—') + '</td>' +
      '<td class="num">' + supply + '</td>' +
      '<td><span class="chip">' + grpOf(c) + '</span> <span class="' + gradeCls(gradeOf(d)) + '">' + (gradeOf(d) == null ? '—' : gradeLetter(gradeOf(d))) + '</span></td>' +
      '<td class="prim">' + famChip(d.fam) + (d.prim ? d.prim : '<span class="dim">— ยังไม่มี DNA profile</span>') + '</td>' +
      '<td>' + badge(k.model) + '</td>' +
      '<td class="cmpCell"><button class="cmpBtn' + (state.compare.indexOf(c.s) >= 0 ? ' on' : '') + '" data-cmp="' + c.s + '" ' +
      'title="' + (state.compare.indexOf(c.s) >= 0 ? 'เอาออกจากเครื่องมือเปรียบเทียบ' : 'เพิ่มลงเครื่องมือเปรียบเทียบ (2–4 ตัว)') + '">⇄</button></td>' +
      '</tr>');
    if (state.expanded === c.s) {
      rows.push('<tr class="exp"><td colspan="14">' + dnaPanel(c) + '</td></tr>');
    }
  }
  $('tbody').innerHTML = rows.join('');
  $('count').textContent = view.length + ' / ' + DATA.length + ' assets';
  var btns = $('tbody').querySelectorAll ? $('tbody').querySelectorAll('.cmpBtn') : [];
  for (var bi = 0; bi < btns.length; bi++) {
    btns[bi].onclick = (function (btn) {
      return function () {
        var sym = btn.getAttribute('data-cmp');
        var i = state.compare.indexOf(sym);
        if (i >= 0) state.compare.splice(i, 1);
        else if (state.compare.length < 4) state.compare.push(sym);
        renderViewSwitch(); renderTable();
      };
    })(btns[bi]);
  }
}

function renderMatrix() {
  var rows = [];
  for (var i = 0; i < DATA.length; i++) if (matchesQuery(DATA[i])) rows.push(DATA[i]);
  rows.sort(function (a, b) { return (gradeOf(dna(b)) == null ? -1 : gradeOf(dna(b))) - (gradeOf(dna(a)) == null ? -1 : gradeOf(dna(a))); });
  var out = [];
  out.push('<div class="rubric"><b>DNA Matrix — เกณฑ์คิดคะแนน (โปร่งใส คำนวณสดจาก gene flags):</b><br>' +
    'coverage = (ซ่อนผู้ส่ง + ผู้รับ + จำนวน + state) ÷ คะแนนเต็มของกลุ่มนั้น × 60 &nbsp;+&nbsp; บังคับใช้ทุก tx (mandatory) 15 &nbsp;+&nbsp; ' +
    'ไม่ต้องเชื่อใคร (no trusted setup / TEE / committee) 15 &nbsp;+&nbsp; anonymity set = ทั้งเครือข่าย 10 → <b>เต็ม 100</b><br>' +
    '<b>หมายเหตุ:</b> สกุลเงินล้วน (ZEC / XMR / GRIN …) ไม่มี gene state เพราะไม่มี smart contract → หารด้วย 6 แทน 8 เพื่อไม่ให้ถูกตัดคะแนนโดยธรรมชาติ<br>' +
    '<b>เกรด:</b> A+ ≥85 · A ≥70 · B ≥55 · C ≥40 · D ต่ำกว่า 40 — คะแนนนี้วัด "ความแข็งของกลไก privacy" ตามเกณฑ์ข้างต้น ' +
    'ไม่ใช่การวัดมูลค่า การลงทุน หรือความน่าเชื่อถือของทีม · เหรียญ network-layer (NYM/HOPR/SESH) ซ่อน metadata/IP ไม่ใช่ยอดโอน จึงได้คะแนนต่ำโดยธรรมชาติ</div>');
  out.push('<table class="mx"><thead><tr>' +
    '<th>#</th><th>Coin</th><th>กลุ่ม</th><th>primitive family</th>' +
    '<th>ผู้ส่ง</th><th>ผู้รับ</th><th>จำนวน</th><th>State</th><th>บังคับ</th><th>trustless</th><th>anon set</th>' +
    '<th>setup / trust</th><th>ปี</th><th>เกรด</th><th>ประวัติความปลอดภัย</th><th>ความเสี่ยงหลัก</th>' +
    '</tr></thead><tbody>');
  for (var j = 0; j < rows.length; j++) {
    var c = rows[j], d = dna(c), g = gradeOf(d);
    out.push('<tr data-sym="' + c.s + '" class="row">' +
      '<td class="num dim">' + (j + 1) + '</td>' +
      '<td class="coin"><span class="sym">' + c.s + '</span><span class="nm">' + c.n + '</span></td>' +
      '<td><span class="chip">' + grpOf(c) + '</span> ' + archChip(d) + '</td>' +
      '<td>' + famChip(d.fam) + '</td>' +
      '<td>' + geneCell(d.hs) + '</td>' +
      '<td>' + geneCell(d.hr) + '</td>' +
      '<td>' + geneCell(d.ha) + '</td>' +
      '<td>' + geneCell(d.hst) + '</td>' +
      '<td>' + (d.man ? '<span class="gene g2">YES</span>' : '<span class="gene g1">OPT</span>') + '</td>' +
      '<td>' + (d.tl ? '<span class="gene g2">YES</span>' : '<span class="gene g0">NO</span>') + '</td>' +
      '<td>' + (d.big ? '<span class="gene g2">NETWORK</span>' : '<span class="gene g1">POOL</span>') + '</td>' +
      '<td class="wide">' + (d.setup || '—') + '</td>' +
      '<td class="num dim">' + (d.yr || '—') + '</td>' +
      '<td class="' + gradeCls(g) + '">' + (g == null ? '—' : g + ' · ' + gradeLetter(g)) + '</td>' +
      '<td class="wide">' + (d.sec || '—') + '</td>' +
      '<td class="wide">' + (d.risk || '—') + '</td>' +
      '</tr>');
  }
  out.push('</tbody></table>');
  $('matrixWrap').innerHTML = out.join('');
  $('count').textContent = rows.length + ' / ' + DATA.length + ' assets (DNA matrix)';
}
function markSort() {
  var ths = document.querySelectorAll('thead th');
  for (var i = 0; i < ths.length; i++) {
    var th = ths[i];
    var base = th.getAttribute('data-label') || th.textContent;
    th.setAttribute('data-label', base);
    th.textContent = base + (th.getAttribute('data-k') === state.sortKey ? ' ' + (state.dir === 1 ? '▲' : '▼') : '');
  }
}

var LIVE_CATS = [['privacy', 'all'], ['privacy-coins', 'pc'], ['zero-knowledge-zk', 'zk'], ['privacy-infrastructure', 'pi'], ['privacy-blockchain', 'pb']];
function recFrom(c, tag) {
  return {
    id: c.id, s: c.symbol.toUpperCase(), n: c.name,
    p: c.current_price, m: c.market_cap, v: c.total_volume,
    c24: c.price_change_percentage_24h_in_currency,
    c7: c.price_change_percentage_7d_in_currency,
    c30: c.price_change_percentage_30d_in_currency,
    c1y: c.price_change_percentage_1y_in_currency,
    cs: c.circulating_supply, ms: c.max_supply, img: c.image,
    tags: tag === 'all' ? [] : [tag], priv: tag === 'all',
    tier: (IDMAP[c.id] && IDMAP[c.id].tier) || TIERMAP[c.symbol.toUpperCase()] || 't3',
    dna: (IDMAP[c.id] && IDMAP[c.id].dna) || 0
  };
}
function augment() {
  for (var i = 0; i < DATA.length; i++) {
    var c = DATA[i];
    if (c.priv && CUR[c.s] && c.tags.indexOf('pc') < 0) c.tags.push('pc');
  }
}
function liveRefresh() {
  var btn = $('liveBtn');
  btn.classList.add('busy'); btn.textContent = '… FETCHING';
  $('liveStatus').textContent = '';
  var ps = [];
  for (var i = 0; i < LIVE_CATS.length; i++) {
    (function (i) {
      var tag = LIVE_CATS[i][1];
      ps.push(fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=' + LIVE_CATS[i][0] + '&order=market_cap_desc&per_page=250&page=1&price_change_percentage=24h,7d,30d,1y')
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (arr) { return arr.map(function (c) { return recFrom(c, tag); }); }));
    })(i);
  }
  Promise.all(ps).then(function (lists) {
    var byId = {};
    for (var i = 0; i < lists.length; i++) for (var j = 0; j < lists[i].length; j++) {
      var r = lists[i][j];
      if (byId[r.id]) { if (r.tags.length && byId[r.id].tags.indexOf(r.tags[0]) < 0) byId[r.id].tags.push(r.tags[0]); }
      else byId[r.id] = r;
    }
    var out = [];
    for (var k in byId) out.push(byId[k]);
    out.sort(function (a, b) { return (b.m || 0) - (a.m || 0); });
    out = out.filter(function (r) { return IDMAP[r.id]; });
    DATA = out;
    augment();
    state.sel = -1;
    renderStats(); renderSpot(); renderTable();
    $('liveStatus').textContent = 'LIVE OK · ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC · ' + DATA.length + ' assets';
    btn.classList.remove('busy'); btn.textContent = '⟳ LIVE';
  }).catch(function (err) {
    $('liveStatus').textContent = 'LIVE ไม่สำเร็จ (' + err.message + ') — ใช้ snapshot';
    btn.classList.remove('busy'); btn.textContent = '⟳ LIVE';
  });
}

/* third view: documents + data index, rendered from the same bundle (no separate page) */
function renderDocs() {
  var dw = $('docsWrap');
  if (!dw) return;
  var d = DOCSPAY || { docs: [], idx: [] };
  if (!d.docs.length) { dw.innerHTML = '<p class="dim">ไม่พบเอกสารในบันเดิล</p>'; return; }
  var tabs = d.docs.map(function (x, i) {
    return '<button data-pane="dp' + i + '" class="' + (i === 0 ? 'on' : '') + '">' + x.t + '</button>';
  }).join('');
  var panes = d.docs.map(function (x, i) {
    return '<section class="docpane' + (i === 0 ? ' on' : '') + '" id="dp' + i + '">' +
      '<div class="srcLine">' + x.p + ' · ' + x.b + ' · <a href="' + x.p + '" target="_blank" rel="noopener">raw ↗</a></div>' +
      x.h + '</section>';
  }).join('');
  var cols = (d.idx || []).map(function (sec) {
    var items = sec.items.map(function (f) {
      return '<li><a href="' + f.p + '" target="_blank" rel="noopener">' + f.p + '</a> <span class="sz">' + f.s + '</span></li>';
    }).join('');
    return '<div class="idxCol"><h3>' + sec.n + '</h3><ul>' + items + '</ul></div>';
  }).join('');
  dw.innerHTML = '<div class="dtabs">' + tabs + '</div>' + panes +
    '<h2 style="margin-top:22px">ไฟล์ทั้งหมดในโปรเจกต์</h2><div class="idxGrid">' + cols + '</div>';
  var btns = dw.querySelectorAll ? dw.querySelectorAll('.dtabs button') : [];
  for (var i = 0; i < btns.length; i++) {
    btns[i].onclick = function () {
      var all = dw.querySelectorAll('.dtabs button');
      for (var j = 0; j < all.length; j++) all[j].classList.remove('on');
      var panesAll = dw.querySelectorAll('.docpane');
      for (var k = 0; k < panesAll.length; k++) panesAll[k].classList.remove('on');
      this.classList.add('on');
      var target = document.getElementById(this.getAttribute('data-pane'));
      if (target) target.classList.add('on');
    };
  }
}

/* ---- Compare view: radar over the six pillars + a gene-by-gene table -------------------------
 * Enabled once 2-4 coins are selected with the ⇄ button. The radar is the "profile shape" — which
 * pillar carries a coin and which one is missing — and the table underneath is the evidence for
 * every axis, because a shape alone is not a finding. */
var CMP_COLORS = ['#4cc2ff', '#2ecc71', '#f5a623', '#b48cff'];
var CMP_PILLARS = [
  ['P', 'Privacy'], ['D', 'Developer'], ['L', 'Liquidity'],
  ['T', 'Maturity'], ['S', 'Security'], ['R', 'Regulatory']
];
var CMP_GENES = ['arch', 'hs', 'hr', 'ha', 'hst', 'nst', 'man', 'tl', 'hmeta', 'hnet',
                 'mat', 'pq', 'brk', 'audit', 'comp', 'sanctioned', 'aset', 'yr'];

function cmpCoins() {
  return state.compare.map(function (sym) { return DATA.find(function (c) { return c.s === sym; }); })
                     .filter(function (c) { return !!c; });
}

function cmpPillars(c) {
  var pl = null;
  try { pl = pillarsOf(dna(c), c, det(c), ASOF_DATE); } catch (e) { pl = null; }
  if (!pl) return null;
  return [pl.P, pl.D, pl.L, pl.T, pl.S, pl.R];
}

function radarSvg(series) {
  var W = 430, H = 400, cx = W / 2, cy = H / 2 + 6, R = 138, n = CMP_PILLARS.length;
  function pt(i, v) {
    var a = -Math.PI / 2 + i * 2 * Math.PI / n;
    var r = (Math.max(0, Math.min(100, v == null ? 0 : v)) / 100) * R;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img">';
  [25, 50, 75, 100].forEach(function (ring) {
    var p = [];
    for (var i = 0; i < n; i++) p.push(pt(i, ring).join(','));
    out += '<polygon points="' + p.join(' ') + '" fill="none" stroke="#1c2733" stroke-width="1"/>';
  });
  for (var i = 0; i < n; i++) {
    var e = pt(i, 100);
    out += '<line x1="' + cx + '" y1="' + cy + '" x2="' + e[0].toFixed(1) + '" y2="' + e[1].toFixed(1) + '" stroke="#1c2733"/>';
    var l = pt(i, 122);
    out += '<text x="' + l[0].toFixed(1) + '" y="' + l[1].toFixed(1) + '" fill="#8b93a0" font-size="11" ' +
           'text-anchor="' + (l[0] > cx + 4 ? 'start' : (l[0] < cx - 4 ? 'end' : 'middle')) + '" ' +
           'dominant-baseline="middle" font-family="monospace">' + CMP_PILLARS[i][0] + '</text>';
  }
  series.forEach(function (sr, si) {
    var pts = [];
    for (var k = 0; k < n; k++) {
      var p = pt(k, sr.vals[k]);
      pts.push(p[0].toFixed(1) + ',' + p[1].toFixed(1));
      out += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="' + sr.color + '"/>';
    }
    out += '<polygon points="' + pts.join(' ') + '" fill="' + sr.color + '" fill-opacity="0.13" stroke="' + sr.color + '" stroke-width="1.8"/>';
  });
  return out + '</svg>';
}

function geneCell(d, gene) {
  var x = d ? d[gene] : null;
  if (x == null) return '<td class="null">—</td>';
  var v = (typeof x === 'object') ? x.v : x;
  var conf = (x && typeof x === 'object') ? (x.conf || 'low') : 'low';
  if (v == null) return '<td class="null">—</td>';
  var mark = conf === 'high' ? '' : (conf === 'med' ? '·' : '··');
  var cls = 'v' + (conf === 'high' ? '' : (conf === 'med' ? ' lo' : ' lol'));
  return '<td class="' + cls + '" title="conf=' + conf + '">' + v + mark + '</td>';
}

function renderCompare() {
  var cw = $('cmpWrap');
  if (!cw) return;
  var coins = cmpCoins();
  if (coins.length < 2) {
    cw.innerHTML = '<div class="cmpEmpty">เลือกเหรียญ 2–4 ตัวจากปุ่ม <b>⇄</b> ในมุมขวาของตารางก่อน ' +
      '(ตอนนี้เลือกแล้ว ' + coins.length + ')</div>';
    return;
  }
  var series = coins.map(function (c, i) {
    return { c: c, color: CMP_COLORS[i % CMP_COLORS.length], vals: cmpPillars(c) || [] };
  });
  var head = '<div class="cmpHead"><h2>เปรียบเทียบ ' + coins.length + ' โครงการ</h2>' +
    '<span class="dim">เรดาร์ = รูปร่างของ 6 pillar (ยิ่งออกดูกว้างยิ่งสมดุล) · ตารางล่าง = หลักฐานของทุกแกน ' +
    '(· = conf med · ·· = conf low · ไม่มีจุด = conf high · — = ไม่มีค่า)</span>' +
    '<span class="dim" style="margin-left:auto"><button class="cmpBtn" id="cmpClear">ล้างทั้งหมด</button></span></div>';
  var legend = '<div class="cmpLegend">' + series.map(function (sr) {
    return '<span><i style="background:' + sr.color + '"></i>' + sr.c.s + ' ' + sr.c.n + '</span>';
  }).join('') + '</div>';
  var rowsHtml = '';
  CMP_PILLARS.forEach(function (pl, i) {
    rowsHtml += '<tr class="hl"><td class="k">' + pl[1] + ' (' + pl[0] + ')</td>' +
      series.map(function (sr) { return '<td class="v">' + (sr.vals[i] == null ? '—' : sr.vals[i]) + '</td>'; }).join('') + '</tr>';
  });
  CMP_GENES.forEach(function (gene) {
    rowsHtml += '<tr><td class="k">' + gene + '</td>' +
      series.map(function (sr) { return geneCell(dna(sr.c), gene); }).join('') + '</tr>';
  });
  var table = '<table class="gtbl"><tr><th>gene / pillar</th>' +
    series.map(function (sr) { return '<th>' + sr.c.s + '</th>'; }).join('') + '</tr>' + rowsHtml + '</table>';
  cw.innerHTML = head + legend +
    '<div class="cmpGrid"><div class="cmpRadar">' + radarSvg(series) + '</div>' + table + '</div>';
  var cl = document.getElementById('cmpClear');
  if (cl) cl.onclick = function () { state.compare = []; state.view = 'table'; renderViewSwitch(); renderTable(); };
}

function renderViewSwitch() {
  $('vsw').innerHTML =
    '<button id="vTable" class="' + (state.view === 'table' ? 'on' : '') + '">ตาราง · ' + DATA.length + ' เหรียญ</button>' +
    '<button id="vMatrix" class="' + (state.view === 'matrix' ? 'on' : '') + '">DNA Matrix</button>' +
    '<button id="vDocs" class="' + (state.view === 'docs' ? 'on' : '') + '">เอกสาร &amp; ข้อมูล</button>' +
    '<button id="vCmp" class="' + (state.view === 'compare' ? 'on' : '') + '"' +
    (state.compare.length < 2 ? ' disabled title="เลือกเหรียญ 2–4 ตัวจากปุ่ม ⇄ ในตารางก่อน"' : '') + '>เปรียบเทียบ (' + state.compare.length + ')</button>';
  $('vTable').onclick = function () { state.view = 'table'; renderViewSwitch(); renderTable(); };
  $('vMatrix').onclick = function () { state.view = 'matrix'; renderViewSwitch(); renderTable(); };
  $('vDocs').onclick = function () { state.view = 'docs'; renderViewSwitch(); renderTable(); };
  $('vCmp').onclick = function () { if (state.compare.length >= 2) { state.view = 'compare'; renderViewSwitch(); renderTable(); } };
}

function init() {
  for (var t = 0; t < DATA.length; t++) { TIERMAP[DATA[t].s] = DATA[t].tier || 't3'; IDMAP[DATA[t].id] = { tier: DATA[t].tier || 't3', dna: DATA[t].dna || 0 }; }
  augment();
  renderStats(); renderSpot(); renderViewSwitch(); renderTable(); markSort();
  $('q').addEventListener('input', function () { state.q = this.value; state.sel = -1; renderTable(); });
  $('minMcap').addEventListener('change', function () { state.minMcap = parseFloat(this.value) || 0; renderTable(); });
  $('minGrade').addEventListener('change', function () { state.minGrade = parseFloat(this.value) || 0; renderTable(); });
  $('tbody').addEventListener('click', function (e) {
    var tr = e.target;
    while (tr && tr.tagName !== 'TR') tr = tr.parentNode;
    if (!tr || !tr.getAttribute) return;
    var sym = tr.getAttribute('data-sym');
    if (!sym) return;
    state.expanded = (state.expanded === sym) ? null : sym;
    renderTable();
  });
  var ths = document.querySelectorAll('thead th');
  for (var i = 0; i < ths.length; i++) {
    (function (th) {
      var k = th.getAttribute('data-k');
      if (!k) return;
      th.onclick = function () {
        if (state.sortKey === k) state.dir *= -1;
        else { state.sortKey = k; state.dir = (k === 's') ? 1 : -1; }
        renderTable(); markSort();
      };
    })(ths[i]);
  }
  document.addEventListener('keydown', function (e) {
    var q = $('q');
    if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q.focus(); return; }
    if (e.key === 'Escape') { if (document.activeElement === q) { q.value = ''; state.q = ''; renderTable(); q.blur(); } return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'j' || e.key === 'k') {
      if (document.activeElement === q) return;
      e.preventDefault();
      var step = (e.key === 'ArrowDown' || e.key === 'j') ? 1 : -1;
      if (view.length) {
        state.sel = Math.max(0, Math.min(view.length - 1, state.sel < 0 ? 0 : state.sel + step));
        renderTable();
        var el = $('tbody').querySelector('tr.sel');
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
      }
    }
    if (e.key === ' ' && state.sel >= 0 && view[state.sel]) {
      e.preventDefault();
      state.expanded = (state.expanded === view[state.sel].s) ? null : view[state.sel].s;
      renderTable();
    }
    if (e.key === 'Enter' && state.sel >= 0 && view[state.sel]) {
      window.open('https://www.coingecko.com/en/coins/' + view[state.sel].id, '_blank');
    }
  });
}
init();
