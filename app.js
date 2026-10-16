var DATA = __DATA__;
var CUR = __CUR__;
var DNA = __DNA__;
var DETAIL = __DETAIL__;
var DOCSPAY = (function () { try { var el = document.getElementById('docsData'); return JSON.parse((el && el.textContent) || '{"docs":[],"idx":[]}'); } catch (e) { return { docs: [], idx: [] }; } })();
var STATS = __STATS__;
var ASOF_DATE = (STATS && STATS.snap) ? String(STATS.snap).slice(0, 10) : new Date().toISOString().slice(0, 10);

var state = {
  view: 'gems',
  q: '',
  preset: 'privacy_investor',
  bullFilter: 'all',
  invAmt: 1000,
  sortKey: 'bull',
  dir: -1,
  minMcap: 0,
  modalSym: null,
  modalTab: 'overview'
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
  if (v == null || !isFinite(v)) return '<span class="dim">—</span>';
  var cls = v > 0 ? 'up' : (v < 0 ? 'down' : 'dim');
  return '<span class="' + cls + '">' + (v > 0 ? '+' : '') + v.toFixed(1) + '%</span>';
}

function cur(sym) { return CUR[sym] || {}; }
function dna(c) {
  if (!c) return {};
  var has = c.dna || (IDMAP[c.id] && IDMAP[c.id].dna);
  return has ? (DNA[c.s] || {}) : {};
}
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
  var hasCrit = fl.some(function (f) { return f.lv === 'CRITICAL'; });
  var res = { pl: pl, asy: asy, sf: sf, fl: fl, pos: pos, posIds: posIds, hasCrit: hasCrit, m: m };
  _evalCache[c.s] = res;
  return res;
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

function activeScore(c, presetKey) {
  var pk = presetKey || state.preset || 'privacy_investor';
  var r = compositeRank(c, pk);
  return r ? r.v : null;
}

function verdictOf(c) {
  var d = dna(c), ev = evalCoin(c), asy = ev.asy, sf = ev.sf, pids = ev.posIds || [];
  if (gval(d, 'sanctioned')) {
    return { cls: 'vb-risk', lbl: '🚨 ถูกคว่ำบาตร', desc: 'มีความเสี่ยงทางกฎหมายและถูกถอดจากกระดานหลัก' };
  }
  if (ev.hasCrit) {
    return { cls: 'vb-risk', lbl: '🚨 ติดธงแดง CRITICAL', desc: 'มีช่องโหว่ยังไม่แก้ หรือ Repo หยุดพัฒนาเกิน 1 ปี' };
  }
  if (!asy || !ev.pl || ev.pl.P == null) {
    return { cls: 'vb-watch', lbl: '⏳ รอข้อมูลครบ', desc: 'หลักฐานความลับยังไม่ครบ 80% จึงยังไม่จัดอันดับ' };
  }
  if (sf && sf.tier === 'CRITICAL_LOCK') {
    return { cls: 'vb-risk', lbl: '🚨 ระวังล็อกหนัก (' + sf.fdvMcap + 'x)', desc: 'เหรียญเสกล็อกอยู่ ' + sf.lockedPct + '% — ห้ามไล่ราคา ต้องรอปลดล็อก' };
  }
  if (sf && sf.tier === 'HEAVY_LOCK') {
    return { cls: 'vb-warn', lbl: '⚠️ เหรียญล็อก ' + Math.round(sf.lockedPct) + '%', desc: 'มีเหรียญรอปลดล็อกเกินครึ่งของตลาด ต้องหักส่วนลด Dilution' };
  }
  if (asy.archetype === 'ZEC-ARCHETYPE' && asy.score >= 70 && (!sf || sf.lockedPct <= 25)) {
    return { cls: 'vb-top', lbl: '🟢 ตัวเต็งพิมพ์เขียว ZEC', desc: 'มี Viewing Key (comp=2) + ความลับแข็ง + โค้ด Active + เหรียญสะอาด' };
  }
  if (pids.indexOf('asymmetric_gem') >= 0 || (asy.score >= 72 && (!sf || sf.lockedPct <= 22))) {
    return { cls: 'vb-gem', lbl: '💎 เพชรเม็ดงามไร้ล็อก', desc: 'พื้นฐานแถวหน้า + Market Cap โซนสะสม + ไร้ VC Unlock' };
  }
  if (asy.archetype === 'SOVEREIGN-PRIV' && asy.score >= 65) {
    return { cls: 'vb-sov', lbl: '🛡️ เหรียญหลักสายแข็ง', desc: 'ความลับระดับสูงสุด (Default/Mandatory) ไร้ VC Overhang' };
  }
  if (asy.score >= 62) {
    return { cls: 'vb-watch', lbl: '⚡ น่าจับตา Bull Run', desc: 'พื้นฐานผ่านเกณฑ์และมีปัจจัยบวกเฉพาะกลุ่ม' };
  }
  return { cls: 'vb-warn', lbl: '🔍 เก็งกำไรเฉพาะทาง', desc: 'คะแนนความลับหรือสภาพคล่องยังเป็นรองกลุ่มผู้นำ' };
}

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

function pMiniHtml(v) {
  if (v == null) return '<span class="pMini p-na">—</span>';
  var cls = v >= 75 ? 'p-hi' : (v >= 55 ? 'p-md' : (v >= 35 ? 'p-lo' : 'p-bad'));
  return '<span class="pMini ' + cls + '">' + v + '</span>';
}

function matchBullMode(c, mode) {
  if (!mode || mode === 'all') return true;
  var ev = evalCoin(c), sf = ev.sf;
  var pids = ev.posIds || [];
  if (mode === 'gem') return pids.indexOf('asymmetric_gem') >= 0 || (ev.asy && ev.asy.score >= 68 && (c.m || 0) >= 3e6 && (c.m || 0) <= 6.5e8 && (!sf || sf.lockedPct <= 22) && !ev.hasCrit);
  if (mode === 'zec') return pids.indexOf('zec_archetype') >= 0 || (ev.asy && ev.asy.archetype === 'ZEC-ARCHETYPE');
  if (mode === 'sov') return !!(ev.asy && ev.asy.archetype === 'SOVEREIGN-PRIV');
  if (mode === 'overhang') return !!(sf && (sf.fdvMcap > 1.75 || sf.lockedPct >= 30));
  if (mode === 'safe') return !ev.hasCrit && !gval(dna(c), 'sanctioned') && (!sf || sf.tier !== 'CRITICAL_LOCK');
  return true;
}

function matchesQuery(c) {
  if ((c.m || 0) < state.minMcap) return false;
  if (!matchBullMode(c, state.bullFilter)) return false;
  var q = state.q.trim().toLowerCase();
  if (!q) return true;
  var k = cur(c.s), dd = dna(c);
  var hay = (c.s + ' ' + c.n + ' ' + grpOf(c) + ' ' + (k.mech || '') + ' ' + (dd.fam || '') + ' ' + (dd.prim || '')).toLowerCase();
  return hay.indexOf(q) >= 0;
}

function sortVal(c, k) {
  var ev = evalCoin(c);
  if (k === 's') return c.s;
  if (k === 'mcap' || k === 'm') return (c.m == null ? -1e18 : c.m);
  if (k === 'comp') {
    var sc = activeScore(c);
    return (sc == null ? -1e18 : sc);
  }
  if (k === 'bull') return (ev.asy && ev.asy.score != null) ? ev.asy.score : -1e18;
  if (k === 'fdv_risk') return (ev.sf && ev.sf.lockedPct != null) ? ev.sf.lockedPct : -1e18;
  if (k === 'sp') return (ev.sf && ev.sf.circPct != null) ? ev.sf.circPct : -1e18;
  var v = c[k];
  return (v == null ? -1e18 : v);
}

/* ============================================================================
 * Header, Nav & Filter Pills
 * ============================================================================ */
function renderStats() {
  var mcap = 0, nGem = 0, nTrap = 0;
  for (var i = 0; i < DATA.length; i++) {
    mcap += (DATA[i].m || 0);
    if (matchBullMode(DATA[i], 'gem')) nGem++;
    if (matchBullMode(DATA[i], 'overhang')) nTrap++;
  }
  $('statsbar').innerHTML =
    '<span class="kpiPill">เพชรไร้ล็อก <b class="up">' + nGem + '</b></span>' +
    '<span class="kpiPill">ติดล็อก FDV <b class="down">' + nTrap + '</b></span>' +
    '<span class="kpiPill hideMob">ตลาดรวม <b>$' + (mcap / 1e9).toFixed(1) + 'B</b></span>' +
    '<button id="liveBtn">⟳ ราคาสด</button>' +
    '<span id="liveStatus"></span>';
  $('liveBtn').onclick = liveRefresh;
}

function renderViewSwitch() {
  $('vsw').innerHTML =
    '<button id="vGems" class="gemTab' + (state.view === 'gems' ? ' on' : '') + '">💎 คัดเพชรน่าลงทุน</button>' +
    '<button id="vTable" class="' + (state.view === 'table' ? 'on' : '') + '">📊 ตารางทั้งหมด (' + DATA.length + ')</button>' +
    '<button id="vFdv" class="' + (state.view === 'fdv' ? 'on' : '') + '">🔓 สแกนเหรียญล็อก (FDV)</button>' +
    '<button id="vDocs" class="' + (state.view === 'docs' ? 'on' : '') + '">📚 ข้อมูลอ้างอิง</button>';
  $('vGems').onclick = function () { state.view = 'gems'; renderViewSwitch(); renderMain(); };
  $('vTable').onclick = function () { state.view = 'table'; renderViewSwitch(); renderMain(); };
  $('vFdv').onclick = function () { state.view = 'fdv'; renderViewSwitch(); renderMain(); };
  $('vDocs').onclick = function () { state.view = 'docs'; renderViewSwitch(); renderMain(); };
}

function renderPillBar() {
  var pb = $('pillBar');
  if (!pb) return;
  var modes = [
    ['all', 'ทั้งหมด'],
    ['gem', '💎 เพชรไร้ล็อก (Clean Gems)'],
    ['zec', '🟢 พิมพ์เขียว ZEC (comp=2)'],
    ['sov', '🛡️ ความลับสูงสุด (Sovereign)'],
    ['overhang', '🚨 ติดล็อก FDV สูง (>1.75x)'],
    ['safe', '✅ ปลอดภัยไร้ธงแดงร้ายแรง']
  ];
  var html = '';
  for (var i = 0; i < modes.length; i++) {
    var m = modes[i][0], lbl = modes[i][1], cnt = 0;
    for (var j = 0; j < DATA.length; j++) if (matchBullMode(DATA[j], m)) cnt++;
    html += '<button class="fPill' + (state.bullFilter === m ? ' on' : '') + '" data-bf="' + m + '">' +
      lbl + ' <b>' + cnt + '</b></button>';
  }
  pb.innerHTML = html;
  var btns = pb.querySelectorAll('.fPill');
  for (var k = 0; k < btns.length; k++) {
    btns[k].onclick = function () {
      state.bullFilter = this.getAttribute('data-bf') || 'all';
      renderPillBar();
      renderMain();
    };
  }
}

/* ============================================================================
 * View 1: Clean Personal Gem Advisor (ไม่กาว · อ่านง่ายใน 10 วินาที)
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
    var bull = (ev.asy && ev.asy.score != null) ? ev.asy.score : null;
    rows.push({ c: c, ev: ev, pi: pi, bull: bull, sf: ev.sf || {} });
  }

  var cleanGems = rows.filter(function (r) {
    var m = r.c.m || 0;
    return r.bull != null && r.bull >= 66 && m >= 3e6 && m <= 6.5e8 &&
           !r.ev.hasCrit && !gval(dna(r.c), 'sanctioned') &&
           (r.sf.lockedPct || 0) <= 25 && r.sf.tier !== 'CRITICAL_LOCK' && r.sf.tier !== 'HEAVY_LOCK';
  }).sort(function (a, b) { return (b.bull || 0) - (a.bull || 0); });

  var coreAnchors = rows.filter(function (r) {
    var m = r.c.m || 0;
    return r.bull != null && m > 2e8 && !r.ev.hasCrit && !gval(dna(r.c), 'sanctioned') && (r.sf.lockedPct || 0) <= 35;
  }).sort(function (a, b) { return (b.bull || 0) - (a.bull || 0); });

  var fdvTraps = rows.filter(function (r) {
    return r.sf && (r.sf.fdvMcap > 1.75 || r.sf.lockedPct >= 30);
  }).sort(function (a, b) { return (b.sf.lockedPct || 0) - (a.sf.lockedPct || 0); });

  function renderCleanCard(r, kind) {
    var c = r.c, d = dna(c), q = cur(c.s), dt = det(c), ev = r.ev, pl = ev.pl || {}, sf = r.sf || {};
    var isTrap = (kind === 'trap');
    var mcap = c.m || 0;
    var targetMcap = mcap < 3e7 ? 1.5e8 : (mcap < 2e8 ? 7e8 : (mcap < 1e9 ? 2.5e9 : 6.5e9));
    var sim = calcTarget(c, targetMcap);

    var pros = [];
    if (gval(d, 'comp') === 2) pros.push('มี Viewing Key (comp=2) รองรับ CEX/สถาบัน');
    if (pl.P >= 70) pros.push('ความลับแข็งมาก (P=' + pl.P + ')');
    else if (pl.P >= 45) pros.push('ความลับมาตรฐาน (P=' + pl.P + ')');
    if (pl.D >= 80) pros.push('โค้ด GitHub Active ต่อเนื่อง');
    if (sf.lockedPct <= 5) pros.push('ไร้เหรียญ VC ล็อก (' + sf.circPct + '% หมุนเวียน)');
    var proStr = pros.slice(0, 2).join(' · ') || (d.prim || q.mech || 'Privacy Protocol');

    var riskStr = '';
    if (sf.lockedPct >= 30) {
      riskStr = '🚨 เหรียญเสกล็อกรอขาย <b>' + sf.lockedPct + '% (' + fmtUsd(sf.lockedUsd) + ')</b> วอลุ่มต้องซับของ ' + sf.daysToAbsorbLocked + ' วัน';
    } else if (ev.fl && ev.fl.length) {
      riskStr = '⚠️ [' + ev.fl[0].id + '] ' + ev.fl[0].msg;
    } else if (d.risk) {
      riskStr = '🔸 ' + d.risk;
    } else {
      riskStr = '🔸 ความผันผวนตามรอบตลาดและสภาพคล่องกระดานเทรด';
    }

    var upsideTxt = sim ? '<b class="up">' + fmtMult(sim.fdvMult) + ' สุทธิ</b> (หากแตะ $' + fmtCompact(targetMcap) + ')' : '—';

    return '<div class="gCard' + (isTrap ? ' trap' : '') + '" data-open="' + c.s + '" data-tab="' + (isTrap ? 'fdv' : 'overview') + '">' +
      '<div class="gHead">' +
      '<div class="cCell">' + (c.img ? '<img src="' + c.img + '" alt="">' : '') +
      '<div><div><span class="cSym">' + c.s + '</span><span class="cName">' + c.n + '</span></div>' +
      '<div style="font-size:11.5px;color:var(--dim)">' + (d.fam || grpOf(c)) + ' · ' + (dt.ex_count || '—') + ' กระดาน</div></div></div>' +
      '<span class="vBadge ' + (isTrap ? 'vb-risk' : (kind === 'core' ? 'vb-sov' : 'vb-gem')) + '">' +
      (isTrap ? '🚨 FDV ' + sf.fdvMcap + 'x' : 'Bull ' + (r.bull || '—') + '/100') + '</span>' +
      '</div>' +
      '<div class="gMetrics">' +
      '<div><div class="k">ราคา / 24h</div><div class="v">' + fmtPrice(c.p) + ' <span style="font-size:11px">' + fmtPct(c.c24) + '</span></div></div>' +
      '<div><div class="k">Market Cap</div><div class="v">$' + fmtCompact(c.m) + '</div></div>' +
      '<div><div class="k">' + (isTrap ? 'เหรียญเสกล็อก' : 'โอกาสโตสุทธิ') + '</div><div class="v">' + (isTrap ? '<span class="down">' + sf.lockedPct + '%</span>' : upsideTxt) + '</div></div>' +
      '</div>' +
      '<div class="gPoint">✅ <b>จุดแข็ง:</b> ' + proStr + '</div>' +
      '<div class="gPoint">⚠️ <b>จุดระวัง:</b> ' + riskStr + '</div>' +
      '<div class="gFoot">' +
      '<span class="dim">หมุนเวียน ' + sf.circPct + '% · พื้นฐาน ' + (r.pi || '—') + '/100</span>' +
      '<span class="acc" style="font-weight:700">ดูเจาะลึก →</span>' +
      '</div></div>';
  }

  var out = [];
  out.push('<div class="secBanner">' +
    '<div><b>🧭 สรุปคำแนะนำการลงทุนจากข้อมูลจริง (ไม่กาว)</b> — แยกเหรียญพื้นฐานแกร่งไร้ล็อก ออกจากเหรียญที่มีระเบิดเวลา FDV Overhang</div>' +
    '<span class="dim" style="font-size:12px">แตะที่การ์ดใดก็ได้เพื่อเปิดหน้าต่างเจาะลึก 4 แท็บ</span></div>');

  out.push('<div class="secTitle">💎 1. เพชรเม็ดงามพร้อมสะสม (Clean Gems — พื้นฐานแกร่ง · รูมโตสูง · ไร้ VC ล็อก) <span class="chip">' + cleanGems.length + ' เหรียญ</span></div>');
  out.push('<div class="gemGrid">' + (cleanGems.length ? cleanGems.map(function (r) { return renderCleanCard(r, 'gem'); }).join('') : '<div class="dim">ไม่พบเหรียญตามตัวกรอง</div>') + '</div>');

  out.push('<div class="secTitle">🏛️ 2. เหรียญหลักพอร์ตสถาบัน (Core Blue-Chips — สภาพคล่องสูง · Mcap &gt;$200M) <span class="chip">' + coreAnchors.length + ' เหรียญ</span></div>');
  out.push('<div class="gemGrid">' + (coreAnchors.length ? coreAnchors.map(function (r) { return renderCleanCard(r, 'core'); }).join('') : '<div class="dim">ไม่พบเหรียญตามตัวกรอง</div>') + '</div>');

  out.push('<div class="secTitle">🚨 3. เฝ้าระวังเหรียญติดล็อก FDV สูง (High-FDV Watchlist — ห้ามไล่ราคา! รอปลดล็อก) <span class="chip">' + fdvTraps.length + ' เหรียญ</span></div>');
  out.push('<div class="gemGrid">' + (fdvTraps.length ? fdvTraps.map(function (r) { return renderCleanCard(r, 'trap'); }).join('') : '<div class="dim">ไม่พบเหรียญตามตัวกรอง</div>') + '</div>');

  gw.innerHTML = out.join('');
  $('count').textContent = 'คัดเพชร ' + cleanGems.length + ' · เสาหลัก ' + coreAnchors.length + ' · เฝ้าระวัง FDV ' + fdvTraps.length;
  bindOpenModal(gw);
}

/* ============================================================================
 * View 2: Clean 8-Column Desktop Table + Native Mobile Card List
 * ============================================================================ */
function renderTable() {
  view = [];
  for (var i = 0; i < DATA.length; i++) if (matchesQuery(DATA[i])) view.push(DATA[i]);
  view.sort(function (a, b) {
    var x = sortVal(a, state.sortKey), y = sortVal(b, state.sortKey);
    if (typeof x === 'string') return state.dir * x.localeCompare(y);
    return state.dir * (x - y);
  });

  var rows = [];
  var mobCards = [];
  for (var j = 0; j < view.length; j++) {
    var c = view[j], k = cur(c.s), d = dna(c), ev = evalCoin(c), pl = ev.pl || {}, sf = ev.sf || {}, vd = verdictOf(c);
    var sc = activeScore(c);
    var bull = (ev.asy && ev.asy.score != null) ? ev.asy.score : null;

    var fdvStatus = '';
    if (sf.lockedPct >= 30) {
      fdvStatus = '<span class="down" style="font-weight:700">🚨 ล็อก ' + Math.round(sf.lockedPct) + '% (' + sf.fdvMcap + 'x)</span>';
    } else if (sf.lockedPct >= 15) {
      fdvStatus = '<span class="warn" style="font-weight:700">⚠️ ล็อก ' + Math.round(sf.lockedPct) + '% (' + sf.fdvMcap + 'x)</span>';
    } else if (sf.unminedPct >= 15) {
      fdvStatus = '<span class="acc">⛏️ รอขุด ' + Math.round(sf.unminedPct) + '%</span>';
    } else {
      fdvStatus = '<span class="up">🟢 สะอาด (' + Math.round(sf.circPct) + '%)</span>';
    }

    var pGrid = '<div class="pMiniGrid">' +
      pMiniHtml(pl.P) + pMiniHtml(pl.D) + pMiniHtml(pl.L) + pMiniHtml(pl.T) + pMiniHtml(pl.S) + pMiniHtml(pl.R) +
      '</div>';

    rows.push('<tr class="row" data-open="' + c.s + '">' +
      '<td class="mono dim">' + (j + 1) + '</td>' +
      '<td><div class="cCell">' + (c.img ? '<img src="' + c.img + '" alt="">' : '') +
      '<div><div><span class="cSym">' + c.s + '</span><span class="cName">' + c.n + '</span></div>' +
      '<div class="cSub">' + (d.prim || k.mech || '') + '</div></div></div></td>' +
      '<td><span class="vBadge ' + vd.cls + '">' + vd.lbl + '</span></td>' +
      '<td class="num"><div class="scWrap"><span class="scNum ' + (bull >= 70 ? 'up' : (bull >= 55 ? 'acc' : 'dim')) + '">' + (bull != null ? bull : '—') + '</span>' +
      '<div class="scBar"><i style="width:' + (bull || 0) + '%;background:' + (bull >= 70 ? 'var(--up)' : 'var(--accent)') + '"></i></div></div></td>' +
      '<td class="num"><span class="mono" style="font-weight:700">' + (sc != null ? sc : '—') + '</span></td>' +
      '<td class="num"><div class="mono" style="font-weight:700">' + fmtPrice(c.p) + '</div><div style="font-size:11.5px">' + fmtPct(c.c24) + '</div></td>' +
      '<td class="num"><div class="mono" style="font-weight:700">$' + fmtCompact(c.m) + '</div><div class="dim" style="font-size:11px">Vol $' + fmtCompact(c.v) + '</div></td>' +
      '<td class="num"><div class="fdvPill">' + fdvStatus +
      '<div class="supBarMini"><i style="width:' + sf.circPct + '%;background:var(--up)"></i><i style="width:' + sf.lockedPct + '%;background:var(--down)"></i><i style="width:' + sf.unminedPct + '%;background:var(--accent)"></i></div></div></td>' +
      '<td class="hideMob" style="text-align:center">' + pGrid + '</td>' +
      '</tr>');

    /* Mobile Card Item (Zero Horizontal Scroll) */
    mobCards.push('<div class="mCard" data-open="' + c.s + '">' +
      '<div class="mTop">' +
      '<div class="cCell">' + (c.img ? '<img src="' + c.img + '" alt="">' : '') +
      '<div><div><span class="cSym">' + c.s + '</span><span class="cName">' + c.n + '</span></div>' +
      '<div style="margin-top:4px"><span class="vBadge ' + vd.cls + '">' + vd.lbl + '</span></div></div></div>' +
      '<div style="text-align:right"><div class="mono" style="font-weight:800;font-size:15px">' + fmtPrice(c.p) + '</div>' +
      '<div style="font-size:12px">' + fmtPct(c.c24) + '</div></div>' +
      '</div>' +
      '<div class="mMid">' +
      '<div class="mStat"><div class="k">Bull / พื้นฐาน</div><div class="v"><span class="up">' + (bull || '—') + '</span> <span class="dim">/ ' + (sc || '—') + '</span></div></div>' +
      '<div class="mStat"><div class="k">Market Cap</div><div class="v">$' + fmtCompact(c.m) + '</div></div>' +
      '<div class="mStat"><div class="k">สถานะเหรียญล็อก</div><div class="v" style="font-size:12px">' + fdvStatus + '</div></div>' +
      '</div></div>');
  }

  $('tbody').innerHTML = rows.join('');
  $('mobList').innerHTML = mobCards.join('');
  $('count').textContent = view.length + ' / ' + DATA.length + ' เหรียญ';
  bindOpenModal($('tbody'));
  bindOpenModal($('mobList'));
}

/* ============================================================================
 * View 3: Dedicated FDV Overhang & Unlock Scanner
 * ============================================================================ */
function renderFdvScanner() {
  var fw = $('fdvWrap');
  if (!fw) return;
  var list = [];
  for (var i = 0; i < DATA.length; i++) {
    if (!matchesQuery(DATA[i])) continue;
    var ev = evalCoin(DATA[i]);
    list.push({ c: DATA[i], ev: ev, sf: ev.sf || {} });
  }
  list.sort(function (a, b) {
    return (b.sf.lockedPct || 0) - (a.sf.lockedPct || 0) || (b.sf.fdvMcap || 0) - (a.sf.fdvMcap || 0);
  });

  var rows = list.map(function (r, idx) {
    var c = r.c, sf = r.sf;
    var badge = sf.tier === 'CRITICAL_LOCK' ? '<span class="vBadge vb-risk">🚨 ล็อกหนัก ' + sf.fdvMcap + 'x</span>'
              : (sf.tier === 'HEAVY_LOCK' ? '<span class="vBadge vb-warn">⚠️ ล็อกสูง ' + sf.fdvMcap + 'x</span>'
              : (sf.tier === 'MOD_LOCK' ? '<span class="vBadge vb-watch">🔸 ล็อกปานกลาง</span>'
              : (sf.tier === 'POW_EMISSION' ? '<span class="vBadge vb-top">⛏️ รอขุดตามบล็อก</span>'
              : '<span class="vBadge vb-gem">🟢 สะอาดไร้ล็อก</span>')));
    return '<tr class="row" data-open="' + c.s + '" data-tab="fdv">' +
      '<td class="mono dim">' + (idx + 1) + '</td>' +
      '<td><span class="cSym">' + c.s + '</span> <span class="cName hideMob">' + c.n + '</span></td>' +
      '<td>' + badge + '</td>' +
      '<td class="num"><b class="' + (sf.lockedPct > 25 ? 'down' : 'up') + '">' + sf.lockedPct + '%</b> <span class="dim hideMob">(' + (sf.lockedUsd > 0 ? fmtUsd(sf.lockedUsd) : '$0') + ')</span></td>' +
      '<td class="num"><span class="up">' + sf.circPct + '%</span></td>' +
      '<td class="num hideMob">' + (sf.daysToAbsorbLocked > 0 ? sf.daysToAbsorbLocked + ' วัน' : '0 วัน') + '</td>' +
      '<td class="num"><b>' + sf.retentionPct + '%</b></td>' +
      '</tr>';
  }).join('');

  fw.innerHTML =
    '<div class="secBanner">' +
    '<div><b>🔓 สแกนโครงสร้างเหรียญล็อก &amp; แรงเทขาย (FDV Overhang Scanner)</b><br>' +
    '<span class="dim" style="font-size:12.5px">แยกแยะระหว่าง <b>🔴 เหรียญเสกแล้วที่ล็อกรอขาย (VC/Team Locked)</b> กับ <b>🔵 เหรียญ PoW ที่ยังไม่ถูกขุด</b> แตะที่แถวใดก็ได้เพื่อดูตาราง Stress-Test ละเอียด</span></div></div>' +
    '<div class="tblCard" style="display:block!important;overflow-x:auto"><table class="mainTbl"><thead><tr>' +
    '<th>#</th><th>เหรียญ</th><th>สถานะ FDV</th><th class="num">🔴 เสกล็อกรอขาย</th><th class="num">🟢 หมุนเวียน</th><th class="num hideMob">วอลุ่มซับของ</th><th class="num">ส่งผ่านราคาจริง</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  $('count').textContent = list.length + ' เหรียญ';
  bindOpenModal(fw);
}

/* ============================================================================
 * Slide-Over / Bottom-Sheet Modal with 4 Clean Sub-Tabs
 * ============================================================================ */
var GENE_LABELS = [
  ['hs', '1. ซ่อนผู้ส่ง (Hide Sender)'],
  ['hr', '2. ซ่อนผู้รับ (Hide Receiver)'],
  ['ha', '3. ซ่อนจำนวนเงิน (Hide Amount)'],
  ['hst', '4. ซ่อน State / Smart Contract'],
  ['man', '5. การบังคับใช้ Privacy (Mandatory)'],
  ['tl', '6. ความไร้ตัวกลาง (Trustless)'],
  ['hmeta', '7. ซ่อนกราฟธุรกรรม (Metadata)'],
  ['hnet', '8. ซ่อน IP เครือข่าย (Network)'],
  ['mat', '9. ความสมบูรณ์ของระบบ (Maturity)'],
  ['pq', '10. ต้านคอมพิวเตอร์ควอนตัม (Post-Quantum)'],
  ['aset', '11. ขนาดกลุ่มปกปิดตัวตน (Anonymity Set)'],
  ['brk', '12. ประวัติช่องโหว่ (Exploit History)'],
  ['audit', '13. การตรวจสอบโค้ด (Security Audit)'],
  ['comp', '14. รองรับกฎหมาย (Viewing Key / Compliance)']
];

function openCoinModal(sym, tab) {
  var c = null;
  for (var i = 0; i < DATA.length; i++) if (DATA[i].s === sym) { c = DATA[i]; break; }
  if (!c) return;
  state.modalSym = sym;
  state.modalTab = tab || 'overview';
  renderCoinModal(c);
  $('coinModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCoinModal() {
  state.modalSym = null;
  $('coinModal').classList.remove('open');
  document.body.style.overflow = '';
}

function renderCoinModal(c) {
  var d = dna(c), q = cur(c.s), dt = det(c), ev = evalCoin(c);
  var pl = ev.pl || {}, asy = ev.asy || {}, sf = ev.sf || {}, vd = verdictOf(c);
  var inv = state.invAmt || 1000;
  var sc = activeScore(c, 'privacy_investor');

  /* Modal Header */
  $('mHdr').innerHTML =
    '<div class="mHdrTitle">' +
    (c.img ? '<img src="' + c.img + '" alt="">' : '') +
    '<div><div><span class="cSym" style="font-size:18px">' + c.s + '</span> <span class="cName" style="font-size:14px">' + c.n + '</span> ' +
    '<span class="vBadge ' + vd.cls + '">' + vd.lbl + '</span></div>' +
    '<div class="mono" style="font-size:13px;margin-top:3px"><b>' + fmtPrice(c.p) + '</b> ' + fmtPct(c.c24) + ' · Mcap <b>$' + fmtCompact(c.m) + '</b> · FDV <b>$' + fmtCompact(sf.effectiveFdv || c.fdv || c.m) + ' (' + (sf.fdvMcap || 1) + 'x)</b></div></div>' +
    '</div>' +
    '<button class="mClose" id="mCloseBtn" title="ปิดหน้าต่าง (Esc)">✕</button>';
  $('mCloseBtn').onclick = closeCoinModal;

  /* 4 Focused Sub-Tabs */
  var tabs = [
    ['overview', '📌 ภาพรวม & เป้ากำไร'],
    ['fdv', '🔓 ผ่าเหรียญล็อก (' + (sf.fdvMcap || 1) + 'x)'],
    ['risks', '🚨 ความเสี่ยง & จุดแข็ง (' + (ev.fl ? ev.fl.length : 0) + ')'],
    ['dna', '🧬 14 ยีนความลับ & ลิงก์']
  ];
  $('mTabs').innerHTML = tabs.map(function (t) {
    return '<button class="mTab' + (state.modalTab === t[0] ? ' on' : '') + '" data-mtab="' + t[0] + '">' + t[1] + '</button>';
  }).join('');

  var tBtns = $('mTabs').querySelectorAll('.mTab');
  for (var i = 0; i < tBtns.length; i++) {
    tBtns[i].onclick = function () {
      state.modalTab = this.getAttribute('data-mtab');
      renderCoinModal(c);
    };
  }

  /* --- PANE 1: Overview, 6 Pillars & ROI Simulator --- */
  var pBars = [
    ['P · ความแข็งกลไกความลับ', pl.P],
    ['D · ความเคลื่อนไหวทีมพัฒนา', pl.D],
    ['L · สภาพคล่องตลาด', pl.L],
    ['T · อายุและความเก๋าเครือข่าย', pl.T],
    ['S · ความปลอดภัย & Audit', pl.S],
    ['R · รองรับกฎหมาย & กระดานเทรด', pl.R]
  ].map(function (pb) {
    var v = pb[1], col = v >= 70 ? 'var(--up)' : (v >= 50 ? 'var(--accent)' : (v >= 35 ? 'var(--warn)' : 'var(--down)'));
    return '<div class="kvItem">' +
      '<div style="display:flex;justify-content:space-between;font-size:12px"><span>' + pb[0] + '</span><b class="mono">' + (v != null ? v + '/100' : '—') + '</b></div>' +
      '<div class="scBar" style="width:100%;margin-top:6px"><i style="width:' + (v || 0) + '%;background:' + col + '"></i></div></div>';
  }).join('');

  var scenarios = [
    ['แตะ $150M (Small-Cap Breakout)', 1.5e8],
    ['แตะ $700M (ฐาน ZEC ก่อนวิ่ง)', 7e8],
    ['แตะ $2.5B (เป้า Mid-Cap ตลาดกระทิง)', 2.5e9],
    ['แตะ $6.5B (เทียบเท่าระดับ XMR)', 6.5e9],
    ['แตะ $25.95B (ยอด ZEC Bull Peak)', 25.95e9]
  ];
  var roiRows = scenarios.map(function (scItem) {
    var sim = calcTarget(c, scItem[1]);
    if (!sim || sim.mult <= 1.02) return '';
    return '<tr>' +
      '<td><b>' + scItem[0] + '</b></td>' +
      '<td class="num">' + fmtPrice(sim.targetPrice) + '</td>' +
      '<td class="num up"><b>' + fmtMult(sim.mult) + '</b></td>' +
      '<td class="num ' + (sim.fdvMult < sim.mult * 0.85 ? 'down' : 'up') + '"><b>' + fmtMult(sim.fdvMult) + '</b></td>' +
      '<td class="num"><b>' + fmtUsd(inv * sim.fdvMult) + '</b></td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="5" class="dim">Market Cap ปัจจุบันสูงกว่าเป้าหมายจำลองแล้ว</td></tr>';

  var paneOverview =
    '<div class="mPane' + (state.modalTab === 'overview' ? ' on' : '') + '">' +
    '<div class="mBox"><h4>📌 สรุปแกนหลักโปรเจกต์ <span class="dim" style="font-size:12px;font-weight:400">' + vd.desc + '</span></h4>' +
    '<div class="kvGrid">' +
    '<div class="kvItem"><div class="k">คะแนน Bull Upside</div><div class="v up">' + (asy.score != null ? asy.score + ' / 100' : '—') + '</div></div>' +
    '<div class="kvItem"><div class="k">คะแนนพื้นฐานรวม</div><div class="v acc">' + (sc != null ? sc + ' / 100' : '—') + '</div></div>' +
    '<div class="kvItem"><div class="k">กลไกความลับ</div><div class="v" style="font-size:12.5px;font-family:var(--sans)">' + (d.prim || q.mech || '—') + '</div></div>' +
    '<div class="kvItem"><div class="k">สิ่งที่ซ่อนได้จริง</div><div class="v" style="font-size:12.5px;font-family:var(--sans)">' + (d.hides || '—') + '</div></div>' +
    '</div></div>' +
    '<div class="mBox"><h4>📊 คะแนน 6 เสาหลัก (6-Pillar Breakdown)</h4><div class="kvGrid">' + pBars + '</div></div>' +
    '<div class="mBox"><h4>💰 จำลองกำไรเมื่อลงทุน $' + inv.toLocaleString('en-US') + ' (หัก Dilution เหรียญล็อกแล้ว)</h4>' +
    '<div style="overflow-x:auto"><table class="cleanTbl"><thead><tr>' +
    '<th>เป้าหมาย Market Cap</th><th class="num">ราคาเป้า</th><th class="num">เด้ง (ปกติ)</th><th class="num">เด้งสุทธิ (หักล็อก)</th><th class="num">มูลค่าพอร์ตสุทธิ</th>' +
    '</tr></thead><tbody>' + roiRows + '</tbody></table></div></div>' +
    '</div>';

  /* --- PANE 2: Deep FDV Overhang & Supply Unlock Forensics --- */
  var alertCls = sf.tier === 'CRITICAL_LOCK' ? 'crit' : (sf.tier === 'HEAVY_LOCK' || sf.tier === 'MOD_LOCK' ? 'warn' : (sf.tier === 'POW_EMISSION' ? 'pow' : 'ok'));
  var alertMsg = sf.tier === 'CRITICAL_LOCK'
    ? '🚨 <b>คำเตือนระดับสูงสุด (VC / Team Unlock Overhang):</b> มีเหรียญเสกไว้แล้วแต่ยังล็อกอยู่ถึง <b>' + fmtNum(sf.lockedTokens) + ' ' + c.s + ' (' + sf.lockedPct + '%)</b> คิดเป็นเงิน <b>' + fmtUsd(sf.lockedUsd) + '</b> ณ ราคาปัจจุบัน · <b>ห้ามไล่ราคาเมื่อเหรียญพุ่งแรง</b> ควรรอจังหวะย่อหลังวันปลดล็อกหรือเก็งกำไรสั้นเท่านั้น'
    : (sf.tier === 'HEAVY_LOCK'
    ? '⚠️ <b>เหรียญล็อกระดับสูง (' + sf.lockedPct + '%):</b> มีเหรียญเสกรอปลดล็อกมูลค่า <b>' + fmtUsd(sf.lockedUsd) + '</b> เวลาตั้งเป้ากำไรต้องหักส่วนลด Dilution (ราคาจริงจะขึ้นเพียง <b>' + sf.retentionPct + '%</b> ของการเติบโต Mcap)'
    : (sf.tier === 'POW_EMISSION'
    ? '⛏️ <b>ปลอดภัยจาก VC เทขาย (PoW / Protocol Emission):</b> เหรียญที่เสกออกมาแล้วหมุนเวียนอยู่ในตลาดเกือบทั้งหมด (<b>ล็อกจริง ' + sf.lockedPct + '%</b>) ส่วนที่เหลืออีก <b>' + sf.unminedPct + '%</b> คือเหรียญที่ยังไม่ถูกสร้างและต้องขุดตามบล็อกในอีกหลายสิบปี'
    : '💎 <b>โครงสร้างเหรียญสะอาด (Clean Float):</b> หมุนเวียนในตลาดแล้ว <b>' + sf.circPct + '%</b> ไร้แรงเทขายก้อนใหญ่จากเหรียญปลดล็อก เม็ดเงินใหม่ไหลเข้าจะดันราคาเหรียญได้เต็มประสิทธิภาพ'));

  var paneFdv =
    '<div class="mPane' + (state.modalTab === 'fdv' ? ' on' : '') + '">' +
    '<div class="alertBox ' + alertCls + '">' + alertMsg + '</div>' +
    '<div class="mBox"><h4>🔓 ผ่าโครงสร้างเหรียญ 3 ชั้น (3-Layer Supply Anatomy)</h4>' +
    '<div class="supBar3">' +
    '<i style="width:' + sf.circPct + '%;background:var(--up)"></i>' +
    '<i style="width:' + sf.lockedPct + '%;background:var(--down)"></i>' +
    '<i style="width:' + sf.unminedPct + '%;background:var(--accent)"></i></div>' +
    '<div class="supLegend">' +
    '<div><span><i class="dot" style="background:var(--up)"></i><b>1. หมุนเวียนในตลาด (Circulating)</b></span><span class="mono"><b>' + sf.circPct + '%</b> (' + fmtNum(sf.cs) + ' ' + c.s + ')</span></div>' +
    '<div><span><i class="dot" style="background:var(--down)"></i><b>2. เสกแล้วแต่ยังล็อกอยู่ (Pre-Minted Locked — แรงเทขายจริง)</b></span><span class="mono ' + (sf.lockedPct > 25 ? 'down' : '') + '"><b>' + sf.lockedPct + '%</b> (' + fmtNum(sf.lockedTokens) + ' ' + c.s + ' = ' + (sf.lockedUsd > 0 ? fmtUsd(sf.lockedUsd) : '$0') + ')</span></div>' +
    '<div><span><i class="dot" style="background:var(--accent)"></i><b>3. ยังไม่ถูกสร้าง/รอขุดตามบล็อก (Unmined Emission)</b></span><span class="mono">' + (sf.isUncapped ? 'ไม่จำกัดเพดาน (Tail Emission)' : '<b>' + sf.unminedPct + '%</b> (' + fmtNum(sf.unminedTokens) + ' ' + c.s + ')') + '</span></div>' +
    '</div></div>' +
    '<div class="mBox"><h4>🔬 ตารางทดสอบแรงรับสภาพคล่อง (Unlock Stress-Test)</h4>' +
    '<div class="kvGrid">' +
    '<div class="kvItem"><div class="k">อัตราส่วน FDV / Mcap</div><div class="v ' + (sf.fdvMcap > 2.5 ? 'down' : 'up') + '">' + sf.fdvMcap + 'x</div></div>' +
    '<div class="kvItem"><div class="k">มูลค่าเหรียญล็อกรอปลด</div><div class="v ' + (sf.lockedUsd > (c.m || 0) ? 'down' : '') + '">' + (sf.lockedUsd > 0 ? fmtUsd(sf.lockedUsd) : '$0') + '</div></div>' +
    '<div class="kvItem"><div class="k">วอลุ่ม 24h ต้องซับของกี่วัน</div><div class="v">' + (sf.daysToAbsorbLocked > 0 ? sf.daysToAbsorbLocked + ' วัน' : '0 วัน') + '</div></div>' +
    '<div class="kvItem"><div class="k">หากปลดล็อก 5% คิดเป็นกี่ % ของ Vol</div><div class="v ' + (sf.shock5PctOfVol > 80 ? 'down' : '') + '">' + (sf.shock5PctOfVol > 0 ? sf.shock5PctOfVol + '% ของ Vol/วัน' : '0%') + '</div></div>' +
    '<div class="kvItem"><div class="k">เงินใหม่ที่ต้องเติมเพื่อยันราคาเดิม</div><div class="v">' + (sf.newCashNeeded > 0 ? fmtUsd(sf.newCashNeeded) : '$0') + '</div></div>' +
    '<div class="kvItem"><div class="k">Mcap โต 10x → ราคาเหรียญโตจริง</div><div class="v up">' + (10 * sf.retentionPct / 100).toFixed(2) + 'x (' + sf.retentionPct + '%)</div></div>' +
    '</div></div></div>';

  /* --- PANE 3: Risks & Red Flags vs Bull Catalysts --- */
  var flgHtml = (ev.fl || []).map(function (f) {
    var cls = (f.lv === 'CRITICAL' || f.lv === 'HIGH') ? 'flg' : 'med';
    var extra = '';
    if (f.id === 'fdv_overhang' || f.id === 'locked_overhang') {
      extra = '<div class="flgSub">ผ่าตัวเลขจริง: หมุนเวียน <b>' + sf.circPct + '%</b> · เสกล็อกรอปลด <b>' + sf.lockedPct + '% (' + fmtUsd(sf.lockedUsd) + ')</b> · รอขุด <b>' + sf.unminedPct + '%</b> · ต้องใช้วอลุ่มตลาด <b>' + sf.daysToAbsorbLocked + ' วัน</b> เพื่อรับของก้อนที่ล็อก<br>' +
        '<button class="lkBtn" style="margin-top:6px;padding:4px 10px" data-goto-fdv="1">🔓 เปิดดูหน้าผ่าเหรียญล็อก FDV แบบละเอียด →</button></div>';
    }
    return '<li class="' + cls + '"><b>[' + f.lv + ' · ' + f.id + ']</b> ' + f.msg + extra + '</li>';
  }).join('') || '<li class="pos">✅ <b>ไม่พบธงแดง (0 Red Flags):</b> ผ่านเกณฑ์ความเสี่ยงพื้นฐานทั้งหมด</li>';

  var posHtml = (ev.pos || []).map(function (p) {
    return '<li class="pos">🟢 <b>' + p.id + ':</b> ' + p.msg + '</li>';
  }).join('') || '<li class="kvItem dim">ไม่มีสัญญาณบวกพิเศษในรอบนี้</li>';

  var paneRisks =
    '<div class="mPane' + (state.modalTab === 'risks' ? ' on' : '') + '">' +
    '<div class="mBox"><h4>🚨 ความเสี่ยงและจุดที่ต้องระวัง (Red Flags &amp; ข้อจำกัดจริง)</h4>' +
    (d.risk ? '<div class="alertBox warn" style="margin-bottom:10px"><b>📌 ความเสี่ยงเชิงโครงสร้าง:</b> ' + d.risk + '</div>' : '') +
    '<ul class="chkList">' + flgHtml + '</ul></div>' +
    '<div class="mBox"><h4>🟢 ปัจจัยบวกหนุนราคา (Bull Catalysts)</h4><ul class="chkList">' + posHtml + '</ul></div>' +
    '</div>';

  /* --- PANE 4: 14-Gene Cryptographic DNA & Official Links --- */
  function lnk(url, lbl) { return url ? '<a class="lkBtn" href="' + url + '" target="_blank" rel="noopener">' + lbl + ' ↗</a>' : ''; }
  var linksBar = lnk(dt.home, '🌐 เว็บไซต์') + lnk(dt.wp, '📄 Whitepaper') + lnk(dt.gh, '💻 GitHub') +
    lnk(dt.explorer, '🔎 Explorer') + lnk('https://www.coingecko.com/en/coins/' + c.id, '📊 CoinGecko');

  var geneRows = GENE_LABELS.map(function (gl) {
    var k = gl[0], lbl = gl[1], raw = d[k];
    var v = gval(d, k), src = gsrc(d, k);
    var note = (raw && typeof raw === 'object' && raw.note) ? raw.note : '';
    return '<tr>' +
      '<td><b>' + lbl + '</b>' + (note ? '<div class="dim" style="font-size:11px;margin-top:2px">' + note + '</div>' : '') + '</td>' +
      '<td class="mono num"><b>' + (v != null ? v : '—') + '</b></td>' +
      '<td class="num">' + (src ? '<a href="' + src + '" target="_blank" rel="noopener">หลักฐาน ↗</a>' : '<span class="dim">—</span>') + '</td>' +
      '</tr>';
  }).join('');

  var paneDna =
    '<div class="mPane' + (state.modalTab === 'dna' ? ' on' : '') + '">' +
    '<div class="mBox"><h4>🔗 ลิงก์ตรวจสอบด้วยตัวเอง (Official Due Diligence Links)</h4><div class="linksRow">' + linksBar + '</div></div>' +
    '<div class="mBox"><h4>🧬 ตาราง 14 ยีนความลับพร้อมลิงก์หลักฐาน (Verified Cryptographic DNA)</h4>' +
    '<table class="cleanTbl"><thead><tr><th>มิติทางเทคนิค</th><th class="num">ค่าคะแนน</th><th class="num">อ้างอิง</th></tr></thead><tbody>' + geneRows + '</tbody></table></div>' +
    '</div>';

  $('mBody').innerHTML = paneOverview + paneFdv + paneRisks + paneDna;

  var gotoBtn = $('mBody').querySelector('[data-goto-fdv]');
  if (gotoBtn) {
    gotoBtn.onclick = function () {
      state.modalTab = 'fdv';
      renderCoinModal(c);
    };
  }
}

function bindOpenModal(container) {
  if (!container || !container.querySelectorAll) return;
  var els = container.querySelectorAll('[data-open]');
  for (var i = 0; i < els.length; i++) {
    els[i].onclick = function () {
      var sym = this.getAttribute('data-open');
      var tab = this.getAttribute('data-tab') || 'overview';
      if (sym) openCoinModal(sym, tab);
    };
  }
}

/* ============================================================================
 * View 4: Docs & Research
 * ============================================================================ */
function renderDocs() {
  var dw = $('docsWrap');
  if (!dw) return;
  var d = DOCSPAY || { docs: [], idx: [] };
  if (!d.docs.length) { dw.innerHTML = '<p class="dim">ไม่พบเอกสาร</p>'; return; }
  dw.innerHTML = d.docs.map(function (x) {
    return '<div class="mBox" style="margin-bottom:12px"><h4>📄 ' + x.t + ' <span class="dim" style="font-size:11px">' + x.p + '</span></h4>' +
      '<div style="font-size:13px;line-height:1.65;color:var(--tx2)">' + x.h + '</div></div>';
  }).join('');
}

function renderMain() {
  var gw = $('gemsWrap'), tw = $('tblWrap'), fw = $('fdvWrap'), dw = $('docsWrap');
  if (gw) gw.style.display = (state.view === 'gems') ? 'block' : 'none';
  if (tw) tw.style.display = (state.view === 'table') ? 'block' : 'none';
  if (fw) fw.style.display = (state.view === 'fdv') ? 'block' : 'none';
  if (dw) dw.style.display = (state.view === 'docs') ? 'block' : 'none';

  if (state.view === 'gems') renderGems();
  else if (state.view === 'table') renderTable();
  else if (state.view === 'fdv') renderFdvScanner();
  else if (state.view === 'docs') renderDocs();
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
}

function liveRefresh() {
  var btn = $('liveBtn');
  btn.textContent = '… กำลังดึง';
  var ps = LIVE_CATS.map(function (cat) {
    return fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=' + cat[0] + '&order=market_cap_desc&per_page=250&page=1&price_change_percentage=24h,7d,30d,1y')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (arr) { return arr.map(function (c) { return recFrom(c, cat[1]); }); });
  });
  Promise.all(ps).then(function (lists) {
    var byId = {};
    lists.forEach(function (l) { l.forEach(function (r) { if (!byId[r.id]) byId[r.id] = r; }); });
    var out = Object.keys(byId).map(function (k) { return byId[k]; }).filter(function (r) { return IDMAP[r.id]; });
    out.sort(function (a, b) { return (b.m || 0) - (a.m || 0); });
    DATA = out;
    augment();
    renderStats(); renderPillBar(); renderMain();
    $('liveStatus').textContent = 'สดแล้ว';
    btn.textContent = '⟳ ราคาสด';
  }).catch(function () {
    $('liveStatus').textContent = 'ใช้ข้อมูลล่าสุด';
    btn.textContent = '⟳ ราคาสด';
  });
}

function init() {
  for (var t = 0; t < DATA.length; t++) {
    TIERMAP[DATA[t].s] = DATA[t].tier || 't3';
    IDMAP[DATA[t].id] = { tier: DATA[t].tier || 't3', dna: DATA[t].dna || 0 };
  }
  augment();
  renderStats();
  renderViewSwitch();
  renderPillBar();
  renderMain();

  $('q').addEventListener('input', function () { state.q = this.value; renderMain(); });
  $('invAmt').addEventListener('change', function () {
    state.invAmt = parseFloat(this.value) || 1000;
    renderMain();
    if (state.modalSym) openCoinModal(state.modalSym, state.modalTab);
  });
  $('sortSel').addEventListener('change', function () {
    state.sortKey = this.value || 'bull';
    state.dir = -1;
    renderMain();
  });
  $('minMcap').addEventListener('change', function () {
    state.minMcap = parseFloat(this.value) || 0;
    renderMain();
  });

  var ths = document.querySelectorAll('#tbl thead th[data-k]');
  for (var i = 0; i < ths.length; i++) {
    ths[i].onclick = function () {
      var k = this.getAttribute('data-k');
      if (state.sortKey === k) state.dir *= -1;
      else { state.sortKey = k; state.dir = (k === 's') ? 1 : -1; }
      renderMain();
    };
  }

  $('coinModal').addEventListener('click', function (e) {
    if (e.target === $('coinModal')) closeCoinModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.modalSym) closeCoinModal();
  });
}
init();
