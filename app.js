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
  invAmt: 1000, targetMcap: 2.5e9, sortKey: 'bull', dir: -1, minMcap: 0, minGrade: 0,
  sel: -1, expanded: null, compare: []
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
function fmtUsd(n) {
  if (n == null || !isFinite(n) || n <= 0) return '—';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 100) return '$' + Math.round(n).toLocaleString('en-US');
  return '$' + n.toFixed(2);
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
  var pl = null, asy = null, sf = null, fl = [], pos = [], m = {};
  try { pl = pillarsOf(d, c, dt, ASOF_DATE); } catch (e) { pl = null; }
  try { asy = asymmetryOf(d, c, dt, ASOF_DATE); } catch (e) { asy = null; }
  try { sf = supplyForensicsOf(c, d); } catch (e) { sf = null; }
  try {
    m = metricsFor(c, dt, d, ASOF_DATE);
    fl = evaluateFlags(m);
    pos = evaluatePositives(m);
  } catch (e) { fl = []; pos = []; }
  var posIds = pos.map(function (p) { return p.id; });
  var flagIds = fl.map(function (f) { return f.id; });
  var hasCrit = fl.some(function (f) { return f.lv === 'CRITICAL'; });
  var res = { pl: pl, asy: asy, sf: sf, fl: fl, flagIds: flagIds, pos: pos, posIds: posIds, hasCrit: hasCrit, m: m };
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

/* Clear investment verdict badge for quick decision making */
function verdictOf(c) {
  var d = dna(c), ev = evalCoin(c), asy = ev.asy, sf = ev.sf, pids = ev.posIds || [];
  if (gval(d, 'sanctioned')) {
    return { cls: 'vb-risk', lbl: '🚨 ถูกคว่ำบาตร (Sanctioned)', desc: 'มีความเสี่ยงทางกฎหมายและถูกถอดจากกระดานหลัก' };
  }
  if (ev.hasCrit) {
    return { cls: 'vb-risk', lbl: '🚨 ติดธงแดง CRITICAL', desc: 'มีช่องโหว่ยังไม่แก้ หรือ Repo หยุดพัฒนาเกิน 1 ปี' };
  }
  if (!asy || !ev.pl || ev.pl.P == null) {
    return { cls: 'vb-watch', lbl: '⏳ รอเติมหลักฐาน P', desc: 'ข้อมูลความลับยังไม่ครบ 80% จึงยังไม่จัดอันดับ Bull Run' };
  }
  if (sf && sf.tier === 'CRITICAL_LOCK') {
    return { cls: 'vb-risk', lbl: '🚨 ระวังปลดล็อกหนัก (FDV ' + sf.fdvMcap + 'x)', desc: 'มีเหรียญเสกล็อกอยู่ ' + sf.lockedPct + '% ของอุปทาน — ห้ามไล่ราคา ต้องรอจังหวะย่อ/ปลดล็อก' };
  }
  if (sf && sf.tier === 'HEAVY_LOCK') {
    return { cls: 'vb-warn', lbl: '⚠️ เหรียญล็อกสูง (' + sf.lockedPct + '% Locked)', desc: 'มีเหรียญเสกรอปลดล็อกเกินครึ่งของตลาด ต้องหักส่วนลด Dilution เวลาตั้งเป้ากำไร' };
  }
  if (asy.archetype === 'ZEC-ARCHETYPE' && asy.score >= 70 && (!sf || sf.lockedPct <= 25)) {
    return { cls: 'vb-top', lbl: '🟢 ตัวเต็งพิมพ์เขียว ZEC', desc: 'มี Viewing Key (comp=2) + ความลับแข็ง + โค้ด Active + โครงสร้างเหรียญสะอาด' };
  }
  if (pids.indexOf('asymmetric_gem') >= 0 || (asy.score >= 72 && (!sf || sf.lockedPct <= 22))) {
    return { cls: 'vb-gem', lbl: '💎 เพชรเม็ดงาม (Clean Gem)', desc: 'พื้นฐานแถวหน้า + Market Cap โซนสะสม + ไร้ระเบิดเวลา VC Unlock' };
  }
  if (asy.archetype === 'SOVEREIGN-PRIV' && asy.score >= 65) {
    return { cls: 'vb-sov', lbl: '🛡️ เหรียญหลักสายแข็ง', desc: 'กลไกความลับระดับสูงสุด (Default/Mandatory) ผ่านการพิสูจน์ตามกาลเวลา' };
  }
  if (asy.score >= 62) {
    return { cls: 'vb-watch', lbl: '⚡ น่าจับตารอบ Bull Run', desc: 'พื้นฐานผ่านเกณฑ์และมีปัจจัยบวกเฉพาะกลุ่ม' };
  }
  return { cls: 'vb-warn', lbl: '🔍 เก็งกำไร / เฉพาะทาง', desc: 'คะแนนความลับหรือสภาพคล่องยังเป็นรองกลุ่มผู้นำ' };
}

function pBoxHtml(v) {
  if (v == null) return '<span class="p-na">—</span>';
  var cls = v >= 75 ? 'p-hi' : (v >= 55 ? 'p-md' : (v >= 35 ? 'p-lo' : 'p-bad'));
  return '<span class="pBox ' + cls + '">' + v + '</span>';
}

/* Implied re-rating multiple & target price if coin reaches targetMcap */
function calcTarget(c, targetMcap) {
  if (!c || !c.m || c.m <= 0 || !c.p || c.p <= 0) return null;
  var mult = targetMcap / c.m;
  var targetPrice = c.p * mult;
  var fdvMult = mult;
  var maxS = Math.max(c.ms || 0, c.ts || 0);
  if (maxS && c.cs && maxS > c.cs && c.cs > 0) {
    fdvMult = targetMcap / (c.p * maxS);
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
    '<polyline fill="none" stroke="' + col + '" stroke-width="1.4" points="' + pts.join(' ') + '"/></svg>';
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
  var ev = evalCoin(c), sf = ev.sf;
  var pids = ev.posIds || [];
  if (mode === 'zec') return pids.indexOf('zec_archetype') >= 0 || (ev.asy && ev.asy.archetype === 'ZEC-ARCHETYPE');
  if (mode === 'gem') return pids.indexOf('asymmetric_gem') >= 0 || (ev.asy && ev.asy.score >= 70 && (c.m || 0) >= 4e6 && (c.m || 0) <= 6.5e8 && (!sf || sf.lockedPct <= 22) && !ev.hasCrit);
  if (mode === 'sov') return !!(ev.asy && ev.asy.archetype === 'SOVEREIGN-PRIV');
  if (mode === 'accum') return pids.indexOf('early_accumulation') >= 0;
  if (mode === 'overhang') return !!(sf && (sf.fdvMcap > 1.75 || sf.lockedPct >= 30));
  if (mode === 'safe') return !ev.hasCrit && !gval(dna(c), 'sanctioned') && (!sf || sf.tier !== 'CRITICAL_LOCK');
  return true;
}

function renderPillBar() {
  var pb = $('pillBar');
  if (!pb) return;
  var modes = [
    ['all', 'ทั้งหมด'],
    ['gem', '💎 เพชรเม็ดงามไร้ล็อก (Clean Gems · โซนสะสม)'],
    ['zec', '🟢 พิมพ์เขียว ZEC (comp=2 · โค้ด Active)'],
    ['sov', '🛡️ Sovereign Privacy (P ≥65 · Default)'],
    ['accum', '🚀 สัญญาณสะสมต้นรอบ (Vol + Momentum)'],
    ['overhang', '🚨 สแกนเหรียญติดล็อก FDV Overhang (>1.75x)'],
    ['safe', '✅ ปลอดภัย (ไร้ CRITICAL & ไร้ VC Dump)']
  ];
  var html = '<span class="pLbl">กรองด่วนเพื่อลงทุน:</span>';
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
    '<div class="stat">โครงการ Privacy แท้ <b>' + DATA.length + '</b> เหรียญ</div>' +
    '<div class="stat">มูลค่าตลาดรวม <b>$' + (mcap / 1e9).toFixed(2) + 'B</b></div>' +
    '<div class="stat" title="เหรียญที่มี Viewing Key/Selective Disclosure (comp=2) + โค้ด Active + P ผ่านเกณฑ์">🟢 พิมพ์เขียว ZEC <b>' + nZecType + '</b></div>' +
    '<div class="stat" title="Composite ≥64 แต่ Market Cap ยังอยู่ในโซนสะสม ($5M–$600M)">💎 เพชรซ่อนมูลค่า (Gems) <b>' + nGem + '</b></div>' +
    '<div class="stat">เกรดเทคนิค v1 ≥ A <b>' + nA + '</b></div>' +
    '<div class="stat">ค่ากลาง 1 ปี <b>' + (med == null ? 'n/a' : (med > 0 ? '+' : '') + med.toFixed(0) + '%') + '</b></div>' +
    '<div class="stat">เวอร์ชันสูตร <b>' + SCORING_VERSION + '</b></div>' +
    '<div class="stat">อัปเดตล่าสุด <b>' + STATS.snap + '</b></div>' +
    '<button id="liveBtn" title="ดึงราคาและข้อมูลตลาดสดจาก CoinGecko ทันที">⟳ ดึงราคาสด (LIVE)</button>' +
    '<span id="liveStatus"></span>';
  $('liveBtn').onclick = liveRefresh;
}

var SPOT = ['ZEC', 'XMR', 'FIRO', 'ARRR', 'ZANO', 'EPIC', 'BDX', 'AZTEC', 'ZAMA', 'ROSE', 'NIGHT', 'DUSK'];
var CHIPS = {
  'TORN': ['SANCTIONED', 'r'],
  'AZTEC': ['ZK ROLLUP · 71% LOCKED', 'a'],
  'XMR': ['SOVEREIGN #1 · NO ETF', ''],
  'ZEC': ['ETF · $25.95B BENCHMARK', 'a'],
  'FIRO': ['SPARK ZK · COMP=2 · GEM', 'a'],
  'ARRR': ['100% SHIELDED · COMP=2', 'a'],
  'ZANO': ['CONF ASSETS · SOVEREIGN', ''],
  'EPIC': ['MIMBLEWIMBLE · CLEAN FLOAT', ''],
  'BDX': ['MID-CAP SOVEREIGN', ''],
  'ROSE': ['CONF EVM · COMP=2', '']
};

function renderSpot() {
  var out = [];
  for (var i = 0; i < SPOT.length; i++) {
    var c = null;
    for (var j = 0; j < DATA.length; j++) if (DATA[j].s === SPOT[i]) { c = DATA[j]; break; }
    if (!c) continue;
    var q = cur(c.s), ev = evalCoin(c), vd = verdictOf(c);
    var note = (q.note || '').length > 95 ? q.note.slice(0, 95) + '…' : (q.note || '');
    var bullBadge = (ev.asy && ev.asy.score != null)
      ? '<span class="chip arch-zec">Bull ' + ev.asy.score + '/100</span>'
      : '';
    var sc = activeScore(c, 'privacy_investor');
    var scBadge = sc != null ? '<span class="chip">Score ' + sc + '</span>' : '';
    out.push('<div class="card ' + (c.s === 'TORN' ? 'risk' : '') + '" data-spot="' + c.s + '" style="cursor:pointer">' +
      '<div class="cRow1"><div><span class="cs">' + c.s + '</span><span class="cn">' + c.n + '</span></div>' +
      '<span class="mono dim" style="font-size:11px">$' + fmtCompact(c.m) + '</span></div>' +
      '<div class="cp">' + fmtPrice(c.p) + ' <span style="font-size:11.5px;font-weight:400">' + fmtPct(c.c24) + '</span></div>' +
      '<div style="margin-top:5px">' + bullBadge + ' ' + scBadge + ' ' + badge(q.model) + '</div>' +
      '<div class="note"><b>' + (q.mech || '') + '</b>' + (note ? ' — ' + note : '') + '</div></div>');
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
  if (k === 'mcap' || k === 'm') return (c.m == null ? -1e18 : c.m);
  if (k === 'comp') {
    var sc = activeScore(c);
    return (sc == null ? -1e18 : sc);
  }
  if (k === 'bull') {
    var ev = evalCoin(c);
    return (ev.asy && ev.asy.score != null) ? ev.asy.score : -1e18;
  }
  if (k && k.indexOf('p_') === 0) {
    var pk = k.slice(2);
    var evP = evalCoin(c);
    return (evP.pl && evP.pl[pk] != null) ? evP.pl[pk] : -1e18;
  }
  if (k === 'v1') {
    var g = gradeOf(dna(c));
    return (g == null ? -1e18 : g);
  }
  if (k === 'sp') {
    var maxS = c.ms || c.ts;
    return (c.cs && maxS && maxS > 0) ? (c.cs / maxS) : -1e18;
  }
  var v = c[k];
  return (v == null ? -1e18 : v);
}

/* ============================================================================
 * 6-Card Institutional Investment Deep-Dive Panel (Expanded Row)
 * ============================================================================ */
var GENE_LABELS = [
  ['hs', '1. ซ่อนผู้ส่ง (Hide Sender)', function (v) { return v === 2 ? 'ปกปิดเต็มรูปแบบ (2/2)' : (v === 1 ? 'เลือกเปิด/ปิดได้ (1/2)' : 'ไม่ปกปิด (0/2)'); }],
  ['hr', '2. ซ่อนผู้รับ (Hide Receiver)', function (v) { return v === 2 ? 'Stealth / Shielded เต็มรูปแบบ (2/2)' : (v === 1 ? 'ปกปิดบางส่วน (1/2)' : 'ไม่ปกปิด (0/2)'); }],
  ['ha', '3. ซ่อนจำนวนเงิน (Hide Amount)', function (v) { return v === 2 ? 'เข้ารหัสยอดเงินมิดชิด (2/2)' : (v === 1 ? 'บดบังผ่านการแบ่งหน่วย (1/2)' : 'เปิดเผยยอดเงิน (0/2)'); }],
  ['hst', '4. ซ่อน State / การคำนวณ (Hide State)', function (v) { return v === 2 ? 'ซ่อน State / คำนวณแบบลับ (2/2)' : (v === 1 ? 'บางส่วน (1/2)' : 'ไม่มี / ไม่ได้ซ่อน (0/2)'); }],
  ['man', '5. การบังคับใช้ Privacy (Mandatory)', function (v) { return v >= 1 ? 'บังคับทุกธุรกรรม 100% (1.0)' : (v >= 0.5 ? 'เปิดเป็นค่าเริ่มต้น Default (0.5)' : 'ต้องกดเลือกเอง Opt-in (0)'); }],
  ['tl', '6. ความไร้ตัวกลาง (Trustlessness)', function (v) { return v >= 2 ? 'ไม่ต้องพึ่งตัวกลาง/Setup (2/2)' : (v >= 1.5 ? 'กระจายศูนย์ผ่าน MPC/Threshold (1.5/2)' : (v >= 1 ? 'พึ่งพา Trusted Setup หรือฮาร์ดแวร์ TEE (1/2)' : 'พึ่งพาตัวกลาง (0/2)')); }],
  ['hmeta', '7. ซ่อนกราฟธุรกรรม (Metadata Protection)', function (v) { return v === 2 ? 'ซ่อนกราฟและป้องกันการจับคู่เวลา/ขนาด (2/2)' : (v === 1 ? 'ซ่อนเนื้อหาแต่ยังเห็นจำนวน Input/Output หรือเวลา (1/2)' : 'เห็นกราฟความเชื่อมโยง (0/2)'); }],
  ['hnet', '8. ซ่อน IP เครือข่าย (Network Anonymity)', function (v) { return v === 2 ? 'มี Mixnet / Dandelion++ / Tor ในระดับโปรโตคอล (2/2)' : (v === 1 ? 'รองรับ Tor/I2P แบบตั้งค่าเอง (1/2)' : 'ส่งข้อมูลผ่าน P2P มาตรฐาน (0/2)'); }],
  ['mat', '9. ความสมบูรณ์ของระบบ (Protocol Maturity)', function (v) { return v === 2 ? 'ใช้งานจริงระดับ Production ยาวนาน (2/2)' : (v === 1 ? 'เปิด Mainnet แล้ว 1–3 ปี (1/2)' : 'เพิ่งเปิดตัว / Alpha (0/2)'); }],
  ['pq', '10. ต้านทานคอมพิวเตอร์ควอนตัม (Post-Quantum)', function (v) { return v === 2 ? 'ออกแบบด้วยอัลกอริทึมต้านควอนตัม (2/2)' : (v === 1 ? 'ต้านทานบางส่วน (1/2)' : 'ยังใช้สมการดั้งเดิม ECC/ Groth16 (0/2)'); }],
  ['aset', '11. ขนาดกลุ่มปกปิดตัวตน (Anonymity Set)', function (v) { return v != null ? fmtNum(v) + ' รายการต่อธุรกรรม' : 'ไม่มี API สาธารณะวัดขนาด Pool แบบเรียลไทม์ (คิดค่าฐานล่าง 0)'; }],
  ['brk', '12. ประวัติช่องโหว่ (Exploit / Break History)', function (v) { return v === 0 ? 'ไม่พบประวัติช่องโหว่ระดับโปรโตคอล (0)' : (v === 0.5 ? 'เคยมีช่องโหว่ในอดีตแต่แพตช์แก้ไขสมบูรณ์แล้ว (0.5)' : (v === 1 ? 'มีช่องโหว่ที่ยังไม่ได้รับการแก้ไข (1.0)' : 'รอการยืนยันสถานะแพตช์')); }],
  ['audit', '13. การตรวจสอบโค้ด (Security Audit)', function (v) { return v === 2 ? 'ผ่าน Audit จากบริษัทชั้นนำหลายแห่ง (2/2)' : (v === 1 ? 'มีกระบวนการตรวจทาน/Audit เบื้องต้น (1/2)' : 'ไม่พบบันทึก Audit ในแหล่งข้อมูลสาธารณะ (0/2)'); }],
  ['comp', '14. เครื่องมือรองรับกฎหมาย (Compliance / Viewing Key)', function (v) { return v === 2 ? 'มี Viewing Keys / Selective Disclosure / Proof of Innocence (2/2)' : (v === 1 ? 'เปิดเผยได้เฉพาะรายธุรกรรมพื้นฐาน หรือซ่อนเฉพาะ IP (1/2)' : 'ไม่มีเครื่องมือเปิดเผยข้อมูลย้อนหลัง (0/2)'); }]
];

function flagForensicHtml(f, c, ev) {
  var sf = ev.sf || {}, m = ev.m || {}, dt = det(c);
  if (f.id === 'fdv_overhang' || f.id === 'locked_overhang') {
    var isPow = (sf.lockedPct < 10 && sf.unminedPct >= 20);
    var detail = isPow
      ? '<b>🔍 เจาะลึกโครงสร้างจริง (ไม่ใช่ VC ล็อก):</b> แม้ FDV จะเป็น <b>' + sf.fdvMcap + 'x</b> ของ Mcap แต่เหรียญที่เสกออกมาแล้วหมุนเวียนอยู่ในตลาดถึง <b>' + sf.circPct + '%</b> (ล็อกจริง <b>' + sf.lockedPct + '%</b>) ส่วนที่เหลืออีก <b>' + fmtNum(sf.unminedTokens) + ' ' + c.s + ' (' + sf.unminedPct + '%)</b> คือเหรียญที่ยังไม่ถูกสร้าง (รอขุดตามบล็อกในอนาคตหลายปี) จึง<b>ไม่มีก้อนเหรียญ VC รอเทขายทันที</b>'
      : '<b>🔍 ผ่าตัวเลขแรงเทขายจากเหรียญที่ล็อกอยู่จริง:</b><br>' +
        '• <b>เหรียญหมุนเวียนในตลาด (Circulating):</b> ' + fmtNum(sf.cs) + ' ' + c.s + ' (<b>' + sf.circPct + '%</b> ของอุปทานสูงสุด) · มูลค่าตลาด <b>$' + fmtCompact(c.m) + '</b><br>' +
        '• <b>เหรียญที่เสกออกมาแล้วแต่ยังล็อกอยู่ (Pre-Minted Locked):</b> <span class="down"><b>' + fmtNum(sf.lockedTokens) + ' ' + c.s + ' (' + sf.lockedPct + '%)</b></span> คิดเป็นมูลค่ารอปลดล็อกสูงถึง <b class="down">' + fmtUsd(sf.lockedUsd) + '</b> ณ ราคาปัจจุบัน!<br>' +
        (sf.unminedTokens > 0 ? '• <b>เหรียญที่ยังไม่ถูกสร้าง/รอขุดตามโปรโตคอล (Unmined):</b> ' + fmtNum(sf.unminedTokens) + ' ' + c.s + ' (' + sf.unminedPct + '%)<br>' : '') +
        '• <b>ทดสอบความเสี่ยงสภาพคล่อง (Liquidity Stress-Test):</b> วอลุ่มเทรด 24 ชม. ทั้งตลาด ($' + fmtCompact(c.v) + '/วัน) ต้องใช้เวลาถึง <b>' + (sf.daysToAbsorbLocked || '—') + ' วันเต็ม</b> เพื่อรับซื้อเหรียญที่ล็อกอยู่ทั้งหมด และหากมีการปลดล็อกออกมาเพียง <b>5% ของก้อนที่ล็อก</b> จะคิดเป็น <b>' + (sf.shock5PctOfVol || '—') + '% ของวอลุ่มเทรดรายวัน</b><br>' +
        '• <b>ผลกระทบต่อราคาและกำไรของคุณ:</b> อัตราส่วน FDV/Mcap = <b>' + sf.fdvMcap + 'x</b> แปลว่าต้องมีเม็ดเงินใหม่ไหลเข้าซื้อสุทธิอีก <b>' + fmtUsd(sf.newCashNeeded) + '</b> เพื่อประคองราคาเดิมไม่ให้ร่วงเมื่อเหรียญปลดล็อกครบ (หาก Market Cap โต 10x ราคาเหรียญจริงจะขึ้นได้เพียง <b>' + (10 / sf.fdvMcap).toFixed(2) + 'x</b>)';
    return '<div class="flgSub">' + detail +
      '<div><a class="flgJump" href="#tokCard_' + c.s + '" onclick="var el=document.getElementById(\'tokCard_' + c.s + '\');if(el){el.scrollIntoView({behavior:\'smooth\',block:\'center\'});el.style.boxShadow=\'0 0 0 2px #f5a623\';}return false;">🔬 ดูตารางชำแหละ Tokenomics &amp; แรงเทขายเหรียญล็อกแบบละเอียดยิบด้านล่าง ↓</a></div></div>';
  }
  if (f.id === 'dead_repo' || f.id === 'dev_stalled') {
    return '<div class="flgSub"><b>🔍 ข้อมูลจริงจาก GitHub:</b> Repo <code>' + (dt.gh_repo_used || '—') + '</code> มีการ Push โค้ดล่าสุดเมื่อ <b>' + (dt.gh_pushed || 'ไม่ทราบ') + ' (' + (m.days_since_push || '—') + ' วันที่แล้ว)</b> · <i>แนวทางรับมือ: ระวังการถือยาวหากทีมพัฒนาไม่ออกอัปเดตหลัก</i></div>';
  }
  if (f.id === 'illiquid') {
    return '<div class="flgSub"><b>🔍 ข้อมูลสภาพคล่องจริง:</b> วอลุ่มเทรด 24 ชม. อยู่ที่ <b>$' + fmtCompact(c.v) + '</b> เทียบกับ Mcap <b>$' + fmtCompact(c.m) + '</b> (Turnover เพียง <b>' + ((m.turnover || 0) * 100).toFixed(2) + '%/วัน</b>) · <i>แนวทางรับมือ: ห้ามลงเงินก้อนใหญ่ในไม้เดียว เพราะเวลาขายออกจะเกิด Slippage กดราคาตัวเอง</i></div>';
  }
  if (f.id === 'wash_suspicion') {
    return '<div class="flgSub"><b>🔍 ข้อมูลสภาพคล่องจริง:</b> วอลุ่มเทรด 24 ชม. (<b>$' + fmtCompact(c.v) + '</b>) สูงกว่ามูลค่าตลาดรวม (<b>$' + fmtCompact(c.m) + '</b>) คิดเป็น Turnover <b>' + ((m.turnover || 0) * 100).toFixed(0) + '%/วัน</b> · <i>แนวทางรับมือ: ระวังความผันผวนระยะสั้นหรือการปั่นวอลุ่มของ Market Maker</i></div>';
  }
  if (f.id === 'micro_cap') {
    return '<div class="flgSub"><b>🔍 ข้อมูลขนาดตลาด:</b> Market Cap ปัจจุบันอยู่ที่ <b>$' + fmtCompact(c.m) + '</b> (ลิสต์อยู่ <b>' + (dt.ex_count || '—') + ' กระดาน</b>) · <i>แนวทางรับมือ: มีโอกาสเติบโตหลายเด้งแต่ความเสี่ยงสูง ควรจำกัดสัดส่วนไม่เกิน 2%–5% ของพอร์ต</i></div>';
  }
  return '';
}

function tokForensicCard(c, ev) {
  var sf = ev.sf;
  if (!sf) return '';
  var tBadge = '';
  var alertBox = '';
  if (sf.tier === 'CRITICAL_LOCK') {
    tBadge = '<span class="vBadge vb-risk">🚨 CRITICAL OVERHANG (' + sf.fdvMcap + 'x FDV/Mcap · ล็อก ' + sf.lockedPct + '%)</span>';
    alertBox = '<div class="tokAlert crit"><b>🚨 คำเตือนระดับสูงสุด (VC / Team Unlock Overhang):</b> เหรียญ <b>' + c.s + '</b> มีเหรียญที่เสกออกมาแล้วแต่ยังล็อกอยู่ถึง <b>' + fmtNum(sf.lockedTokens) + ' เหรียญ (' + sf.lockedPct + '% ของอุปทานทั้งหมด)</b> คิดเป็นมูลค่า <b>' + fmtUsd(sf.lockedUsd) + '</b> ณ ราคาปัจจุบัน (สูงกว่ามูลค่าตลาดหมุนเวียนปัจจุบันถึง <b>' + (sf.fdvMcap - 1).toFixed(2) + ' เท่า</b>) · <b>กลยุทธ์ที่แนะนำ (แบบไม่กาว):</b> <u>ห้ามไล่ราคาเมื่อเหรียญพุ่งแรง</u> เพราะทุกครั้งที่ราคาขึ้น กองทุน/ทีมงานที่มีต้นทุนต่ำจะมีแรงจูงใจเทขายเมื่อปลดล็อก หากต้องการลงทุนควรแบ่งไม้เล็กเก็งกำไรตามรอบ หรือรอให้สัดส่วนเหรียญหมุนเวียนเกิน 50% ก่อนถือยาว</div>';
  } else if (sf.tier === 'HEAVY_LOCK') {
    tBadge = '<span class="vBadge vb-warn">⚠️ HEAVY LOCKED OVERHANG (' + sf.fdvMcap + 'x · ล็อก ' + sf.lockedPct + '%)</span>';
    alertBox = '<div class="tokAlert warn"><b>⚠️ ข้อควรระวัง (เหรียญล็อกระดับสูง):</b> มีเหรียญเสกไว้แล้วรอปลดล็อก <b>' + fmtNum(sf.lockedTokens) + ' เหรียญ (' + sf.lockedPct + '%)</b> มูลค่า <b>' + fmtUsd(sf.lockedUsd) + '</b> · เวลาตั้งเป้าหมายราคาในรอบ Bull Run ต้องดูช่อง <b>"เด้งสุทธิ (หักเหรียญล็อก FDV)"</b> เป็นหลัก เพราะกำไรต่อเหรียญจะถูกหารด้วยจำนวนเหรียญที่เพิ่มขึ้นประมาณ <b>' + sf.fdvMcap + ' เท่า</b></div>';
  } else if (sf.tier === 'MOD_LOCK') {
    tBadge = '<span class="vBadge vb-watch">🔸 MODERATE VESTING (' + sf.fdvMcap + 'x · ล็อก ' + sf.lockedPct + '%)</span>';
    alertBox = '<div class="tokAlert warn"><b>🔸 โครงสร้างเหรียญมีส่วนล็อกปานกลาง (' + sf.lockedPct + '%):</b> เหรียญหมุนเวียนแล้ว <b>' + sf.circPct + '%</b> ยังมีเหรียญที่ล็อกอยู่ในคลัง/ทีมงานอีก <b>' + fmtNum(sf.lockedTokens) + ' เหรียญ (' + fmtUsd(sf.lockedUsd) + ')</b> แรงกดดันการเทขายอยู่ในระดับที่ตลาดพอซับได้ (ใช้วอลุ่มราว <b>' + sf.daysToAbsorbLocked + ' วัน</b>) แต่ยังต้องหักส่วนลด Dilution ราว <b>' + Math.round(100 - sf.retentionPct) + '%</b></div>';
  } else if (sf.tier === 'POW_EMISSION') {
    tBadge = '<span class="vBadge vb-top">⛏️ PROTOCOL / POW EMISSION (' + sf.circPct + '% หมุนเวียน · ล็อก VC 0%)</span>';
    alertBox = '<div class="tokAlert pow"><b>⛏️ โครงสร้างปลอดภัยจาก VC Dump (Unmined Protocol Emission):</b> แม้เพดานสูงสุด (Max Supply) จะทำให้ FDV สูงกว่า Mcap <b>' + sf.fdvMcap + 'x</b> แต่เหรียญที่เสกออกมาแล้วหมุนเวียนอยู่ในตลาดเกือบ 100% (<b>Pre-minted Locked = ' + sf.lockedPct + '%</b>) ส่วนที่เหลืออีก <b>' + fmtNum(sf.unminedTokens) + ' เหรียญ (' + sf.unminedPct + '%)</b> คือเหรียญที่ยังไม่ได้ถูกสร้างและต้องค่อยๆ ขุดตามบล็อกในอนาคตหลายสิบปี จึง<b>ไม่มีแรงเทขายก้อนใหญ่แบบเหรียญ VC</b></div>';
  } else {
    tBadge = '<span class="vBadge vb-gem">💎 CLEAN FLOAT (' + sf.circPct + '% หมุนเวียน · ไร้แรงเทขายเหรียญล็อก)</span>';
    alertBox = '<div class="tokAlert ok"><b>💎 โครงสร้าง Tokenomics สะอาดระดับดีเยี่ยม (Clean Float):</b> เหรียญหมุนเวียนในตลาดแล้วถึง <b>' + sf.circPct + '%</b> (ไร้ก้อนเหรียญล็อกของ VC หรือทีมงานรอทุบ) เมื่อมีเม็ดเงินไหลเข้าซื้อในรอบ Bull Run เม็ดเงินเกือบ <b>' + sf.retentionPct + '%</b> จะส่งผลดันราคาเหรียญขึ้นโดยตรงเหมือนกรณี Zcash และ Monero!</div>';
  }

  var shockTxt = sf.lockedTokens <= 0
    ? '<span class="up">0% (ไม่มีเหรียญเสกล็อกอยู่)</span>'
    : '<b class="' + (sf.shock5PctOfVol > 100 ? 'down' : (sf.shock5PctOfVol > 30 ? 'acc' : 'up')) + '">' + sf.shock5PctOfVol + '% ของวอลุ่มรายวัน</b> (' + fmtUsd(sf.lockedUsd * 0.05) + ')';

  var absorbTxt = sf.lockedTokens <= 0
    ? '<span class="up">0 วัน (ปลอดเหรียญล็อก)</span>'
    : '<b class="' + (sf.daysToAbsorbLocked > 30 ? 'down' : (sf.daysToAbsorbLocked > 7 ? 'acc' : 'up')) + '">' + sf.daysToAbsorbLocked + ' วัน</b> (เทียบ Vol 24h $' + fmtCompact(c.v) + ')';

  return '<div class="ddCard" id="tokCard_' + c.s + '" style="margin-bottom:14px;border-color:' + (sf.tier === 'CRITICAL_LOCK' ? '#8c2d2f' : 'var(--line2)') + '">' +
    '<h3>🔓 3. ผ่าโครงสร้าง Tokenomics, FDV Overhang &amp; วิเคราะห์แรงเทขายเหรียญล็อกแบบละเอียดยิบ (Supply &amp; Unlock Stress-Test) ' + tBadge + '</h3>' +
    '<div class="supBar3">' +
    '<i style="width:' + sf.circPct + '%;background:#2ecc71" title="หมุนเวียนในตลาด (Circulating): ' + sf.circPct + '%"></i>' +
    '<i style="width:' + sf.lockedPct + '%;background:#ff5a5c" title="เสกแล้วแต่ยังล็อกอยู่ (Pre-Minted Locked Overhang): ' + sf.lockedPct + '%"></i>' +
    '<i style="width:' + sf.unminedPct + '%;background:#4cc2ff" title="ยังไม่ถูกสร้าง/รอขุดตามบล็อก (Unmined Future Emission): ' + sf.unminedPct + '%"></i>' +
    '</div>' +
    '<div class="supLeg">' +
    '<span><b class="dot" style="background:#2ecc71"></b> <b>1. หมุนเวียนในตลาด (Circulating):</b> ' + fmtNum(sf.cs) + ' ' + c.s + ' (<b>' + sf.circPct + '%</b> · Mcap $' + fmtCompact(c.m) + ')</span>' +
    '<span><b class="dot" style="background:#ff5a5c"></b> <b>2. เสกแล้วแต่ล็อกอยู่ (Pre-Minted Locked — แรงเทขายจริง):</b> <b class="' + (sf.lockedPct > 25 ? 'down' : '') + '">' + fmtNum(sf.lockedTokens) + ' ' + c.s + ' (' + sf.lockedPct + '% · มูลค่า ' + (sf.lockedUsd > 0 ? fmtUsd(sf.lockedUsd) : '$0') + ')</b></span>' +
    '<span><b class="dot" style="background:#4cc2ff"></b> <b>3. ยังไม่ถูกสร้าง/รอขุดตามบล็อก (Unmined Emission):</b> ' + (sf.isUncapped ? 'ไม่จำกัดเพดาน (Tail Emission ตามบล็อก)' : fmtNum(sf.unminedTokens) + ' ' + c.s + ' (' + sf.unminedPct + '%)') + '</span>' +
    '</div>' +
    '<div class="thesisGrid">' +
    '<div class="tBox"><div class="tk">1. อัตราส่วน FDV / Market Cap จริง</div><div class="tv"><b class="mono ' + (sf.fdvMcap > 2.5 ? 'down' : 'up') + '" style="font-size:15px">' + sf.fdvMcap + 'x</b> <span class="dim">(FDV $' + fmtCompact(sf.effectiveFdv) + ' vs Mcap $' + fmtCompact(c.m) + ')</span></div></div>' +
    '<div class="tBox"><div class="tk">2. เหรียญเสกแล้วที่ล็อกรอปลด (Locked Supply)</div><div class="tv"><b class="mono ' + (sf.lockedPct > 25 ? 'down' : 'up') + '">' + fmtNum(sf.lockedTokens) + ' ' + c.s + '</b> <span class="dim">(' + sf.lockedPct + '% ของเพดานทั้งหมด)</span></div></div>' +
    '<div class="tBox"><div class="tk">3. มูลค่าดอลลาร์ของก้อนที่ล็อกอยู่ ณ ปัจจุบัน</div><div class="tv"><b class="mono ' + (sf.lockedUsd > (c.m || 0) ? 'down' : '') + '" style="font-size:15px">' + (sf.lockedUsd > 0 ? fmtUsd(sf.lockedUsd) : '$0 (ไม่มีเหรียญล็อก)') + '</b></div></div>' +
    '<div class="tBox"><div class="tk">4. วอลุ่มตลาดต้องใช้กี่วันเพื่อซับเหรียญล็อกทั้งหมด</div><div class="tv">' + absorbTxt + '</div></div>' +
    '<div class="tBox"><div class="tk">5. จำลอง Unlock Shock (หากปลดล็อกออกมา 5%)</div><div class="tv">' + shockTxt + '</div></div>' +
    '<div class="tBox"><div class="tk">6. เม็ดเงินใหม่ที่ต้องไหลเข้าเพื่อยันราคาเดิม</div><div class="tv"><b class="mono">' + (sf.newCashNeeded > 0 ? fmtUsd(sf.newCashNeeded) : '$0') + '</b> <span class="dim">เมื่อปลดล็อกครบ 100%</span></div></div>' +
    '<div class="tBox"><div class="tk">7. ประสิทธิภาพการส่งผ่านราคา (Price Retention)</div><div class="tv"><b class="mono ' + (sf.retentionPct >= 75 ? 'up' : (sf.retentionPct >= 45 ? 'acc' : 'down')) + '">' + sf.retentionPct + '%</b> <span class="dim">(Mcap โต 10x → ราคาจริงโต <b>' + (10 * sf.retentionPct / 100).toFixed(2) + 'x</b>)</span></div></div>' +
    '<div class="tBox"><div class="tk">8. คะแนนความสะอาด Tokenomics (ในสูตร Bull)</div><div class="tv"><b class="mono" style="font-size:15px">' + sf.tokScore + ' / 100</b> <span class="dim">(หักน้ำหนักเหรียญล็อก 100% · รอขุด 40%)</span></div></div>' +
    '</div>' +
    alertBox +
    '</div>';
}

function dnaPanel(c) {
  var d = dna(c), q = cur(c.s), dt = det(c), ev = evalCoin(c);
  var pl = ev.pl || {}, asy = ev.asy, sf = ev.sf || {}, vd = verdictOf(c);
  var p2 = pl.Pdetail, v1 = gradeOf(d);
  var cr = compositeRank(c, 'privacy_investor'), bh = compositeRank(c, 'bull_hunter'), br = compositeRank(c, 'asymmetry');
  var inv = state.invAmt || 1000;

  var fdvVal = sf.effectiveFdv || c.fdv || c.m;
  var turnPct = (c.m && c.v) ? ((c.v / c.m) * 100).toFixed(2) + '%' : '—';

  /* Top Executive Banner */
  var banner = '<div class="ddBanner">' +
    '<div class="ddTitle">' +
    (c.img ? '<img src="' + c.img + '" alt="">' : '') +
    '<div><span class="tSym">' + c.s + '</span> <span class="tName">' + c.n + '</span>' +
    (c.rk ? ' <span class="chip">CoinGecko #' + c.rk + '</span>' : '') +
    ' <span class="chip">' + grpOf(c) + '</span> ' + archChip(d) + ' ' + famChip(d.fam) + ' ' + badge(q.model) +
    (asy ? ' ' + archetypeBadge(asy.archetype) : '') + '</div></div>' +
    '<div class="ddQuickKpis">' +
    '<div class="ddKpi"><div class="kLbl">สถานะวิเคราะห์</div><div><span class="vBadge ' + vd.cls + '">' + vd.lbl + '</span></div></div>' +
    '<div class="ddKpi"><div class="kLbl">Composite Score</div><div class="kVal gA">' + (cr ? cr.v + '/100 <span class="dim" style="font-size:11px">(#' + cr.r + ')</span>' : '—') + '</div></div>' +
    '<div class="ddKpi"><div class="kLbl">Bull Upside Score</div><div class="kVal acc">' + (asy ? asy.score + '/100 <span class="dim" style="font-size:11px">(#' + (br ? br.r : '—') + ')</span>' : '—') + '</div></div>' +
    '<div class="ddKpi"><div class="kLbl">Mcap / FDV (' + (sf.fdvMcap || 1) + 'x)</div><div class="kVal">$' + fmtCompact(c.m) + ' <span class="dim" style="font-size:11px">/ $' + fmtCompact(fdvVal) + '</span></div></div>' +
    '<div class="ddKpi"><div class="kLbl">สภาพคล่อง (Turnover)</div><div class="kVal">' + turnPct + ' <span class="dim" style="font-size:11px">(' + (dt.ex_count || '—') + ' กระดาน)</span></div></div>' +
    '</div></div>';

  /* Card 1: Investment Thesis & Summary */
  function tItem(title, val) {
    var txt = (val && typeof val === 'object') ? (val.note || val.v) : val;
    if (!txt) return '';
    return '<div class="tBox"><div class="tk">' + title + '</div><div class="tv">' + txt + '</div></div>';
  }
  var exStr = (dt.ex_count ? dt.ex_count + ' แห่ง' : '') + (dt.ex_top && dt.ex_top.length ? ' (กระดานหลัก: ' + dt.ex_top.slice(0, 5).join(', ') + ')' : '');
  var card1 = '<div class="ddCard"><h3>📌 1. บทสรุปวิเคราะห์การลงทุน (Executive Investment Thesis) <span class="subH">' + vd.desc + '</span></h3>' +
    '<div class="thesisGrid">' +
    tItem('กลไกเทคโนโลยีหลัก (Primitive)', d.prim || q.mech) +
    tItem('สิ่งที่ปกปิดได้จริง (What It Hides)', d.hides) +
    tItem('เงื่อนไขความเชื่อใจ (Trust & Setup)', (d.trust || '') + (d.setup ? ' · Setup: ' + d.setup : '')) +
    tItem('ขนาดกลุ่มปกปิดตัวตน (Anonymity Pool)', d.anonset || (d.aset_note ? d.aset_note : '')) +
    tItem('ท่อสภาพคล่อง & การเข้าถึงตลาด (Market Access)', (q.access ? q.access + ' · ' : '') + (exStr || 'ไม่ระบุ')) +
    tItem('การรองรับกฎหมาย (Compliance Posture)', d.comp) +
    tItem('ประวัติความปลอดภัย & Audit', (d.sec || '') + (d.audit && typeof d.audit === 'string' ? ' · ' + d.audit : '')) +
    tItem('⚠️ ความเสี่ยงสำคัญก่อนตัดสินใจลงทุน', (d.risk || '') + (q.note ? ' · ' + q.note : '')) +
    '</div></div>';

  /* Card 2: Real-Money ROI & Bull-Run Target Price Simulator */
  var roiRows = '';
  if (c.m && c.m > 0 && c.p && c.p > 0) {
    var scenarios = [];
    if (c.ath && c.ath > c.p * 1.05) {
      scenarios.push(['กลับสู่จุดสูงสุดเดิม (ATH เดิม ' + (c.ath_d || '') + ')', c.m * (c.ath / c.p)]);
    }
    scenarios.push(['แตะ Mcap $150M (โซน Breakout ขนาดกลาง)', 1.5e8]);
    scenarios.push(['แตะ Mcap $700M (ฐาน ZEC ก่อนเริ่มรอบ Bull Run)', 7e8]);
    scenarios.push(['แตะ Mcap $2.5B (เป้าหมาย Mid-Cap ตลาดกระทิง)', 2.5e9]);
    scenarios.push(['แตะ Mcap $6.5B (เทียบเท่าระดับ XMR)', 6.5e9]);
    scenarios.push(['แตะ Mcap $25.95B (เทียบเท่ายอด ZEC Bull Peak)', 25.95e9]);

    roiRows = scenarios.map(function (sc) {
      var sim = calcTarget(c, sc[1]);
      if (!sim || sim.mult <= 1.02) {
        return '<tr><td>' + sc[0] + '</td><td class="num dim" colspan="4">มูลค่าตลาดปัจจุบัน ($' + fmtCompact(c.m) + ') สูงกว่าเป้าหมายนี้แล้ว</td></tr>';
      }
      var portNow = inv * sim.mult;
      var portFdv = inv * sim.fdvMult;
      var hasDil = sim.fdvMult < sim.mult * 0.92;
      return '<tr>' +
        '<td><b>' + sc[0] + '</b></td>' +
        '<td class="num"><b class="bright">' + fmtPrice(sim.targetPrice) + '</b></td>' +
        '<td class="num"><b class="up">' + fmtMult(sim.mult) + '</b></td>' +
        '<td class="num">' + (hasDil ? '<span class="down" title="ลดทอนจากเหรียญที่ยังล็อกอยู่">' + fmtMult(sim.fdvMult) + '</span>' : '<span class="up">' + fmtMult(sim.fdvMult) + ' (ไม่โดน Dilute)</span>') + '</td>' +
        '<td class="num"><b class="up">' + fmtUsd(portNow) + '</b>' + (hasDil ? ' <span class="dim">(สุทธิ ' + fmtUsd(portFdv) + ')</span>' : '') + '</td>' +
        '</tr>';
    }).join('');
  } else {
    roiRows = '<tr><td colspan="5" class="dim">ไม่มีข้อมูลราคาหรือ Market Cap สำหรับจำลองผลตอบแทน</td></tr>';
  }
  var maxS = sf.effMax || c.ms || c.ts;
  var floatPct = sf.circPct != null ? Math.round(sf.circPct) : null;
  var card2 = '<div class="ddCard"><h3>💰 2. จำลองเป้าหมายราคา &amp; ผลตอบแทน (เมื่อลงทุน $' + inv.toLocaleString('en-US') + ') ' +
    '<span class="subH">หมุนเวียน: ' + (floatPct != null ? floatPct + '% (' + fmtNum(c.cs) + ' / ' + fmtNum(maxS) + ')' : (c.cs ? fmtNum(c.cs) + ' / ไม่จำกัดเพดาน' : '—')) + '</span></h3>' +
    '<table class="roiTbl"><thead><tr>' +
    '<th>สถานการณ์เป้าหมายในรอบ Bull Run</th>' +
    '<th class="num">ราคาเป้าหมาย</th>' +
    '<th class="num">เด้ง (Supply ปัจจุบัน)</th>' +
    '<th class="num">เด้งสุทธิ (หักเหรียญล็อก FDV)</th>' +
    '<th class="num">พอร์ตจำลอง ($' + inv.toLocaleString('en-US') + ')</th>' +
    '</tr></thead><tbody>' + roiRows + '</tbody></table>' +
    '<div class="dim" style="font-size:11px;margin-top:7px">* หมายเหตุ: ช่อง "เด้งสุทธิ (หักเหรียญล็อก FDV)" คำนวณกรณีเหรียญที่ล็อกอยู่ถูกปลดล็อกออกมาทั้งหมด เพื่อป้องกันกับดักเหรียญ VC ที่ตั้ง Market Cap เริ่มต้นต่ำแต่มี Supply รอเทขาย</div></div>';

  /* Card 3: Tokenomics & FDV Overhang Forensics */
  var cardTok = tokForensicCard(c, ev);

  /* Card 4: 6-Pillar Gauges + Bull-Run Asymmetry Breakdown */
  var dd = pl.Ddetail;
  var pMeta = [
    ['P — Privacy Strength (ความแข็งของกลไกความลับ)', pl.P, p2 ? 'ช่วงความเชื่อมั่น ±' + p2.band + ' · หลักฐาน ' + Math.round(p2.coverage * 100) + '% · เกรด v1 = ' + (v1 != null ? v1 : '—') : 'วัดจากการซ่อนผู้ส่ง/ผู้รับ/จำนวน/State/Metadata'],
    ['D — Developer Velocity (ความเคลื่อนไหวทีมพัฒนา)', pl.D, dd ? 'Repo: ' + dd.repo + ' · Push ล่าสุด ' + dd.pushed + ' (' + dd.days + ' วันที่แล้ว)' + (dd.stars ? ' · ★' + dd.stars : '') : 'วัดจากความถี่การอัปเดตโค้ดบน GitHub'],
    ['L — Liquidity & Market Depth (สภาพคล่องตลาด)', pl.L, 'Volume 24h: $' + fmtCompact(c.v) + ' · Turnover: ' + turnPct + ' ต่อวัน · สัดส่วนเหรียญหมุนเวียน ' + (floatPct != null ? floatPct + '%' : '100%')],
    ['T — Maturity & Lindy Effect (ความเก๋าและอายุเชน)', pl.T, 'เปิดใช้งาน Mainnet ปี ' + (gval(d, 'yr') || '—') + ' · ผ่านการทดสอบใช้งานจริงต่อเนื่อง'],
    ['S — Security & Audit Posture (ความปลอดภัยและ Audit)', pl.S, 'คะแนนรวมคุณภาพ Audit (40%) + ประวัติช่องโหว่ (35%) + โครงสร้าง Trustless (25%)'],
    ['R — Regulatory & CEX Access (ความพร้อมด้านกฎหมาย/CEX)', pl.R, 'คำนวณจาก Censorship Resistance + Viewing Keys (comp=' + (gval(d, 'comp') != null ? gval(d, 'comp') : 'null') + ') + กระดานเทรด (' + (dt.ex_count || '—') + ' แห่ง)']
  ];
  var gaugesHtml = pMeta.map(function (pm) {
    var v = pm[1], col = v == null ? '#3a4859' : (v >= 75 ? '#2ecc71' : (v >= 55 ? '#4cc2ff' : (v >= 35 ? '#f5a623' : '#ff5a5c')));
    return '<div class="pGauge">' +
      '<div class="pgTop"><span>' + pm[0] + '</span><span class="mono" style="color:' + col + '">' + (v == null ? '—' : v + '/100') + '</span></div>' +
      '<div class="pgBar"><i style="width:' + (v == null ? 0 : v) + '%;background:' + col + '"></i></div>' +
      '<div class="pgDesc">' + pm[2] + '</div></div>';
  }).join('');
  var asySubHtml = '';
  if (asy) {
    asySubHtml = '<div style="margin-top:10px;padding-top:9px;border-top:1px solid var(--line);font-size:12px">' +
      '<b>องค์ประกอบคะแนน Bull-Run Asymmetry (' + asy.score + '/100):</b> ' +
      '<span class="chip">1. พื้นฐานรวม (50%) = <b>' + asy.fundamentals + '</b></span> ' +
      '<span class="chip">2. รูมการเติบโต Mcap (20%) = <b>' + asy.upside + '</b></span> ' +
      '<span class="chip">3. ความสะอาด Tokenomics (15%) = <b>' + asy.tokenomics + '</b></span> ' +
      '<span class="chip">4. ท่อรับเงินตลาดกระทิง (15%) = <b>' + asy.rails + '</b></span></div>';
  }
  var card3 = '<div class="ddCard"><h3>📊 4. คะแนนวิเคราะห์เชิงลึกครบ 6 เสาหลัก (6-Pillar Institutional Breakdown) ' +
    '<span class="subH">Privacy Investor: ' + (cr ? cr.v : '—') + ' · Bull Hunter: ' + (bh ? bh.v : '—') + '</span></h3>' +
    '<div class="pGaugeList">' + gaugesHtml + '</div>' + asySubHtml + '</div>';

  /* Card 5: Bull Catalysts vs Red Flags (with Deep Forensic Drill-Downs) */
  var posList = (ev.pos || []).map(function (p) {
    return '<li class="posItem"><span>🟢</span><div><b>' + p.id + ':</b> ' + p.msg + '</div></li>';
  }).join('');
  if (!posList) posList = '<li class="dim" style="padding:6px 0">ยังไม่มีสัญญาณบวกพิเศษตามเกณฑ์อัตโนมัติในรอบนี้</li>';

  var flgList = (ev.fl || []).map(function (f) {
    var cls = (f.lv === 'CRITICAL' || f.lv === 'HIGH') ? 'flgItem' : 'medItem';
    var ic = f.lv === 'CRITICAL' ? '🚨' : (f.lv === 'HIGH' ? '⚠️' : '🔸');
    return '<li class="' + cls + '"><span>' + ic + '</span><div style="width:100%"><div><b>[' + f.lv + ' · ' + f.id + ']</b> ' + f.msg + '</div>' + flagForensicHtml(f, c, ev) + '</div></li>';
  }).join('');
  if (!flgList) flgList = '<li class="posItem"><span>✅</span><div><b>ไม่พบธงแดง (0 Red Flags):</b> ผ่านเกณฑ์ตรวจสอบความเสี่ยงพื้นฐานและไม่มีระเบิดเวลา FDV Overhang</div></li>';

  var card4 = '<div class="ddCard"><h3>⚡ 5. สัญญาณบวกหนุนราคา (Bull Catalysts) vs เจาะลึกความเสี่ยงธงแดง (Red Flags Forensics) ' +
    '<span class="subH">บวก ' + (ev.pos ? ev.pos.length : 0) + ' · เตือน ' + (ev.fl ? ev.fl.length : 0) + '</span></h3>' +
    '<div class="ddGrid2" style="margin-bottom:0;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">' +
    '<div><div style="font-weight:700;color:var(--up);margin-bottom:6px;font-size:12px">🟢 ปัจจัยบวกและสัญญาณต้นรอบ (Alpha Catalysts)</div><ul class="chkList">' + posList + '</ul></div>' +
    '<div><div style="font-weight:700;color:var(--down);margin-bottom:6px;font-size:12px">🚨 ความเสี่ยงและจุดที่ต้องระวัง (Risk &amp; Red Flags — พร้อมข้อมูลจริงรายตัว)</div><ul class="chkList">' + flgList + '</ul></div>' +
    '</div></div>';

  /* Card 6: 14-Gene Evidence & Source Verification Table */
  var evRows = GENE_LABELS.map(function (gl) {
    var key = gl[0], label = gl[1], fmtFn = gl[2];
    var raw = d[key];
    var v = gval(d, key);
    var conf = gconf(d, key);
    var src = gsrc(d, key);
    var note = (raw && typeof raw === 'object' && raw.note) ? raw.note : '';
    var confBadge = v == null ? '<span class="chip dim">ไม่มีข้อมูล (Floored 0)</span>'
                  : (conf === 'high' ? '<span class="chip arch-zec">HIGH</span>'
                  : (conf === 'med' ? '<span class="chip arch-cmp">MED</span>' : '<span class="chip">LOW</span>'));
    var srcLink = src ? '<a class="lk" href="' + src + '" target="_blank" rel="noopener" style="padding:1px 7px;font-size:10.5px">เปิดหลักฐาน ↗</a>' : '<span class="dim">—</span>';
    return '<tr>' +
      '<td><b>' + label + '</b></td>' +
      '<td>' + fmtFn(v) + '</td>' +
      '<td>' + confBadge + '</td>' +
      '<td class="dim">' + (note || '—') + '</td>' +
      '<td class="num">' + srcLink + '</td>' +
      '</tr>';
  }).join('');

  var card5 = '<div class="ddCard" style="margin-bottom:14px"><h3>🧬 6. ตารางชำแหละ 14 ยีนเทคนิคความลับ &amp; ลิงก์หลักฐานอ้างอิงที่ตรวจสอบได้จริง (Verified Cryptographic DNA) ' +
    '<span class="subH">ทุกค่ามีแหล่งอ้างอิงตรวจสอบได้ ไม่มีการเดาคะแนนฟรี</span></h3>' +
    '<table class="evTbl"><thead><tr>' +
    '<th>มิติทางเทคนิค (Gene)</th><th>ผลการประเมิน</th><th>ความเชื่อมั่น</th><th>หมายเหตุ / รายละเอียดเชิงลึก</th><th class="num">เอกสารอ้างอิง</th>' +
    '</tr></thead><tbody>' + evRows + '</tbody></table></div>';

  /* Card 7: Market Depth, GitHub Stats & Official Due Diligence Links */
  function lnk(url, label) { return url ? '<a class="lk" href="' + url + '" target="_blank" rel="noopener">🔗 ' + label + ' ↗</a>' : ''; }
  var linksHtml = lnk(dt.home, 'เว็บไซต์ทางการ') + lnk(dt.wp, 'Whitepaper / เอกสารเทคนิค') + lnk(dt.gh, 'GitHub โค้ดต้นฉบับ') +
    lnk(dt.explorer, 'Block Explorer') + lnk(dt.tw ? 'https://x.com/' + dt.tw : '', 'X / Twitter') +
    lnk(dt.tg ? 'https://t.me/' + dt.tg : '', 'Telegram') + lnk(dt.dc, 'Discord') +
    lnk(dt.reddit, 'Reddit') + lnk(dt.forum, 'Forum') +
    lnk('https://www.coingecko.com/en/coins/' + c.id, 'หน้าข้อมูล CoinGecko');

  var mStats = [
    ['กรอบราคา 24 ชม. (24h Low – High)', (c.l24 && c.h24) ? fmtPrice(c.l24) + ' – ' + fmtPrice(c.h24) : '—'],
    ['ราคาสูงสุดตลอดกาล (All-Time High)', c.ath ? fmtPrice(c.ath) + ' (' + (c.ath_c != null ? c.ath_c.toFixed(1) + '%' : '') + ' · ' + (c.ath_d || '') + ')' : '—'],
    ['ราคาต่ำสุดตลอดกาล (All-Time Low)', c.atl ? fmtPrice(c.atl) + ' (+' + (c.atl_c != null ? Math.round(c.atl_c) + '%' : '') + ' · ' + (c.atl_d || '') + ')' : '—'],
    ['วันเปิดตัวเครือข่าย (Genesis / Mainnet)', (dt.genesis || '') + (gval(d, 'yr') ? ' (ปี ' + gval(d, 'yr') + ')' : '') || '—'],
    ['อัลกอริทึม / การปกครอง (Governance)', (dt.algo ? dt.algo + ' · ' : '') + (d.gov || '—')],
    ['สถิติ GitHub นักพัฒนา', (dd ? dd.repo + ' · Push ล่าสุด ' + dd.pushed + ' (' + dd.days + ' วันก่อน)' : '—') + (dt.stars ? ' · ★' + fmtNum(dt.stars) : '') + (dt.forks ? ' · Forks ' + fmtNum(dt.forks) : '')],
    ['ไทม์ไลน์เหตุการณ์สำคัญ', d.hist || '—'],
    ['ความเชื่อมั่นตลาด & ชุมชน', (dt.sent_up != null ? 'Sentiment บวก ' + Math.round(dt.sent_up) + '% · ' : '') + (dt.watch ? 'คนเฝ้าดูบน CoinGecko ' + fmtNum(dt.watch) + ' คน' : '')]
  ];
  var mGrid = mStats.map(function (ms) {
    return '<div class="tBox"><div class="tk">' + ms[0] + '</div><div class="tv">' + ms[1] + '</div></div>';
  }).join('');

  var sparkBox = (dt.spark && dt.spark.length > 2)
    ? '<div class="sparkBox"><div class="tk" style="font-size:10px;color:var(--dim)">แนวโน้มราคา 7 วันล่าสุด</div>' +
      sparkSvg(dt.spark, 320, 64, sparkColor(dt.spark)) +
      '<div class="mono dim" style="font-size:11px">ต่ำสุด ' + fmtPrice(Math.min.apply(null, dt.spark)) + ' — สูงสุด ' + fmtPrice(Math.max.apply(null, dt.spark)) + '</div></div>'
    : '';

  var card6 = '<div class="ddCard"><h3>🌐 7. ข้อมูลตลาดเชิงลึก, GitHub &amp; ลิงก์ตรวจสอบด้วยตัวเอง (Due Diligence Dossier)</h3>' +
    (linksHtml ? '<div class="links">' + linksHtml + '</div>' : '') +
    (dt.desc ? '<p class="desc">' + dt.desc + '</p>' : '') +
    sparkBox +
    '<div class="thesisGrid" style="margin-top:8px">' + mGrid + '</div>' +
    (dt.repo_note ? '<div class="dim" style="font-size:11.5px;margin-top:8px">ℹ️ หมายเหตุ Repo: ' + dt.repo_note + '</div>' : '') +
    '</div>';

  return '<div class="ddWrap">' +
    banner +
    '<div class="ddGrid2">' + card1 + card2 + '</div>' +
    cardTok +
    '<div class="ddGrid2">' + card3 + card4 + '</div>' +
    card5 +
    card6 +
    '</div>';
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
    [7e8, 'เป้า $700M (ฐาน ZEC ก่อนวิ่ง)'],
    [2.5e9, 'เป้า $2.5B (Mid-Cap Bull)'],
    [6.5e9, 'เป้า $6.5B (ระดับ XMR)'],
    [25.95e9, 'เป้า $25.95B (ยอด ZEC Peak)']
  ];
  var inv = state.invAmt || 1000;

  function cardHtml(r) {
    var c = r.c, a = r.ev.asy, pl = r.ev.pl || {}, vd = verdictOf(c);
    var posChips = (r.ev.pos || []).slice(0, 3).map(function (p) {
      return '<span class="chip b-sel">🟢 ' + p.id + '</span>';
    }).join(' ');
    var sim = calcTarget(c, state.targetMcap);
    var simHtml = '';
    if (sim && sim.mult > 1.05) {
      var portVal = inv * sim.mult;
      var dilNote = (sim.fdvMult < sim.mult * 0.88) ? ' <span class="down">(สุทธิ FDV: ' + fmtMult(sim.fdvMult) + ')</span>' : ' <span class="up">(ไม่โดน Dilute)</span>';
      simHtml = '<div class="multBox"><div><div>หากแตะ <b>$' + fmtCompact(state.targetMcap) + '</b> → ราคา <b>' + fmtPrice(sim.targetPrice) + '</b></div>' +
        '<div class="dim">ทุน $' + inv.toLocaleString('en-US') + ' → <b class="up">' + fmtUsd(portVal) + '</b>' + dilNote + '</div></div>' +
        '<span class="mVal">' + fmtMult(sim.mult) + '</span></div>';
    } else {
      simHtml = '<div class="multBox"><span class="dim">Mcap ปัจจุบัน ($' + fmtCompact(c.m) + ') สูงกว่าเป้าหมายที่เลือกแล้ว</span><span class="dim">—</span></div>';
    }
    return '<div class="bullCard" data-bcard="' + c.s + '">' +
      '<div class="bTop"><div><span class="bSym">' + c.s + '</span> <span class="dim">' + c.n + '</span></div>' +
      '<div class="bScore">Bull ' + a.score + '/100</div></div>' +
      '<div class="bullBar"><i style="width:' + a.score + '%"></i></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>Mcap: <b class="mono">$' + fmtCompact(c.m) + '</b> · ราคา <b class="mono">' + fmtPrice(c.p) + '</b></span><span>30d ' + fmtPct(c.c30) + '</span></div>' +
      simHtml +
      '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">' +
      '<span class="chip">พื้นฐาน ' + a.fundamentals + '</span>' +
      '<span class="chip">รูม Mcap ' + a.upside + '</span>' +
      '<span class="chip">Tokenomics ' + a.tokenomics + '</span>' +
      '<span class="chip">ท่อ CEX/กม. ' + a.rails + '</span>' +
      '</div>' +
      '<div><span class="vBadge ' + vd.cls + '" style="font-size:10px;padding:1px 6px">' + vd.lbl + '</span> ' + posChips + '</div>' +
      '</div>';
  }

  var out = [];
  out.push('<div class="rubric"><b>⚡ Bull-Run Asymmetry Radar — ทำไม Zcash (ZEC) ถึงขึ้นจาก $700M ไป $25.95B (~37x) และเราจะหาตัวถัดไปอย่างไร?</b><br>' +
    'ในตลาดกระทิง เหรียญที่จะเกิดการ Re-rate ระดับ 10x–35x ต้องมีครบ 4 แกนพร้อมกัน: ' +
    '<b>(1) Fundamentals 50%</b> (กลไกความลับ P แข็งจริง, โค้ด Active D, ความปลอดภัย S, อายุเครือข่าย T) &nbsp;·&nbsp; ' +
    '<b>(2) Valuation Upside Room 20%</b> (Market Cap ยังอยู่ในโซนสะสม $5M–$800M และถูกคูณถ่วงน้ำหนักด้วย P เพื่อกันเหรียญกลไกอ่อนแอ) &nbsp;·&nbsp; ' +
    '<b>(3) Clean Tokenomics 15%</b> (สัดส่วนเหรียญหมุนเวียนสูง ไม่โดน VC เทปลดล็อก) &nbsp;·&nbsp; ' +
    '<b>(4) Market Access Rails 15%</b> (มี Viewing Keys / Selective Disclosure <code>comp=2</code> รองรับเกณฑ์สถาบัน/CEX เหมือน ZEC)</div>');

  out.push('<div class="simBar"><div class="sTitle">🎯 เลือกเป้าหมาย Market Cap เพื่อจำลองกำไร (จากเงินทุน $' + inv.toLocaleString('en-US') + ' / เหรียญ):</div><div class="simBtns">' +
    tBench.map(function (b) {
      return '<button class="simBtn' + (state.targetMcap === b[0] ? ' on' : '') + '" data-tmcap="' + b[0] + '">' + b[1] + '</button>';
    }).join('') +
    '</div><span class="dim" style="font-size:11.5px;margin-left:auto">คลิกที่การ์ดหรือแถวใดก็ได้เพื่อเปิดรายงานเจาะลึก 6 มิติ</span></div>');

  out.push('<div class="secHead"><h2>🟢 กลุ่มที่ 1: พิมพ์เขียว ZEC (ZEC-ARCHETYPE — มี Viewing Keys / Selective Disclosure comp=2 + กลไกความลับแข็ง + โค้ด Active)</h2></div>');
  out.push('<div class="bullGrid">' + (zecList.length ? zecList.map(cardHtml).join('') : '<div class="dim">ไม่พบเหรียญที่ตรงเงื่อนไข</div>') + '</div>');

  out.push('<div class="secHead"><h2>🛡️ กลุ่มที่ 2: Sovereign Privacy Gems (SOVEREIGN-PRIV — ความลับ Default/Mandatory P ≥65 + โซนสะสม + ไร้ VC Overhang)</h2></div>');
  out.push('<div class="bullGrid">' + (sovList.length ? sovList.map(cardHtml).join('') : '<div class="dim">ไม่พบเหรียญที่ตรงเงื่อนไข</div>') + '</div>');

  out.push('<div class="secHead"><h2>📊 ตารางเปรียบเทียบ Bull-Run Asymmetry &amp; ผลตอบแทนจำลองครบทุกแกน (' + rows.length + ' เหรียญ)</h2></div>');
  out.push('<table class="mx"><thead><tr>' +
    '<th>#</th><th>เหรียญ</th><th>สถานะลงทุน</th><th class="num">Bull Score</th><th class="num">Score รวม</th>' +
    '<th class="num">หากแตะ $' + fmtCompact(state.targetMcap) + ' (ทุน $' + inv.toLocaleString('en-US') + ')</th>' +
    '<th class="num">พื้นฐาน (50%)</th><th class="num">รูม Mcap (20%)</th><th class="num">Tokenomics (15%)</th><th class="num">ท่อ CEX (15%)</th>' +
    '<th class="num">Mcap ปัจจุบัน</th><th>P · D · L · T · S · R</th><th>🟢 สัญญาณบวก</th><th>⚠️ ธงแดง</th>' +
    '</tr></thead><tbody>');
  for (var j = 0; j < rows.length; j++) {
    var r = rows[j], c = r.c, a = r.ev.asy, pl = r.ev.pl || {}, vd = verdictOf(c);
    var pStr = [pl.P, pl.D, pl.L, pl.T, pl.S, pl.R].map(function (x) { return x == null ? '—' : x; }).join(' · ');
    var posHtml = (r.ev.pos || []).map(function (p) { return '<span class="chip b-sel">🟢 ' + p.id + '</span>'; }).join(' ');
    var flHtml = (r.ev.fl || []).map(function (f) { return '<span class="chip fl-' + f.lv + '">' + f.id + '</span>'; }).join(' ');
    var simRow = calcTarget(c, state.targetMcap);
    var multCell = (simRow && simRow.mult > 1.05)
      ? '<b class="up">' + fmtMult(simRow.mult) + '</b> → <b>' + fmtUsd(inv * simRow.mult) + '</b> <span class="dim">(@' + fmtPrice(simRow.targetPrice) + ')</span>'
      : '<span class="dim">ผ่านเป้าแล้ว</span>';
    out.push('<tr data-bcard="' + c.s + '" class="row">' +
      '<td class="num dim">' + (j + 1) + '</td>' +
      '<td class="coin"><span class="sym">' + c.s + '</span><span class="nm">' + c.n + '</span></td>' +
      '<td><span class="vBadge ' + vd.cls + '">' + vd.lbl + '</span></td>' +
      '<td class="num"><b class="gA" style="font-size:14px">' + a.score + '</b></td>' +
      '<td class="num"><b>' + (r.pi == null ? '—' : r.pi) + '</b></td>' +
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
  $('count').textContent = rows.length + ' / ' + DATA.length + ' โครงการ (Bull-Run Radar)';

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

/* ============================================================================
 * Personal Gem Finder & FDV Trap Scanner ("เครื่องมือส่วนตัวคัดเพชรเม็ดงาม — ไม่กาว")
 * ============================================================================ */
function renderGems() {
  var gw = $('gemsWrap');
  if (!gw) return;
  var inv = state.invAmt || 1000;
  var rows = [];
  for (var i = 0; i < DATA.length; i++) {
    var c = DATA[i];
    if (!matchesQuery(c)) continue;
    var ev = evalCoin(c);
    var pi = activeScore(c, 'privacy_investor');
    var bh = activeScore(c, 'bull_hunter');
    var bull = (ev.asy && ev.asy.score != null) ? ev.asy.score : null;
    rows.push({ c: c, ev: ev, pi: pi, bh: bh, bull: bull, sf: ev.sf || {} });
  }

  /* 1. High-Conviction Clean Gems:
   *    - Validated privacy & fundamentals (bull >= 66 or pi >= 60)
   *    - Accumulation / Mid-cap zone ($3M <= mcap <= $650M)
   *    - Clean tokenomics (lockedPct <= 25% and tier !== 'CRITICAL_LOCK' and tier !== 'HEAVY_LOCK')
   *    - No CRITICAL red flags & not sanctioned */
  var cleanGems = rows.filter(function (r) {
    var m = r.c.m || 0;
    return r.bull != null && r.bull >= 66 && m >= 3e6 && m <= 6.5e8 &&
           !r.ev.hasCrit && !gval(dna(r.c), 'sanctioned') &&
           (r.sf.lockedPct || 0) <= 25 && r.sf.tier !== 'CRITICAL_LOCK' && r.sf.tier !== 'HEAVY_LOCK';
  }).sort(function (a, b) { return (b.bull || 0) - (a.bull || 0) || (b.pi || 0) - (a.pi || 0); });

  /* 2. Core Blue-Chip Anchors ($200M+ Mcap, high liquidity, clean/manageable float) */
  var coreAnchors = rows.filter(function (r) {
    var m = r.c.m || 0;
    return r.bull != null && m > 2e8 && !r.ev.hasCrit && !gval(dna(r.c), 'sanctioned') && (r.sf.lockedPct || 0) <= 35;
  }).sort(function (a, b) { return (b.bull || 0) - (a.bull || 0); });

  /* 3. High-FDV / Locked Overhang Watchlist (fdvMcap > 1.75 or lockedPct >= 30%) */
  var fdvTraps = rows.filter(function (r) {
    return r.sf && (r.sf.fdvMcap > 1.75 || r.sf.lockedPct >= 30);
  }).sort(function (a, b) { return (b.sf.lockedPct || 0) - (a.sf.lockedPct || 0) || (b.sf.fdvMcap || 0) - (a.sf.fdvMcap || 0); });

  function gemPlaybookCard(r, kind) {
    var c = r.c, d = dna(c), q = cur(c.s), dt = det(c), ev = r.ev, pl = ev.pl || {}, sf = r.sf || {}, asy = ev.asy || {};
    var isTrap = (kind === 'trap');
    var turnPct = (c.m && c.v) ? ((c.v / c.m) * 100).toFixed(2) + '%/วัน' : '—';

    /* Realistic Base Target vs Bull Target (after FDV dilution!) */
    var mcap = c.m || 0;
    var baseTargetMcap = mcap < 2.5e7 ? 1.5e8 : (mcap < 1.5e8 ? 7e8 : (mcap < 8e8 ? 2.5e9 : 6.5e9));
    var bullTargetMcap = mcap < 2.5e7 ? 7e8 : (mcap < 1.5e8 ? 2.5e9 : (mcap < 8e8 ? 6.5e9 : 25.95e9));
    var simBase = calcTarget(c, baseTargetMcap);
    var simBull = calcTarget(c, bullTargetMcap);

    /* Data-backed Why Bullish (No Hype) */
    var whyBull = [];
    if (gval(d, 'comp') === 2) whyBull.push('มี <b>Viewing Key / Selective Disclosure (comp=2)</b> รองรับเกณฑ์สถาบันและ CEX เหมือน ZEC');
    if (pl.P >= 70) whyBull.push('กลไกความลับระดับแข็งแกร่งมาก (<b>P=' + pl.P + '/100</b> · ' + (d.prim || q.mech || '') + ')');
    else if (pl.P >= 45) whyBull.push('กลไกความลับผ่านเกณฑ์มาตรฐาน (<b>P=' + pl.P + '/100</b> · ' + (d.prim || q.mech || '') + ')');
    if (pl.D >= 80) whyBull.push('ทีมพัฒนา Active สูงบน GitHub (<b>D=' + pl.D + '/100</b>)');
    if (sf.lockedPct <= 5) whyBull.push('<b>ไร้ระเบิดเวลา VC Lock</b> (เหรียญเสกล็อก ' + sf.lockedPct + '% · ประสิทธิภาพส่งผ่านราคา ' + sf.retentionPct + '%)');
    if (dt.ex_count >= 10) whyBull.push('สภาพคล่องเข้าถึงง่าย ลิสต์อยู่ <b>' + dt.ex_count + ' กระดานเทรด</b> (Turnover ' + turnPct + ')');
    if (!whyBull.length) whyBull.push((d.prim || q.mech || 'เทคโนโลยีเฉพาะทาง') + ' · Mcap ปัจจุบัน $' + fmtCompact(c.m));

    /* Honest Risk Disclosure (No Hype!) */
    var honestRisks = [];
    if (sf.lockedPct >= 30) {
      honestRisks.push('🚨 <b>แรงเทขายเหรียญล็อกสูงมาก:</b> มีเหรียญเสกล็อกรอปลดถึง <b>' + fmtNum(sf.lockedTokens) + ' ' + c.s + ' (' + sf.lockedPct + '% · มูลค่า ' + fmtUsd(sf.lockedUsd) + ')</b> วอลุ่มปัจจุบันต้องใช้ <b>' + sf.daysToAbsorbLocked + ' วัน</b> เพื่อรับของ');
    } else if (sf.lockedPct >= 10) {
      honestRisks.push('🔸 มีเหรียญล็อกรอปลดล็อก <b>' + sf.lockedPct + '% (' + fmtUsd(sf.lockedUsd) + ')</b> ต้องหักส่วนลด Dilution ราว ' + (100 - sf.retentionPct) + '%');
    }
    if (ev.fl && ev.fl.length) {
      ev.fl.forEach(function (f) { honestRisks.push('⚠️ <b>[' + f.id + ']</b> ' + f.msg); });
    }
    if (d.risk) honestRisks.push('📌 <b>ข้อจำกัดเชิงเทคนิค/ตลาด:</b> ' + d.risk);
    if (!honestRisks.length) honestRisks.push('ความผันผวนตามรอบตลาดคริปโตและเกณฑ์กำกับดูแลเหรียญ Privacy ในแต่ละประเทศ');

    /* Actionable Strategy */
    var actionPlan = '';
    if (isTrap) {
      actionPlan = '🛑 <b>ห้ามไล่ราคาเด็ดขาด (Avoid Chasing Pumps):</b> แม้เทคโนโลยี (' + (d.fam || d.prim || '') + ') จะน่าสนใจ แต่ FDV สูงถึง <b>$' + fmtCompact(sf.effectiveFdv) + ' (' + sf.fdvMcap + 'x ของ Mcap)</b> แนะนำให้ใช้กลยุทธ์ <b>"ดักซื้อเมื่อย่อแรงหลังวัน Unlock หรือรอสัดส่วนหมุนเวียนเกิน 50%"</b>';
    } else if (kind === 'core') {
      actionPlan = '🏛️ <b>กลยุทธ์พอร์ตหลัก (Core Allocation 15%–25%):</b> สภาพคล่องสูง ($' + fmtCompact(c.v) + '/วัน) โครงสร้างเหรียญสะอาด เหมาะสำหรับทยอยสะสม (DCA) เป็นแกนหลักของพอร์ต Privacy เพื่อรับเม็ดเงินรอบใหญ่';
    } else {
      var sz = (c.m && c.m >= 4e7 && (dt.ex_count || 0) >= 8) ? '5%–12% ของพอร์ต' : '2%–5% ของพอร์ต (แบ่งไม้ซื้อเพื่อลด Slippage)';
      actionPlan = '💎 <b>กลยุทธ์สะสมเพชรเม็ดงาม (Suggested Sizing: ' + sz + '):</b> พื้นฐานผ่านเกณฑ์ (Bull Score <b>' + r.bull + '</b>) และไม่มีก้อนเหรียญ VC รอทุบ สามารถทยอยเก็บสะสมช่วงตลาดพักตัว';
    }

    var targetHtml = '';
    if (simBase && simBull) {
      targetHtml = '<div class="gemSecBox" style="border-color:#1e3a2f;background:#081310">' +
        '<div class="gLbl" style="color:var(--teal)">🎯 กรอบเป้าหมายราคาตามข้อมูลจริง (หัก Dilution เหรียญล็อกแล้ว)</div>' +
        '<div>• <b>เป้าฐาน (แตะ Mcap $' + fmtCompact(baseTargetMcap) + '):</b> ราคา <b>' + fmtPrice(simBase.targetPrice * (sf.retentionPct / 100)) + '</b> (<b class="up">' + fmtMult(simBase.fdvMult) + ' สุทธิ</b> · ทุน $' + inv.toLocaleString('en-US') + ' → <b>' + fmtUsd(inv * simBase.fdvMult) + '</b>)</div>' +
        '<div>• <b>เป้ากระทิง (แตะ Mcap $' + fmtCompact(bullTargetMcap) + '):</b> ราคา <b>' + fmtPrice(simBull.targetPrice * (sf.retentionPct / 100)) + '</b> (<b class="up">' + fmtMult(simBull.fdvMult) + ' สุทธิ</b> · ทุน $' + inv.toLocaleString('en-US') + ' → <b>' + fmtUsd(inv * simBull.fdvMult) + '</b>)</div>' +
        '</div>';
    }

    return '<div class="gemCard' + (isTrap ? ' trapCard' : '') + '" data-bcard="' + c.s + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
      '<div><span style="font:800 18px var(--mono);color:var(--bright)">' + c.s + '</span> <span class="dim" style="font-size:13px">' + c.n + '</span>' +
      '<div style="margin-top:3px">' + archetypeBadge(asy.archetype) + ' ' + famChip(d.fam) + ' <span class="chip">P=' + (pl.P != null ? pl.P : '?') + ' · D=' + (pl.D != null ? pl.D : '?') + ' · R=' + (pl.R != null ? pl.R : '?') + '</span></div></div>' +
      '<div style="text-align:right"><div style="font:800 15px var(--mono);color:' + (isTrap ? '#ff6b6d' : '#4ce89d') + '">' + (isTrap ? 'FDV ' + sf.fdvMcap + 'x' : 'Bull ' + (r.bull || '—') + '/100') + '</div>' +
      '<div class="mono dim" style="font-size:11px">Mcap $' + fmtCompact(c.m) + ' · ' + fmtPrice(c.p) + '</div></div></div>' +
      '<div class="supBar3" style="margin:3px 0">' +
      '<i style="width:' + sf.circPct + '%;background:#2ecc71"></i>' +
      '<i style="width:' + sf.lockedPct + '%;background:#ff5a5c"></i>' +
      '<i style="width:' + sf.unminedPct + '%;background:#4cc2ff"></i></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--tx2)">' +
      '<span>🟢 หมุนเวียน <b>' + sf.circPct + '%</b></span>' +
      '<span class="' + (sf.lockedPct > 25 ? 'down' : '') + '">🔴 เสกล็อก <b>' + sf.lockedPct + '%</b> (' + (sf.lockedUsd > 0 ? fmtUsd(sf.lockedUsd) : '$0') + ')</span>' +
      '<span>🔵 รอขุด <b>' + sf.unminedPct + '%</b></span></div>' +
      '<div class="gemSecBox"><div class="gLbl" style="color:#4ce89d">✅ ทำไมถึงน่าสนใจ (Data-Backed Thesis)</div><div>• ' + whyBull.join('<br>• ') + '</div></div>' +
      '<div class="gemSecBox" style="border-color:rgba(255,90,92,.3)"><div class="gLbl" style="color:#ff7a7c">🚨 ความเสี่ยงจริงที่ต้องระวัง (ไม่กาว)</div><div>' + honestRisks.join('<br>') + '</div></div>' +
      targetHtml +
      '<div class="gemSecBox" style="border-color:rgba(76,194,255,.3)"><div class="gLbl" style="color:var(--accent)">🧭 แผนการลงทุนแนะนำ (Playbook)</div><div>' + actionPlan + '</div></div>' +
      '</div>';
  }

  var out = [];
  out.push('<div class="rubric"><b>💎 เครื่องมือคัดเพชรเม็ดงาม &amp; ผ่ากับดัก FDV ส่วนตัว (Zero-Hype Personal Investment Advisor)</b><br>' +
    '<i>"ทุกอย่างคือการลงทุน การลงทุนมีความเสี่ยง — เราจะไม่กาว แต่ใช้ข้อมูลจริงคัดเหรียญที่มีแต้มต่อสูงสุด"</i><br>' +
    'ระบบนี้แยกแยะ <b>"เพชรเม็ดงามที่ของจริงและโครงสร้างเหรียญสะอาด (Clean Asymmetric Gems)"</b> ออกจาก <b>"เหรียญเทคโนโลยีดีแต่ติดระเบิดเวลา VC Unlock (FDV Overhang &gt; 3x)"</b> พร้อมคำนวณเป้าราคาสุทธิหลังหัก Dilution และความเสี่ยงจริงทุกมิติ คลิกที่การ์ดหรือแถวใดก็ได้เพื่อกางรายงานฉบับเต็ม</div>');

  out.push('<div class="secHead"><h2>💎 ตะกร้าที่ 1: เพชรเม็ดงามพร้อมสะสม (Clean Asymmetric Gems — พื้นฐานแกร่ง · โซนสะสม $3M–$650M · ไร้ระเบิดเวลา VC Lock) [' + cleanGems.length + ' เหรียญ]</h2></div>');
  out.push('<div class="gemGrid">' + (cleanGems.length ? cleanGems.map(function (r) { return gemPlaybookCard(r, 'gem'); }).join('') : '<div class="dim">ไม่พบเหรียญที่ตรงตามตัวกรอง</div>') + '</div>');

  out.push('<div class="secHead"><h2>🏛️ ตะกร้าที่ 2: เสาหลักพอร์ตสถาบัน &amp; สภาพคล่องสูง (Core Blue-Chip Anchors — Mcap &gt;$200M · สภาพคล่องลึก) [' + coreAnchors.length + ' เหรียญ]</h2></div>');
  out.push('<div class="gemGrid">' + (coreAnchors.length ? coreAnchors.map(function (r) { return gemPlaybookCard(r, 'core'); }).join('') : '<div class="dim">ไม่พบเหรียญที่ตรงตามตัวกรอง</div>') + '</div>');

  out.push('<div class="secHead"><h2>🚨 ตะกร้าที่ 3: บัญชีเฝ้าระวัง "ติดล็อก FDV Overhang สูง" (High-FDV &amp; Locked Supply Watchlist — ห้ามไล่ราคา! ต้องรอจังหวะปลดล็อก) [' + fdvTraps.length + ' เหรียญ]</h2></div>');
  out.push('<div class="gemGrid">' + (fdvTraps.length ? fdvTraps.map(function (r) { return gemPlaybookCard(r, 'trap'); }).join('') : '<div class="dim">ไม่พบเหรียญที่ตรงตามตัวกรอง</div>') + '</div>');

  /* Full-Sector FDV Overhang & Supply Anatomy Table */
  var allByOverhang = rows.slice().sort(function (a, b) {
    return (b.sf.lockedPct || 0) - (a.sf.lockedPct || 0) || (b.sf.fdvMcap || 0) - (a.sf.fdvMcap || 0);
  });
  out.push('<div class="secHead"><h2>🔬 ตารางผ่าตัด FDV Overhang &amp; แรงเทขายเหรียญล็อกทั้ง 51 โครงการ (เรียงตามสัดส่วนเหรียญที่เสกล็อกไว้สูงสุด → ต่ำสุด)</h2></div>');
  out.push('<table class="mx"><thead><tr>' +
    '<th>#</th><th>เหรียญ</th><th>สถานะ Tokenomics</th><th class="num">FDV / Mcap</th>' +
    '<th>สัดส่วน 3 ชั้น (🟢หมุนเวียน / 🔴เสกล็อก / 🔵รอขุด)</th>' +
    '<th class="num">🟢 หมุนเวียน</th><th class="num">🔴 เสกล็อกรอขาย</th><th class="num">🔵 รอขุดตามบล็อก</th>' +
    '<th class="num">มูลค่าก้อนที่ล็อก ($)</th><th class="num">วอลุ่มซับของ (วัน)</th><th class="num">5% Unlock / Vol</th><th class="num">ส่งผ่านราคาจริง</th>' +
    '</tr></thead><tbody>');
  for (var k = 0; k < allByOverhang.length; k++) {
    var r = allByOverhang[k], c = r.c, sf = r.sf || {};
    var tLbl = sf.tier === 'CRITICAL_LOCK' ? '<span class="vBadge vb-risk">🚨 ล็อกหนัก &gt;3x</span>'
             : (sf.tier === 'HEAVY_LOCK' ? '<span class="vBadge vb-warn">⚠️ ล็อกสูง</span>'
             : (sf.tier === 'MOD_LOCK' ? '<span class="vBadge vb-watch">🔸 ล็อกปานกลาง</span>'
             : (sf.tier === 'POW_EMISSION' ? '<span class="vBadge vb-top">⛏️ รอขุดตามบล็อก</span>'
             : '<span class="vBadge vb-gem">💎 สะอาด (Clean)</span>')));
    var bar3 = '<div class="supBar3" style="width:140px;height:9px;margin:0"><i style="width:' + sf.circPct + '%;background:#2ecc71"></i><i style="width:' + sf.lockedPct + '%;background:#ff5a5c"></i><i style="width:' + sf.unminedPct + '%;background:#4cc2ff"></i></div>';
    out.push('<tr data-bcard="' + c.s + '" class="row">' +
      '<td class="num dim">' + (k + 1) + '</td>' +
      '<td class="coin"><span class="sym">' + c.s + '</span><span class="nm">' + c.n + '</span></td>' +
      '<td>' + tLbl + '</td>' +
      '<td class="num"><b class="' + (sf.fdvMcap > 2.5 ? 'down' : 'up') + '">' + (sf.fdvMcap || 1) + 'x</b></td>' +
      '<td>' + bar3 + '</td>' +
      '<td class="num up"><b>' + sf.circPct + '%</b></td>' +
      '<td class="num ' + (sf.lockedPct > 25 ? 'down' : 'dim') + '"><b>' + sf.lockedPct + '%</b></td>' +
      '<td class="num acc">' + sf.unminedPct + '%</td>' +
      '<td class="num ' + (sf.lockedUsd > (c.m || 0) ? 'down' : '') + '">' + (sf.lockedUsd > 0 ? '<b>' + fmtUsd(sf.lockedUsd) + '</b>' : '<span class="dim">$0</span>') + '</td>' +
      '<td class="num">' + (sf.daysToAbsorbLocked > 0 ? sf.daysToAbsorbLocked + ' วัน' : '<span class="dim">0</span>') + '</td>' +
      '<td class="num">' + (sf.shock5PctOfVol > 0 ? sf.shock5PctOfVol + '%' : '<span class="dim">0%</span>') + '</td>' +
      '<td class="num"><b>' + sf.retentionPct + '%</b></td>' +
      '</tr>');
  }
  out.push('</tbody></table>');
  gw.innerHTML = out.join('');
  $('count').textContent = 'เพชรเม็ดงาม ' + cleanGems.length + ' · เสาหลัก ' + coreAnchors.length + ' · เฝ้าระวัง FDV ' + fdvTraps.length;

  var clickEls = gw.querySelectorAll ? gw.querySelectorAll('[data-bcard]') : [];
  for (var m = 0; m < clickEls.length; m++) {
    clickEls[m].onclick = function () {
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
  var mw = $('matrixWrap'), tw = $('tblWrap'), dw = $('docsWrap'), cw = $('cmpWrap'), bw = $('bullWrap'), gw = $('gemsWrap');
  if (tw) tw.style.display = 'none';
  if (mw) mw.style.display = 'none';
  if (dw) dw.style.display = 'none';
  if (cw) cw.style.display = 'none';
  if (bw) bw.style.display = 'none';
  if (gw) gw.style.display = 'none';

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
  if (state.view === 'gems') {
    if (gw) { gw.style.display = 'block'; renderGems(); }
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
    var c = view[j], k = cur(c.s), d = dna(c), dt = det(c), ev = evalCoin(c), pl = ev.pl || {}, sf = ev.sf || {}, vd = verdictOf(c);

    /* 3-Layer Supply & Overhang Progress Bar in Main Table */
    var maxS = sf.effMax || c.ms || c.ts;
    var supplyHtml = '<span class="dim">—</span>';
    if (c.cs) {
      if (maxS && maxS > 0) {
        var lockNote = sf.lockedPct >= 15
          ? '<span class="subCell" style="color:var(--down)">🔒 เสกล็อก ' + Math.round(sf.lockedPct) + '% (' + sf.fdvMcap + 'x)</span>'
          : (sf.unminedPct >= 15 ? '<span class="subCell" style="color:var(--accent)">⛏️ รอขุด ' + Math.round(sf.unminedPct) + '%</span>' : '<span class="subCell">' + fmtNum(c.cs) + '/' + fmtNum(maxS) + '</span>');
        supplyHtml = '<div class="flWrap" title="หมุนเวียน ' + sf.circPct + '% | เสกล็อกรอปลด ' + sf.lockedPct + '% | รอขุดตามบล็อก ' + sf.unminedPct + '%">' +
          '<div><b>' + Math.round(sf.circPct) + '%</b></div>' +
          '<div class="flBar" style="display:flex"><i style="width:' + sf.circPct + '%;background:#2ecc71"></i><i style="width:' + sf.lockedPct + '%;background:#ff5a5c"></i><i style="width:' + sf.unminedPct + '%;background:#4cc2ff"></i></div>' +
          lockNote + '</div>';
      } else {
        supplyHtml = '<div class="flWrap"><div><b>100%</b> <span class="dim">(∞)</span></div>' +
          '<div class="flBar"><i style="width:100%;background:#4cc2ff"></i></div><span class="subCell">' + fmtNum(c.cs) + ' (Tail)</span></div>';
      }
    }

    /* Composite Score */
    var sc = activeScore(c);
    var scHtml = sc == null
      ? '<span class="dim" title="หลักฐาน P ยังไม่ถึง 80% จึงไม่จัดอันดับ">—</span>'
      : '<span class="' + gradeCls(sc) + '" style="font-size:14.5px">' + sc + '</span> <span class="dim" style="font-size:11px">' + gradeLetter(sc) + '</span>';

    /* Bull Upside Score */
    var bullHtml = '<span class="dim">—</span>';
    if (ev.asy && ev.asy.score != null) {
      var nPos = (ev.pos || []).length;
      var sig = nPos > 0 ? '<span class="subCell" style="color:var(--teal)">🟢 ' + nPos + ' สัญญาณบวก</span>' : '<span class="subCell">' + ev.asy.archetype + '</span>';
      bullHtml = '<span class="' + gradeCls(ev.asy.score) + '" style="font-size:14.5px">' + ev.asy.score + '</span>' + sig;
    }

    /* Price + Distance from ATH */
    var athSub = '';
    if (c.ath && c.p && c.ath > c.p * 1.02) {
      var toAth = c.ath / c.p;
      athSub = '<span class="subCell" title="จุดสูงสุดเดิม (ATH): ' + fmtPrice(c.ath) + ' เมื่อ ' + (c.ath_d || '') + '">ATH ' + (c.ath_c != null ? Math.round(c.ath_c) + '%' : '') + ' (<b class="acc">' + fmtMult(toAth) + '</b>)</span>';
    } else if (c.ath_c != null) {
      athSub = '<span class="subCell">ATH ' + Math.round(c.ath_c) + '%</span>';
    }

    /* Mcap & FDV */
    var fdvVal = sf.effectiveFdv || c.fdv || ((c.m && c.cs && maxS) ? (c.p * maxS) : null);
    var fdvSub = fdvVal ? '<span class="subCell' + (sf.fdvMcap > 2.5 ? ' down' : '') + '">FDV: $' + fmtCompact(fdvVal) + (sf.fdvMcap > 1.2 ? ' (' + sf.fdvMcap + 'x)' : '') + '</span>' : '';

    /* Vol 24h & Turnover % + Exchange Count */
    var turnStr = (c.m && c.v) ? ((c.v / c.m) * 100).toFixed(1) + '%/วัน' : '';
    var exSub = '<span class="subCell">' + (turnStr ? turnStr : '') + (dt.ex_count ? (turnStr ? ' · ' : '') + dt.ex_count + ' กระดาน' : '') + '</span>';

    var isExp = (state.expanded === c.s);
    var sel = (j === state.sel ? ' sel' : '') + (isExp ? ' isExp' : '');
    rows.push('<tr data-sym="' + c.s + '" class="row' + sel + '">' +
      '<td class="num dim">' + (j + 1) + (c.rk ? '<span class="subCell">#' + c.rk + '</span>' : '') + '</td>' +
      '<td class="coin"><div class="cWrap">' + (c.img ? '<img src="' + c.img + '" alt="">' : '') +
      '<div><div><span class="sym">' + c.s + '</span><span class="nm">' + c.n + '</span>' +
      (dt.spark && dt.spark.length > 2 ? sparkSvg(dt.spark, 54, 15, sparkColor(dt.spark)) : '') + '</div>' +
      '<div class="cSub"><span class="chip">' + grpOf(c) + '</span> ' + badge(k.model) + (ev.asy ? ' ' + archetypeBadge(ev.asy.archetype) : '') + '</div></div></div></td>' +
      '<td><span class="vBadge ' + vd.cls + '" title="' + vd.desc + '">' + vd.lbl + '</span>' +
      '<span class="subCell" style="font-family:var(--sans);max-width:210px;overflow:hidden;text-overflow:ellipsis">' + (d.prim || k.mech || '') + '</span></td>' +
      '<td class="num">' + scHtml + '</td>' +
      '<td class="num">' + bullHtml + '</td>' +
      '<td class="pCell">' + pBoxHtml(pl.P) + '</td>' +
      '<td class="pCell">' + pBoxHtml(pl.D) + '</td>' +
      '<td class="pCell">' + pBoxHtml(pl.L) + '</td>' +
      '<td class="pCell">' + pBoxHtml(pl.T) + '</td>' +
      '<td class="pCell">' + pBoxHtml(pl.S) + '</td>' +
      '<td class="pCell">' + pBoxHtml(pl.R) + '</td>' +
      '<td class="num"><b>' + fmtPrice(c.p) + '</b>' + athSub + '</td>' +
      '<td class="num">' + fmtPct(c.c24) + '</td>' +
      '<td class="num">' + fmtPct(c.c7) + '</td>' +
      '<td class="num">' + fmtPct(c.c30) + '</td>' +
      '<td class="num">' + fmtPct(c.c1y) + '</td>' +
      '<td class="num"><b>' + (c.m == null ? '—' : '$' + fmtCompact(c.m)) + '</b>' + fdvSub + '</td>' +
      '<td class="num">' + (c.v ? '$' + fmtCompact(c.v) : '—') + exSub + '</td>' +
      '<td class="num">' + supplyHtml + '</td>' +
      '<td class="cmpCell"><button class="cmpBtn' + (state.compare.indexOf(c.s) >= 0 ? ' on' : '') + '" data-cmp="' + c.s + '" ' +
      'title="' + (state.compare.indexOf(c.s) >= 0 ? 'เอาออกจากเครื่องมือเปรียบเทียบ' : 'เพิ่มลงเครื่องมือเปรียบเทียบ (2–4 ตัว)') + '">⇄</button></td>' +
      '</tr>');
    if (isExp) {
      rows.push('<tr class="exp"><td colspan="20">' + dnaPanel(c) + '</td></tr>');
    }
  }
  $('tbody').innerHTML = rows.join('');
  $('count').textContent = 'แสดง ' + view.length + ' จาก ' + DATA.length + ' โครงการ';
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
  out.push('<div class="rubric"><b>DNA Matrix — ตารางเปรียบเทียบยีนเทคนิคความลับทั้ง 51 โครงการ:</b><br>' +
    'คลิกที่แถวใดก็ได้เพื่อกลับไปเปิดรายงานวิเคราะห์การลงทุน 6 มิติในตารางหลัก</div>');
  out.push('<table class="mx"><thead><tr>' +
    '<th>#</th><th>Coin</th><th>กลุ่ม</th><th>primitive family</th>' +
    '<th>ผู้ส่ง</th><th>ผู้รับ</th><th>จำนวน</th><th>State</th><th>บังคับ</th><th>trustless</th><th>anon set</th>' +
    '<th>setup / trust</th><th>ปี</th><th>เกรด v1</th><th>ประวัติความปลอดภัย</th><th>ความเสี่ยงหลัก</th>' +
    '</tr></thead><tbody>');
  for (var j = 0; j < rows.length; j++) {
    var c = rows[j], d = dna(c), g = gradeOf(d);
    out.push('<tr data-bcard="' + c.s + '" class="row">' +
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
  $('count').textContent = rows.length + ' / ' + DATA.length + ' โครงการ (DNA Matrix)';
  var trs = $('matrixWrap').querySelectorAll ? $('matrixWrap').querySelectorAll('[data-bcard]') : [];
  for (var k = 0; k < trs.length; k++) {
    trs[k].onclick = function () {
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
    rk: c.market_cap_rank,
    p: c.current_price, m: c.market_cap, fdv: c.fully_diluted_valuation, v: c.total_volume,
    h24: c.high_24h, l24: c.low_24h,
    c24: c.price_change_percentage_24h_in_currency,
    c7: c.price_change_percentage_7d_in_currency,
    c30: c.price_change_percentage_30d_in_currency,
    c1y: c.price_change_percentage_1y_in_currency,
    cs: c.circulating_supply, ts: c.total_supply, ms: c.max_supply,
    ath: c.ath, ath_c: c.ath_change_percentage, ath_d: (c.ath_date || '').slice(0, 10),
    atl: c.atl, atl_c: c.atl_change_percentage, atl_d: (c.atl_date || '').slice(0, 10),
    img: c.image,
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
  btn.classList.add('busy'); btn.textContent = '… กำลังดึงข้อมูลสด';
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
    $('liveStatus').textContent = 'อัปเดตสดสำเร็จ · ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    btn.classList.remove('busy'); btn.textContent = '⟳ ดึงราคาสด (LIVE)';
  }).catch(function (err) {
    $('liveStatus').textContent = 'ดึงราคาสดไม่สำเร็จ (' + err.message + ') — ใช้ข้อมูล Snapshot ล่าสุด';
    btn.classList.remove('busy'); btn.textContent = '⟳ ดึงราคาสด (LIVE)';
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
    cw.innerHTML = '<div class="cmpEmpty">เลือกเหรียญ 2–4 ตัวจากปุ่ม <b>⇄</b> ในคอลัมน์ขวาสุดของตารางก่อน ' +
      '(ตอนนี้เลือกแล้ว ' + coins.length + ' เหรียญ)</div>';
    return;
  }
  var series = coins.map(function (c, i) {
    return { c: c, color: CMP_COLORS[i % CMP_COLORS.length], vals: cmpPillars(c) || [], ev: evalCoin(c) };
  });
  var head = '<div class="cmpHead"><h2>เปรียบเทียบเชิงลึก ' + coins.length + ' โครงการ</h2>' +
    '<span class="dim">เรดาร์ = รูปร่างของ 6 เสาหลัก (ยิ่งกางออกกว้างยิ่งสมดุล) · ตารางขวา = เปรียบเทียบคะแนน, มูลค่าตลาด และยีนเทคนิคทุกแกน</span>' +
    '<span class="dim" style="margin-left:auto"><button class="cmpBtn" id="cmpClear">ล้างทั้งหมด</button></span></div>';
  var legend = '<div class="cmpLegend">' + series.map(function (sr) {
    return '<span><i style="background:' + sr.color + '"></i>' + sr.c.s + ' (' + sr.c.n + ')</span>';
  }).join('') + '</div>';
  var rowsHtml = '';
  rowsHtml += '<tr class="hl"><td class="k">Market Cap ปัจจุบัน</td>' +
    series.map(function (sr) { return '<td class="v">$' + fmtCompact(sr.c.m) + '</td>'; }).join('') + '</tr>';
  rowsHtml += '<tr class="hl"><td class="k">Bull Upside Score</td>' +
    series.map(function (sr) { return '<td class="v">' + (sr.ev.asy ? sr.ev.asy.score : '—') + '</td>'; }).join('') + '</tr>';
  rowsHtml += '<tr class="hl"><td class="k">Composite Score (PI)</td>' +
    series.map(function (sr) { var sc = activeScore(sr.c, 'privacy_investor'); return '<td class="v">' + (sc != null ? sc : '—') + '</td>'; }).join('') + '</tr>';
  CMP_PILLARS.forEach(function (pl, i) {
    rowsHtml += '<tr class="hl"><td class="k">' + pl[1] + ' (' + pl[0] + ')</td>' +
      series.map(function (sr) { return '<td class="v">' + (sr.vals[i] == null ? '—' : sr.vals[i]) + '</td>'; }).join('') + '</tr>';
  });
  CMP_GENES.forEach(function (gene) {
    rowsHtml += '<tr><td class="k">' + gene + '</td>' +
      series.map(function (sr) { return cmpGeneCell(dna(sr.c), gene); }).join('') + '</tr>';
  });
  var table = '<table class="gtbl"><tr><th>มิติเปรียบเทียบ</th>' +
    series.map(function (sr) { return '<th>' + sr.c.s + '</th>'; }).join('') + '</tr>' + rowsHtml + '</table>';
  cw.innerHTML = head + legend +
    '<div class="cmpGrid"><div class="cmpRadar">' + radarSvg(series) + '</div>' + table + '</div>';
  var cl = document.getElementById('cmpClear');
  if (cl) cl.onclick = function () { state.compare = []; state.view = 'table'; renderViewSwitch(); renderTable(); };
}

function renderViewSwitch() {
  $('vsw').innerHTML =
    '<button id="vTable" class="' + (state.view === 'table' ? 'on' : '') + '">📊 ตารางวิเคราะห์การลงทุน (' + DATA.length + ' เหรียญ)</button>' +
    '<button id="vGems" class="gemTab' + (state.view === 'gems' ? ' on' : '') + '">💎 คัดเพชรเม็ดงาม &amp; ผ่ากับดัก FDV (ไม่กาว)</button>' +
    '<button id="vBull" class="bullTab' + (state.view === 'bull' ? ' on' : '') + '">⚡ Bull-Run Radar &amp; จำลองกำไร (The Next ZEC)</button>' +
    '<button id="vMatrix" class="' + (state.view === 'matrix' ? 'on' : '') + '">🧬 ตารางยีนเทคนิค (DNA Matrix)</button>' +
    '<button id="vCmp" class="' + (state.view === 'compare' ? 'on' : '') + '"' +
    (state.compare.length < 2 ? ' disabled title="เลือกเหรียญ 2–4 ตัวจากปุ่ม ⇄ ในตารางก่อน"' : '') + '>⇄ เปรียบเทียบเรดาร์ (' + state.compare.length + ')</button>' +
    '<button id="vDocs" class="' + (state.view === 'docs' ? 'on' : '') + '">📚 เอกสารงานวิจัย &amp; ข้อมูลดิบ</button>';
  $('vTable').onclick = function () { state.view = 'table'; renderViewSwitch(); renderTable(); };
  $('vGems').onclick = function () { state.view = 'gems'; renderViewSwitch(); renderTable(); };
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
  if ($('invAmt')) {
    $('invAmt').addEventListener('change', function () {
      state.invAmt = parseFloat(this.value) || 1000;
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
