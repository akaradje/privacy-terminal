var DATA = __DATA__;
var CUR = __CUR__;
var DNA = __DNA__;
var DETAIL = __DETAIL__;
var DOCSPAY = (function () { try { var el = document.getElementById('docsData'); return JSON.parse((el && el.textContent) || '{"docs":[],"idx":[]}'); } catch (e) { return { docs: [], idx: [] }; } })();
var STATS = __STATS__;
/* Snapshot date. Pillar D is a recency measure, so it must be computed against a fixed date —
 * using "now" would make the same data produce a different score tomorrow and break diffing. */
var ASOF_DATE = (STATS && STATS.snap) ? String(STATS.snap).slice(0, 10) : new Date().toISOString().slice(0, 10);
var state = {
  view: 'table', q: '', preset: 'privacy_investor', bullFilter: 'all', curOnly: false,
  targetMcap: 2.5e9, sortKey: 'm', dir: -1, minMcap: 0, minGrade: 0, sel: -1, expanded: null, compare: []
};
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
function fmtMult(m) {
  if (m == null || !isFinite(m) || m <= 0) return '—';
  if (m >= 100) return Math.round(m) + 'x';
  if (m >= 10) return m.toFixed(1) + 'x';
  return m.toFixed(2) + 'x';
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

var _evalCache = {};
function evalCoin(c) {
  if (!c) return {};
  if (_evalCache[c.s]) return _evalCache[c.s];
  var d = dna(c), dt = det(c);
  var pl = null, asy = null, fl = [], pos = [], m = {};
  try { pl = pillarsOf(d, c, dt, ASOF_DATE); } catch (e) { pl = null; }
  try { asy = asymmetryOf(d, c, dt, ASOF_DATE); } catch (e) { asy = null; }
  try {
    m = metricsFor(c, dt, d, ASOF_DATE);
    fl = evaluateFlags(m);
    pos = evaluatePositives(m);
  } catch (e) { fl = []; pos = []; }
  var posIds = pos.map(function (p) { return p.id; });
  var hasCrit = fl.some(function (f) { return f.lv === 'CRITICAL'; });
  var res = { pl: pl, asy: asy, fl: fl, pos: pos, posIds: posIds, hasCrit: hasCrit, m: m };
  _evalCache[c.s] = res;
  return res;
}

function activeScore(c, presetKey) {
  var pk = presetKey || state.preset || 'privacy_investor';
  var r = compositeRank(c, pk);
  return r ? r.v : null;
}

function archetypeBadge(arch) {
  if (!arch) return '';
  if (arch === 'ZEC-ARCHETYPE') return '<span class="chip arch-zec" title="พิมพ์เขียว ZEC: มี Viewing Key/Selective Disclosure (comp=2) + กลไกความลับจริง + โค้ด Active">ZEC-TYPE</span>';
  if (arch === 'SOVEREIGN-PRIV') return '<span class="chip arch-sov" title="Sovereign Privacy: ความลับระดับสูงสุด (Default/Mandatory) + โค้ด Active">SOVEREIGN</span>';
  if (arch === 'CONF-COMPUTE') return '<span class="chip arch-cmp" title="Confidential Compute (FHE / MPC / TEE)">COMPUTE</span>';
  if (arch === 'PRIV-NETWORK') return '<span class="chip" title="Network / Metadata Privacy (Mixnet / dVPN)">NET-PRIV</span>';
  return '<span class="chip">' + arch + '</span>';
}

function pillarMiniHtml(pl) {
  if (!pl) return '';
  var keys = ['P', 'D', 'L', 'T', 'S', 'R'];
  var tip = keys.map(function (k) { return k + ':' + (pl[k] == null ? '—' : pl[k]); }).join(' · ');
  var bars = keys.map(function (k) {
    var v = pl[k];
    var h = v == null ? 2 : Math.max(2, Math.round((v / 100) * 12));
    var col = v == null ? '#263347' : (v >= 75 ? '#3fd68c' : (v >= 55 ? '#4cc2ff' : (v >= 35 ? '#f5a623' : '#e2705f')));
    return '<i style="height:' + h + 'px;background:' + col + '"></i>';
  }).join('');
  return '<span class="pMini" title="6 Pillars (' + tip + ')">' + bars + '</span>';
}

/* Implied re-rating multiple & target price if coin reaches targetMcap */
function calcTarget(c, targetMcap) {
  if (!c || !c.m || c.m <= 0 || !c.p || c.p <= 0) return null;
  var mult = targetMcap / c.m;
  var targetPrice = c.p * mult;
  var fdvMult = mult;
  if (c.ms && c.cs && c.ms > c.cs && c.cs > 0) {
    fdvMult = targetMcap / (c.p * c.ms);
  }
  return { mult: mult, fdvMult: fdvMult, targetPrice: targetPrice };
}

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
function geneCell(x) {
  var v = (x && typeof x === 'object') ? x.v : x;
  if (v === 2) return '<span class="gene g2">FULL</span>';
  if (v === 1) return '<span class="gene g1">OPT</span>';
  return '<span class="gene g0">—</span>';
}
function gradeOf(d) {
  return scoreV1(d);
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

function matchBullMode(c, mode) {
  if (!mode || mode === 'all') return true;
  var ev = evalCoin(c);
  var pids = ev.posIds || [];
  if (mode === 'zec') return pids.indexOf('zec_archetype') >= 0 || (ev.asy && ev.asy.archetype === 'ZEC-ARCHETYPE');
  if (mode === 'gem') return pids.indexOf('asymmetric_gem') >= 0;
  if (mode === 'sov') return !!(ev.asy && ev.asy.archetype === 'SOVEREIGN-PRIV');
  if (mode === 'accum') return pids.indexOf('early_accumulation') >= 0;
  if (mode === 'safe') return !ev.hasCrit && !gval(dna(c), 'sanctioned');
  return true;
}

function renderPillBar() {
  var pb = $('pillBar');
  if (!pb) return;
  var modes = [
    ['all', 'ทั้งหมด'],
    ['zec', '🟢 พิมพ์เขียว ZEC (comp=2 · โค้ด Active)'],
    ['gem', '💎 Asymmetric Gems (Score ≥64 · Mcap <$600M)'],
    ['sov', '🛡️ Sovereign Privacy (P ≥65 · Default/Mandatory)'],
    ['accum', '🚀 สัญญาณสะสมต้นรอบ (Early Accumulation)'],
    ['safe', '✅ ไร้ CRITICAL Flag']
  ];
  var html = '<span class="pLbl">Quick Filter:</span>';
  for (var i = 0; i < modes.length; i++) {
    var m = modes[i][0], lbl = modes[i][1], cnt = 0;
    for (var j = 0; j < DATA.length; j++) if (matchBullMode(DATA[j], m)) cnt++;
    html += '<button class="fPill' + (state.bullFilter === m ? ' on' : '') + '" data-bf="' + m + '">' +
      lbl + ' <b>' + cnt + '</b></button>';
  }
  pb.innerHTML = html;
  var btns = pb.querySelectorAll ? pb.querySelectorAll('.fPill') : [];
  for (var k = 0; k < btns.length; k++) {
    btns[k].onclick = function () {
      var bf = this.getAttribute('data-bf') || 'all';
      state.bullFilter = bf;
      if ($('bullFilter')) $('bullFilter').value = bf;
      state.sel = -1;
      renderPillBar();
      renderTable();
    };
  }
}

function renderStats() {
  var mcap = 0, nA = 0, nZecType = 0, nGem = 0;
  for (var i = 0; i < DATA.length; i++) {
    var c = DATA[i];
    mcap += (c.m || 0);
    var g = gradeOf(dna(c));
    if (g != null && g >= 70) nA++;
    if (matchBullMode(c, 'zec')) nZecType++;
    if (matchBullMode(c, 'gem')) nGem++;
  }
  var med = STATS.median_1y;
  $('statsbar').innerHTML =
    '<div class="stat">PURE PRIVACY <b>' + DATA.length + '</b> assets</div>' +
    '<div class="stat">mcap รวม <b>$' + (mcap / 1e9).toFixed(2) + 'B</b></div>' +
    '<div class="stat" title="เหรียญที่มี Viewing Key/Selective Disclosure (comp=2) + โค้ด Active + P ผ่านเกณฑ์">🟢 พิมพ์เขียว ZEC <b>' + nZecType + '</b></div>' +
    '<div class="stat" title="Composite ≥64 แต่ Market Cap ยังอยู่ในโซนสะสม ($5M–$600M)">💎 Asymmetric Gems <b>' + nGem + '</b></div>' +
    '<div class="stat">DNA v1 ≥ A <b>' + nA + '</b></div>' +
    '<div class="stat">median 1Y <b>' + (med == null ? 'n/a' : (med > 0 ? '+' : '') + med.toFixed(0) + '%') + '</b></div>' +
    '<div class="stat">engine <b>' + SCORING_VERSION + '</b></div>' +
    '<div class="stat">snapshot <b>' + STATS.snap + '</b></div>' +
    '<button id="liveBtn" title="ดึงราคาสดจาก CoinGecko">⟳ LIVE</button>' +
    '<span id="liveStatus"></span>';
  $('liveBtn').onclick = liveRefresh;
}

var SPOT = ['ZEC', 'XMR', 'FIRO', 'ARRR', 'ZANO', 'AZTEC', 'ZAMA', 'ROSE', 'RAIL', 'NIGHT', 'DUSK', 'TORN'];
var CHIPS = {
  'TORN': ['SANCTIONED', 'r'],
  'AZTEC': ['ZK ROLLUP · 71% LOCKED', 'a'],
  'XMR': ['SOVEREIGN #1 · NO ETF', ''],
  'ZEC': ['ETF · $25.95B BENCHMARK', 'a'],
  'FIRO': ['SPARK ZK · COMP=2 · GEM', 'a'],
  'ARRR': ['100% SHIELDED · COMP=2', 'a'],
  'ZANO': ['CONF ASSETS · SOVEREIGN', ''],
  'ROSE': ['CONF EVM · COMP=2', '']
};

function renderSpot() {
  var out = [];
  for (var i = 0; i < SPOT.length; i++) {
    var c = null;
    for (var j = 0; j < DATA.length; j++) if (DATA[j].s === SPOT[i]) { c = DATA[j]; break; }
    if (!c) continue;
    var q = cur(c.s), ev = evalCoin(c);
    var note = (q.note || '').length > 105 ? q.note.slice(0, 105) + '…' : (q.note || '');
    var chips = '';
    if (CHIPS[c.s]) chips = '<span class="chip ' + CHIPS[c.s][1] + '">' + CHIPS[c.s][0] + '</span>';
    var bullBadge = (ev.asy && ev.asy.score != null)
      ? '<span class="chip arch-zec">Bull ' + ev.asy.score + '</span>'
      : '';
    out.push('<div class="card ' + (c.s === 'TORN' ? 'risk' : '') + '" data-spot="' + c.s + '" style="cursor:pointer">' +
      '<span class="cs">' + c.s + '</span><span class="cn">' + c.n + ' · $' + fmtCompact(c.m) + '</span>' +
      '<div class="cp num">' + fmtPrice(c.p) + '</div>' +
      '<div class="chg num">24h ' + fmtPct(c.c24) + ' &nbsp;·&nbsp; 1Y ' + fmtPct(c.c1y) + '</div>' +
      '<div>' + badge(q.model) + ' ' + bullBadge + chips + '</div>' +
      '<div class="note">' + (q.mech || '') + (note ? ' — ' + note : '') + '</div></div>');
  }
  $('spotCards').innerHTML = out.join('');
  var cards = $('spotCards').querySelectorAll ? $('spotCards').querySelectorAll('.card') : [];
  for (var k = 0; k < cards.length; k++) {
    cards[k].onclick = function () {
      var sym = this.getAttribute('data-spot');
      if (!sym) return;
      state.expanded = (state.expanded === sym) ? null : sym;
      if (state.view !== 'table') { state.view = 'table'; renderViewSwitch(); }
      renderTable();
      var tr = $('tbody') ? $('tbody').querySelector('tr[data-sym="' + sym + '"]') : null;
      if (tr && tr.scrollIntoView) tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  }
}

function hayOf(c) {
  var k = cur(c.s), dd = dna(c), ev = evalCoin(c);
  var arch = (ev.asy && ev.asy.archetype) ? ev.asy.archetype : '';
  return (c.s + ' ' + c.n + ' ' + grpOf(c) + ' ' + arch + ' ' + (ev.posIds || []).join(' ') + ' ' +
    (k.mech || '') + ' ' + (k.note || '') + ' ' + (k.access || '') + ' ' +
    (dd.fam || '') + ' ' + (dd.prim || '') + ' ' + (dd.hides || '') + ' ' + (dd.trust || '') + ' ' + (dd.anonset || '') + ' ' +
    (dd.sec || '') + ' ' + (dd.comp || '') + ' ' + (dd.stage || '') + ' ' + (dd.setup || '') + ' ' + (dd.audit || '') + ' ' +
    (dd.gov || '') + ' ' + (dd.risk || '')).toLowerCase();
}
function matchesQuery(c) {
  if ((c.m || 0) < state.minMcap) return false;
  if (state.curOnly && SPOT.indexOf(c.s) < 0) return false;
  if (state.minGrade) {
    var gr = gradeOf(dna(c));
    if (gr == null || gr < state.minGrade) return false;
  }
  if (!matchBullMode(c, state.bullFilter)) return false;
  var q = state.q.trim().toLowerCase();
  if (q && hayOf(c).indexOf(q) < 0) return false;
  return true;
}
function passFilter(c) { return matchesQuery(c); }
function sortVal(c, k) {
  if (k === 's' || k === 'n') return c.s;
  if (k === 'mcap') return (c.m == null ? -1e18 : c.m);
  if (k === 'comp') {
    var sc = activeScore(c);
    return (sc == null ? -1e18 : sc);
  }
  if (k === 'bull') {
    var ev = evalCoin(c);
    return (ev.asy && ev.asy.score != null) ? ev.asy.score : -1e18;
  }
  if (k === 'v1') {
    var g = gradeOf(dna(c));
    return (g == null ? -1e18 : g);
  }
  if (k === 'sp') {
    return (c.cs && c.ms && c.ms > 0) ? (c.cs / c.ms) : -1e18;
  }
  var v = c[k];
  return (v == null ? -1e18 : v);
}

function dnaPanel(c) {
  var d = dna(c), q = cur(c.s), g = gradeOf(d), ev = evalCoin(c);
  var head = '<div class="dnaHead"><b>' + c.s + '</b><span class="dim">' + c.n + '</span>' +
    '<span class="chip">' + (c.g || 'proto') + '</span>' + archChip(d) + famChip(d.fam) + badge(q.model) +
    (ev.asy ? ' ' + archetypeBadge(ev.asy.archetype) : '') +
    (g == null ? '' : '<span class="' + gradeCls(g) + '">DNA v1 ' + g + '/100 · ' + gradeLetter(g) + '</span>') + '</div>';
  var manV = gval(d, 'man'), tlV = gval(d, 'tl');
  var strip = '<div class="geneRow"><span class="lbl">ซ่อน:</span>' +
    '<span class="lbl">ผู้ส่ง</span>' + geneCell(d.hs) +
    '<span class="lbl">ผู้รับ</span>' + geneCell(d.hr) +
    '<span class="lbl">จำนวน</span>' + geneCell(d.ha) +
    '<span class="lbl">state</span>' + geneCell(d.hst) +
    '<span class="lbl">· บังคับใช้</span>' + (manV >= 1 ? '<span class="gene g2">YES</span>' : (manV >= 0.5 ? '<span class="gene g1">DEF</span>' : '<span class="gene g1">OPT</span>')) +
    '<span class="lbl">trustless</span>' + (tlV >= 2 ? '<span class="gene g2">YES</span>' : (tlV >= 1 ? '<span class="gene g1">PART</span>' : '<span class="gene g0">NO</span>')) + '</div>';
  function kv(k, v) {
    var val = (v && typeof v === 'object') ? (v.note || v.v) : v;
    return val ? '<div><div class="k">' + k + '</div><div class="v">' + val + '</div></div>' : '';
  }
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
    kv('ปี mainnet', gval(d, 'yr') ? String(gval(d, 'yr')) : '') +
    kv('ไทม์ไลน์สำคัญ', d.hist) +
    kv('ความเสี่ยงหลัก', d.risk) +
    kv('notes', q.note) +
    '</div>';
  return head + strip + grid + v3Block(c) + dossierHtml(c);
}

/* v3 surface: DNA v2.8 (engine/score.js) + Bull-Run Asymmetry + Target Simulator + Flags */
function v3Block(c) {
  var d = dna(c), det_ = det(c), ev = evalCoin(c), out = '';
  var p2 = null;
  try { p2 = scoreP(d); } catch (e) { p2 = null; }
  var v1 = null;
  try { v1 = scoreV1(d); } catch (e) { v1 = null; }

  if (p2) {
    var pct = Math.round(p2.coverage * 100);
    out += '<div class="v3"><div class="v3t">DNA v2 <span class="dim">(' + p2.version + ')</span></div>';
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
    out += '</div>';
  }

  /* --- Bull-Run Asymmetry & Next-Zcash Re-rating Panel --- */
  if (ev.asy) {
    var a = ev.asy, br = compositeRank(c, 'asymmetry');
    out += '<div class="v3"><div class="v3t">⚡ BULL-RUN ASYMMETRY &amp; RE-RATING SIMULATOR <span class="dim">(เทียบพิมพ์เขียว ZEC $700M → $25.95B)</span></div>';
    out += '<div class="v3score">Bull Asymmetry = <b>' + a.score + '</b> / 100 ' +
      (br ? '<span class="dim">→ อันดับ <b>#' + br.r + '/' + br.n + '</b></span> ' : '') +
      archetypeBadge(a.archetype) + '</div>';
    out += '<div class="v3parts">' +
      plChip('Fundamentals (50%)', a.fundamentals) +
      plChip('Mcap Upside Room (20%)', a.upside) +
      plChip('Clean Tokenomics (15%)', a.tokenomics) +
      plChip('Market Access Rails (15%)', a.rails) +
      '</div>';
    if (c.m && c.m > 0 && c.p && c.p > 0) {
      var targets = [
        ['$700M (ZEC ก่อนวิ่ง)', 7e8],
        ['$2.5B (Mid-Cap Bull)', 2.5e9],
        ['$6.5B (ระดับ XMR)', 6.5e9],
        ['$25.95B (ZEC Peak)', 25.95e9]
      ];
      var tHtml = targets.map(function (t) {
        var sim = calcTarget(c, t[1]);
        if (!sim || sim.mult <= 1.05) return '<span class="chip dim">' + t[0] + ': ผ่านเป้าแล้ว</span>';
        var dil = (sim.fdvMult < sim.mult * 0.85) ? ' <span class="dim">(FDV ' + fmtMult(sim.fdvMult) + ')</span>' : '';
        return '<span class="chip b-sel">' + t[0] + ' → <b>' + fmtMult(sim.mult) + '</b> (' + fmtPrice(sim.targetPrice) + ')' + dil + '</span>';
      }).join(' ');
      out += '<div class="v3parts" style="margin-top:4px">' + tHtml + '</div>';
    }
    out += '<div class="dim" style="font-size:10px">โมเดลวัด 4 ปัจจัยที่ทำให้เหรียญพุ่งระดับ 10x–35x ในตลาดกระทิง: (1) พื้นฐาน P·D·R·S·T แข็งและโค้ดไม่ตาย · (2) ขนาด Market Cap ยังมีรูมเติบโต (คูณด้วยความแข็งของ P เพื่อกันเหรียญอ่อนแอมั่วติดอันดับ) · (3) สัดส่วนเหรียญหมุนเวียนสูง ไม่โดน VC เทปลดล็อก · (4) มี Viewing Key / Compliance (comp=2) และลิสต์บนกระดานเทรด</div>';
    out += '</div>';
  }

  /* --- 6 Pillars D / L / T / S / R / P + Composite --- */
  var pl = ev.pl;
  if (pl) {
    var pos = ev.pos || [];
    var dd = pl.Ddetail;
    out += '<div class="v3"><div class="v3t">6 PILLARS: P · D · L · T · S · R <span class="dim">(privacy · developer · liquidity · maturity · security · regulatory+access)</span></div><div class="v3parts">' +
      plChip('P', pl.P) + plChip('D', pl.D) + plChip('L', pl.L) + plChip('T', pl.T) + plChip('S', pl.S) + plChip('R', pl.R) +
      '</div>';
    if (dd) {
      out += '<div class="dim" style="font-size:10px">' + (dd.repo || 'repo ไม่ระบุ') + ' · push ล่าสุด ' + dd.pushed +
        ' (' + dd.days + ' วันที่แล้ว)' + (dd.archived ? ' · <span class="chip fl-CRITICAL">archived</span>' : '') +
        (dd.stars ? ' · ★ ' + dd.stars : '') + '</div>';
    } else {
      out += '<div class="dim" style="font-size:10px">ไม่มี repo ที่ยืนยันได้ — pillar D ประเมินไม่ได้</div>';
    }
    var cr = compositeRank(c, 'privacy_investor'), bh = compositeRank(c, 'bull_hunter'), cb = compositeRank(c, 'investor');
    if (cr) {
      out += '<div class="dim" style="font-size:10px">Composite: <b>Privacy Investor = ' + cr.v + '</b> (#' + cr.r + '/' + cr.n + ') &nbsp;·&nbsp; ' +
        '<b>Bull-Run Hunter = ' + (bh ? bh.v + ' (#' + bh.r + ')' : 'n/a') + '</b> &nbsp;·&nbsp; ' +
        'General Investor = ' + (cb ? cb.v + ' (#' + cb.r + ')' : 'n/a') + '</div>';
    }
    if (pos.length) {
      out += '<div class="v3flags" style="margin-top:5px">' + pos.map(function (f) { return '<span class="chip b-sel">🟢 ' + f.id + '</span> '; }).join('') + '</div>' +
        '<div class="dim" style="font-size:10px">' + pos.map(function (f) { return f.msg; }).join(' · ') + '</div>';
    }
    out += '</div>';
  }

  var fl = ev.fl || [];
  out += '<div class="v3"><div class="v3t">RED FLAGS <span class="dim">(' + fl.length + ')</span></div>';
  if (fl.length) {
    out += '<div class="v3flags">' + fl.map(function (f) { return '<span class="chip fl-' + f.lv + '">' + f.lv + ' · ' + f.id + '</span> '; }).join('') + '</div>' +
      '<div class="dim" style="font-size:10px">' + fl.map(function (f) { return f.msg; }).join(' · ') + '</div>';
  } else {
    out += '<div class="dim" style="font-size:10px">ไม่พบ flag จากเกณฑ์ปัจจุบัน (threshold เป็นค่าตั้งต้น ปรับได้ที่ engine/flags.js)</div>';
  }
  if (det_ && det_.repo_note) out += '<div class="dim" style="font-size:10px">! ' + det_.repo_note + '</div>';
  out += '</div>';

  return out;
}

function plChip(k, v) {
  if (v == null) return '<span class="chip" title="ประเมินไม่ได้ — ข้อมูลไม่พอ">' + k + ' ?</span>';
  return '<span class="chip' + (v >= 60 ? ' b-sel' : '') + '">' + k + ' ' + v + '</span>';
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
      var riskAdj = (key === 'privacy_investor' || key === 'bull_hunter');
      try { s = compositeOf(dna(x), x, det(x), ASOF_DATE, key, riskAdj); } catch (e) { s = null; }
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

function renderBull() {
  var bw = $('bullWrap');
  if (!bw) return;
  var rows = [];
  for (var i = 0; i < DATA.length; i++) {
    var c = DATA[i];
    if (!matchesQuery(c)) continue;
    var ev = evalCoin(c);
    if (ev.asy && ev.asy.score != null) {
      rows.push({ c: c, ev: ev, bull: ev.asy.score, pi: activeScore(c, 'privacy_investor'), bh: activeScore(c, 'bull_hunter') });
    }
  }
  rows.sort(function (a, b) { return b.bull - a.bull || (b.bh || 0) - (a.bh || 0); });

  var zecList = rows.filter(function (r) { return r.ev.asy.archetype === 'ZEC-ARCHETYPE' && !r.ev.hasCrit; });
  var sovList = rows.filter(function (r) { return r.ev.asy.archetype === 'SOVEREIGN-PRIV' && !r.ev.hasCrit; });

  var tBench = [
    [7e8, 'เป้า $700M (ZEC ก่อนวิ่ง)'],
    [2.5e9, 'เป้า $2.5B (Mid-Cap Bull)'],
    [6.5e9, 'เป้า $6.5B (ระดับ XMR)'],
    [25.95e9, 'เป้า $25.95B (ZEC Bull Peak)']
  ];

  function cardHtml(r) {
    var c = r.c, a = r.ev.asy, pl = r.ev.pl || {};
    var posChips = (r.ev.pos || []).slice(0, 3).map(function (p) {
      return '<span class="chip b-sel">🟢 ' + p.id + '</span>';
    }).join(' ');
    var sim = calcTarget(c, state.targetMcap);
    var simHtml = '';
    if (sim && sim.mult > 1.05) {
      var dilNote = (sim.fdvMult < sim.mult * 0.85) ? ' <span class="dim">(หลังปลดล็อกครบ: ' + fmtMult(sim.fdvMult) + ')</span>' : ' <span class="dim">(ไร้ VC Overhang)</span>';
      simHtml = '<div class="multBox"><span>เป้า Mcap $' + fmtCompact(state.targetMcap) + ' → <b>' + fmtPrice(sim.targetPrice) + '</b>' + dilNote + '</span><span class="mVal">' + fmtMult(sim.mult) + '</span></div>';
    } else {
      simHtml = '<div class="multBox"><span class="dim">Mcap ปัจจุบัน ($' + fmtCompact(c.m) + ') สูงกว่าเป้าหมายที่เลือกแล้ว</span><span class="dim">—</span></div>';
    }
    return '<div class="bullCard" data-bcard="' + c.s + '">' +
      '<div class="bTop"><div><span class="bSym">' + c.s + '</span> <span class="dim">' + c.n + '</span></div>' +
      '<div class="bScore">Bull ' + a.score + '/100</div></div>' +
      '<div class="bullBar"><i style="width:' + a.score + '%"></i></div>' +
      '<div class="dim" style="font-size:10.5px">Mcap <b>$' + fmtCompact(c.m) + '</b> · ราคา <b>' + fmtPrice(c.p) + '</b> · 30d ' + fmtPct(c.c30) + ' · 1Y ' + fmtPct(c.c1y) + '</div>' +
      simHtml +
      '<div class="v3parts" style="margin-bottom:4px">' +
      '<span class="chip">Fund ' + a.fundamentals + '</span>' +
      '<span class="chip">Upside ' + a.upside + '</span>' +
      '<span class="chip">Tok ' + a.tokenomics + '</span>' +
      '<span class="chip">Rails ' + a.rails + '</span>' +
      '<span class="chip">P=' + (pl.P != null ? pl.P : '—') + ' R=' + (pl.R != null ? pl.R : '—') + '</span>' +
      '</div>' +
      '<div>' + archetypeBadge(a.archetype) + ' ' + posChips + '</div>' +
      '</div>';
  }

  var out = [];
  out.push('<div class="rubric"><b>⚡ Bull-Run Asymmetry Radar — ทำไม Zcash (ZEC) ถึงขึ้นจาก $700M ไป $25.95B (~37x) และเราจะหาตัวถัดไปอย่างไร?</b><br>' +
    'ในตลาดกระทิง เหรียญที่จะเกิดการ Re-rate ระดับ 10x–35x ต้องมีครบ 4 แกนพร้อมกัน: ' +
    '<b>(1) Fundamentals 50%</b> (กลไกความลับ P แข็งจริง, โค้ด Active D, ความปลอดภัย S, อายุเครือข่าย T) &nbsp;·&nbsp; ' +
    '<b>(2) Valuation Upside Room 20%</b> (Market Cap ยังอยู่ในโซนสะสม $5M–$800M และถูกคูณถ่วงน้ำหนักด้วย P เพื่อกันเหรียญกลไกอ่อนแอ) &nbsp;·&nbsp; ' +
    '<b>(3) Clean Tokenomics 15%</b> (สัดส่วนเหรียญหมุนเวียนสูง ไม่โดน VC เทปลดล็อก) &nbsp;·&nbsp; ' +
    '<b>(4) Market Access Rails 15%</b> (มี Viewing Keys / Selective Disclosure <code>comp=2</code> รองรับเกณฑ์สถาบัน/CEX เหมือน ZEC)</div>');

  out.push('<div class="simBar"><div class="sTitle">🎯 จำลองเป้าหมาย Re-rating (Target Market Cap Simulator):</div><div class="simBtns">' +
    tBench.map(function (b) {
      return '<button class="simBtn' + (state.targetMcap === b[0] ? ' on' : '') + '" data-tmcap="' + b[0] + '">' + b[1] + '</button>';
    }).join('') +
    '</div><span class="dim" style="font-size:10.5px;margin-left:auto">คำนวณทั้งจำนวนเด้งตาม Supply หมุนเวียนจริง และหักลดทอนกรณีมีเหรียญล็อก (FDV Dilution)</span></div>');

  out.push('<div class="secHead"><h2>🟢 กลุ่มที่ 1: พิมพ์เขียว ZEC (ZEC-ARCHETYPE — มี Viewing Keys / Selective Disclosure comp=2 + กลไกความลับแข็ง + โค้ด Active)</h2></div>');
  out.push('<div class="bullGrid">' + (zecList.length ? zecList.map(cardHtml).join('') : '<div class="dim">ไม่พบเหรียญที่ตรงเงื่อนไข</div>') + '</div>');

  out.push('<div class="secHead"><h2>🛡️ กลุ่มที่ 2: Sovereign Privacy Gems (SOVEREIGN-PRIV — ความลับ Default/Mandatory P ≥65 + โซนสะสม + ไร้ VC Overhang)</h2></div>');
  out.push('<div class="bullGrid">' + (sovList.length ? sovList.map(cardHtml).join('') : '<div class="dim">ไม่พบเหรียญที่ตรงเงื่อนไข</div>') + '</div>');

  out.push('<div class="secHead"><h2>📊 ตารางจัดอันดับ Bull-Run Asymmetry ครบทุกแกน (' + rows.length + ' เหรียญที่มีหลักฐาน P ≥80%)</h2></div>');
  out.push('<table class="mx"><thead><tr>' +
    '<th>#</th><th>Coin</th><th>Archetype</th><th class="num">Bull Score</th><th class="num">Bull Hunter</th><th class="num">Priv Investor</th>' +
    '<th class="num">เป้า $' + fmtCompact(state.targetMcap) + '</th>' +
    '<th class="num">Fund (50%)</th><th class="num">Upside (20%)</th><th class="num">Tokenomics (15%)</th><th class="num">Rails (15%)</th>' +
    '<th class="num">Mcap</th><th>P · D · L · T · S · R</th><th>🟢 Bull-Run Signals</th><th>⚠️ Flags</th>' +
    '</tr></thead><tbody>');
  for (var j = 0; j < rows.length; j++) {
    var r = rows[j], c = r.c, a = r.ev.asy, pl = r.ev.pl || {};
    var pStr = [pl.P, pl.D, pl.L, pl.T, pl.S, pl.R].map(function (x) { return x == null ? '—' : x; }).join(' · ');
    var posHtml = (r.ev.pos || []).map(function (p) { return '<span class="chip b-sel">🟢 ' + p.id + '</span>'; }).join(' ');
    var flHtml = (r.ev.fl || []).map(function (f) { return '<span class="chip fl-' + f.lv + '">' + f.id + '</span>'; }).join(' ');
    var simRow = calcTarget(c, state.targetMcap);
    var multCell = (simRow && simRow.mult > 1.05)
      ? '<b class="up">' + fmtMult(simRow.mult) + '</b> <span class="dim">(' + fmtPrice(simRow.targetPrice) + ')</span>'
      : '<span class="dim">—</span>';
    out.push('<tr data-bcard="' + c.s + '" class="row">' +
      '<td class="num dim">' + (j + 1) + '</td>' +
      '<td class="coin"><span class="sym">' + c.s + '</span><span class="nm">' + c.n + '</span></td>' +
      '<td>' + archetypeBadge(a.archetype) + '</td>' +
      '<td class="num"><b class="gA">' + a.score + '</b></td>' +
      '<td class="num">' + (r.bh == null ? '—' : r.bh) + '</td>' +
      '<td class="num dim">' + (r.pi == null ? '—' : r.pi) + '</td>' +
      '<td class="num">' + multCell + '</td>' +
      '<td class="num">' + a.fundamentals + '</td>' +
      '<td class="num">' + a.upside + '</td>' +
      '<td class="num">' + a.tokenomics + '</td>' +
      '<td class="num">' + a.rails + '</td>' +
      '<td class="num">$' + fmtCompact(c.m) + '</td>' +
      '<td class="num dim">' + pStr + '</td>' +
      '<td class="wide">' + (posHtml || '<span class="dim">—</span>') + '</td>' +
      '<td class="wide">' + (flHtml || '<span class="dim">—</span>') + '</td>' +
      '</tr>');
  }
  out.push('</tbody></table>');
  bw.innerHTML = out.join('');
  $('count').textContent = rows.length + ' / ' + DATA.length + ' assets (Bull-Run Radar)';

  var sbs = bw.querySelectorAll ? bw.querySelectorAll('.simBtn') : [];
  for (var si = 0; si < sbs.length; si++) {
    sbs[si].onclick = function () {
      state.targetMcap = parseFloat(this.getAttribute('data-tmcap')) || 2.5e9;
      renderBull();
    };
  }

  var clickEls = bw.querySelectorAll ? bw.querySelectorAll('[data-bcard]') : [];
  for (var k = 0; k < clickEls.length; k++) {
    clickEls[k].onclick = function () {
      var sym = this.getAttribute('data-bcard');
      if (!sym) return;
      state.expanded = sym;
      state.view = 'table';
      renderViewSwitch();
      renderTable();
      var tr = $('tbody') ? $('tbody').querySelector('tr[data-sym="' + sym + '"]') : null;
      if (tr && tr.scrollIntoView) tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  }
}

function renderTable() {
  var mw = $('matrixWrap'), tw = $('tblWrap'), dw = $('docsWrap'), cw = $('cmpWrap'), bw = $('bullWrap');
  if (tw) tw.style.display = 'none';
  if (mw) mw.style.display = 'none';
  if (dw) dw.style.display = 'none';
  if (cw) cw.style.display = 'none';
  if (bw) bw.style.display = 'none';

  if (state.view === 'docs') {
    if (dw) { dw.style.display = 'block'; renderDocs(); }
    return;
  }
  if (state.view === 'compare') {
    if (cw) { cw.style.display = 'block'; renderCompare(); }
    return;
  }
  if (state.view === 'matrix') {
    if (mw) { mw.style.display = 'block'; renderMatrix(); }
    return;
  }
  if (state.view === 'bull') {
    if (bw) { bw.style.display = 'block'; renderBull(); }
    return;
  }
  if (tw) tw.style.display = 'block';

  view = [];
  for (var i = 0; i < DATA.length; i++) if (passFilter(DATA[i])) view.push(DATA[i]);
  view.sort(function (a, b) {
    var x = sortVal(a, state.sortKey), y = sortVal(b, state.sortKey);
    if (typeof x === 'string') return state.dir * x.localeCompare(y);
    return state.dir * (x - y);
  });
  var rows = [];
  for (var j = 0; j < view.length; j++) {
    var c = view[j], k = cur(c.s), d = dna(c), ev = evalCoin(c);
    var supply = '—';
    if (c.cs) {
      supply = c.ms
        ? fmtNum(c.cs) + ' / ' + fmtNum(c.ms) + ' <span class="dim">' + Math.round(100 * c.cs / c.ms) + '%</span>'
        : fmtNum(c.cs) + ' / ∞';
    }
    var sc = activeScore(c);
    var scHtml = sc == null
      ? '<span class="dim" title="หลักฐาน P ยังไม่ถึง 80% จึงไม่จัดอันดับ">—</span>'
      : '<span class="' + gradeCls(sc) + '">' + sc + '</span>' + pillarMiniHtml(ev.pl);

    var bullHtml = '<span class="dim">—</span>';
    if (ev.asy && ev.asy.score != null) {
      var nPos = (ev.pos || []).length;
      var tag = ev.asy.archetype === 'ZEC-ARCHETYPE' ? ' <span class="chip arch-zec">ZEC</span>'
              : (ev.asy.archetype === 'SOVEREIGN-PRIV' ? ' <span class="chip arch-sov">SOV</span>' : '');
      var sig = nPos > 0 ? ' <span class="chip b-sel" title="' + ev.pos.map(function (x) { return x.id; }).join(', ') + '">🟢×' + nPos + '</span>' : '';
      var crit = ev.hasCrit ? ' <span class="chip fl-CRITICAL" title="มี CRITICAL Flag">!</span>' : '';
      bullHtml = '<span class="' + gradeCls(ev.asy.score) + '">' + ev.asy.score + '</span>' + tag + sig + crit;
    }

    var sel = (j === state.sel ? ' sel' : '');
    rows.push('<tr data-sym="' + c.s + '" class="row' + sel + '">' +
      '<td class="num dim">' + (j + 1) + '</td>' +
      '<td class="coin">' + (c.img ? '<img src="' + c.img + '" alt="">' : '') + '<span class="sym">' + c.s + '</span><span class="nm">' + c.n + '</span>' +
      (det(c).spark && det(c).spark.length > 2 ? sparkSvg(det(c).spark, 56, 14, sparkColor(det(c).spark)) : '') + '</td>' +
      '<td class="num">' + scHtml + '</td>' +
      '<td class="num">' + bullHtml + '</td>' +
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
      rows.push('<tr class="exp"><td colspan="16">' + dnaPanel(c) + '</td></tr>');
    }
  }
  $('tbody').innerHTML = rows.join('');
  $('count').textContent = view.length + ' / ' + DATA.length + ' assets';
  var btns = $('tbody').querySelectorAll ? $('tbody').querySelectorAll('.cmpBtn') : [];
  for (var bi = 0; bi < btns.length; bi++) {
    btns[bi].onclick = (function (btn) {
      return function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
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
      '<td>' + (gval(d, 'man') ? '<span class="gene g2">YES</span>' : '<span class="gene g1">OPT</span>') + '</td>' +
      '<td>' + (gval(d, 'tl') ? '<span class="gene g2">YES</span>' : '<span class="gene g0">NO</span>') + '</td>' +
      '<td>' + (gval(d, 'big') ? '<span class="gene g2">NETWORK</span>' : '<span class="gene g1">POOL</span>') + '</td>' +
      '<td class="wide">' + (d.setup || '—') + '</td>' +
      '<td class="num dim">' + (gval(d, 'yr') || '—') + '</td>' +
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
  var ths = document.querySelectorAll('#tbl thead th');
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
  _evalCache = {};
  _compCache = null;
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
    renderStats(); renderSpot(); renderPillBar(); renderTable();
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

/* ---- Compare view: radar over the six pillars + a gene-by-gene table ------------------------- */
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
  series.forEach(function (sr) {
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

function cmpGeneCell(d, gene) {
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
    return { c: c, color: CMP_COLORS[i % CMP_COLORS.length], vals: cmpPillars(c) || [], ev: evalCoin(c) };
  });
  var head = '<div class="cmpHead"><h2>เปรียบเทียบ ' + coins.length + ' โครงการ</h2>' +
    '<span class="dim">เรดาร์ = รูปร่างของ 6 pillar (ยิ่งออกดูกว้างยิ่งสมดุล) · ตารางล่าง = หลักฐานของทุกแกน ' +
    '(· = conf med · ·· = conf low · ไม่มีจุด = conf high · — = ไม่มีค่า)</span>' +
    '<span class="dim" style="margin-left:auto"><button class="cmpBtn" id="cmpClear">ล้างทั้งหมด</button></span></div>';
  var legend = '<div class="cmpLegend">' + series.map(function (sr) {
    return '<span><i style="background:' + sr.color + '"></i>' + sr.c.s + ' ' + sr.c.n + '</span>';
  }).join('') + '</div>';
  var rowsHtml = '';
  rowsHtml += '<tr class="hl"><td class="k">Bull Asymmetry Score</td>' +
    series.map(function (sr) { return '<td class="v">' + (sr.ev.asy ? sr.ev.asy.score : '—') + '</td>'; }).join('') + '</tr>';
  CMP_PILLARS.forEach(function (pl, i) {
    rowsHtml += '<tr class="hl"><td class="k">' + pl[1] + ' (' + pl[0] + ')</td>' +
      series.map(function (sr) { return '<td class="v">' + (sr.vals[i] == null ? '—' : sr.vals[i]) + '</td>'; }).join('') + '</tr>';
  });
  CMP_GENES.forEach(function (gene) {
    rowsHtml += '<tr><td class="k">' + gene + '</td>' +
      series.map(function (sr) { return cmpGeneCell(dna(sr.c), gene); }).join('') + '</tr>';
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
    '<button id="vBull" class="bullTab' + (state.view === 'bull' ? ' on' : '') + '">⚡ Bull-Run Radar (The Next ZEC)</button>' +
    '<button id="vMatrix" class="' + (state.view === 'matrix' ? 'on' : '') + '">DNA Matrix</button>' +
    '<button id="vDocs" class="' + (state.view === 'docs' ? 'on' : '') + '">เอกสาร &amp; ข้อมูล</button>' +
    '<button id="vCmp" class="' + (state.view === 'compare' ? 'on' : '') + '"' +
    (state.compare.length < 2 ? ' disabled title="เลือกเหรียญ 2–4 ตัวจากปุ่ม ⇄ ในตารางก่อน"' : '') + '>เปรียบเทียบ (' + state.compare.length + ')</button>';
  $('vTable').onclick = function () { state.view = 'table'; renderViewSwitch(); renderTable(); };
  $('vBull').onclick = function () { state.view = 'bull'; renderViewSwitch(); renderTable(); };
  $('vMatrix').onclick = function () { state.view = 'matrix'; renderViewSwitch(); renderTable(); };
  $('vDocs').onclick = function () { state.view = 'docs'; renderViewSwitch(); renderTable(); };
  $('vCmp').onclick = function () { if (state.compare.length >= 2) { state.view = 'compare'; renderViewSwitch(); renderTable(); } };
}

function init() {
  for (var t = 0; t < DATA.length; t++) { TIERMAP[DATA[t].s] = DATA[t].tier || 't3'; IDMAP[DATA[t].id] = { tier: DATA[t].tier || 't3', dna: DATA[t].dna || 0 }; }
  augment();
  renderStats(); renderSpot(); renderPillBar(); renderViewSwitch(); renderTable(); markSort();
  $('q').addEventListener('input', function () { state.q = this.value; state.sel = -1; renderTable(); });
  if ($('presetSel')) {
    $('presetSel').addEventListener('change', function () {
      state.preset = this.value || 'privacy_investor';
      renderTable();
    });
  }
  if ($('bullFilter')) {
    $('bullFilter').addEventListener('change', function () {
      state.bullFilter = this.value || 'all';
      state.sel = -1;
      renderPillBar();
      renderTable();
    });
  }
  if ($('curOnly')) {
    $('curOnly').addEventListener('change', function () {
      state.curOnly = !!this.checked;
      state.sel = -1;
      renderTable();
    });
  }
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
  var ths = document.querySelectorAll('#tbl thead th');
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
