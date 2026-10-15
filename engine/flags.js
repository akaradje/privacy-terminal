/* engine/flags.js — Red Flag Engine (v3 blueprint §5)
 * Input: a flat metric object per coin (market + dev + curated).
 * Output: [{id, lv, msg}] sorted CRITICAL -> LOW.
 * Thresholds are defaults; the blueprint marks them as tunable starting points.
 */
var FLAG_LEVELS = ['CRITICAL', 'HIGH', 'MED', 'LOW'];

var FLAG_RULES = [
  { id: 'dead_repo', lv: 'CRITICAL', test: function (x) { return x.days_since_push > 365 || x.gh_archived; }, msg: 'Repo ไม่เคลื่อนไหวเกิน 1 ปี หรือถูก archive' },
  { id: 'unpatched_break', lv: 'CRITICAL', test: function (x) { return x.brk === 1; }, msg: 'เคยมีช่องโหว่ privacy ที่ยังไม่ปิด' },
  { id: 'single_venue', lv: 'CRITICAL', test: function (x) { return x.top_venue_share > 0.7; }, msg: 'พึ่งพากระดานเทรดเดียวเกิน 70% ของ volume' },
  { id: 'bus_factor_1', lv: 'HIGH', test: function (x) { return x.bus_factor === 1; }, msg: 'bus factor = 1 (คนเดียวหายแล้วโปรเจกต์สะดุด)' },
  { id: 'heavy_unlock', lv: 'HIGH', test: function (x) { return x.unlock_30d > 5; }, msg: 'มี unlock เกิน 5% ของ supply ใน 30 วัน' },
  { id: 'wash_suspicion', lv: 'HIGH', test: function (x) { return x.turnover > 1.0; }, msg: 'turnover > 1.0 — volume สูงผิดปกติเมื่อเทียบ mcap' },
  { id: 'centralized_consensus', lv: 'HIGH', test: function (x) { return x.nakamoto != null && x.nakamoto <= 2; }, msg: 'Nakamoto coefficient ≤ 2' },
  { id: 'recent_delist', lv: 'HIGH', test: function (x) { return x.delist_recent === 1; }, msg: 'ถูกถอดจากกระดานเทรดภายใน 12 เดือน' },
  { id: 'high_inflation', lv: 'MED', test: function (x) { return x.inflation > 10; }, msg: 'เงินเฟ้อปีละเกิน 10%' },
  { id: 'fdv_overhang', lv: 'MED', test: function (x) { return x.fdv_mcap > 3; }, msg: 'FDV สูงกว่า mcap เกิน 3 เท่า' },
  { id: 'optin_theatre', lv: 'MED', test: function (x) { return x.man === 0 && x.shielded_pct != null && x.shielded_pct < 5; }, msg: 'privacy แบบ opt-in ที่มีคนใช้ต่ำกว่า 5% (privacy theatre)' },
  { id: 'thin_liquidity', lv: 'MED', test: function (x) { return x.depth2 != null && x.depth2 < 50000; }, msg: 'depth ±2% ต่ำกว่า $50k' },
  { id: 'stale_data', lv: 'LOW', test: function (x) { return x.data_age_days > 180; }, msg: 'ข้อมูลเก่ากว่า 180 วัน' },
  { id: 'no_recent_audit', lv: 'LOW', test: function (x) { return x.audits_24m === 0; }, msg: 'ไม่มี audit ใน 24 เดือน' }
];

function evaluateFlags(x) {
  x = x || {};
  var out = [];
  for (var i = 0; i < FLAG_RULES.length; i++) {
    var r = FLAG_RULES[i];
    try { if (r.test(x)) out.push({ id: r.id, lv: r.lv, msg: r.msg }); } catch (e) { /* missing metric -> rule not triggered */ }
  }
  out.sort(function (a, b) { return FLAG_LEVELS.indexOf(a.lv) - FLAG_LEVELS.indexOf(b.lv); });
  return out;
}

function flagLevel(flags) {
  if (!flags || !flags.length) return null;
  return flags[0].lv; // already sorted by severity
}

/* metrics the engine can derive from what the build already collects */
function metricsFor(coin, detail, dna) {
  var out = {};
  if (detail) {
    if (detail.gh_pushed) {
      var d = (Date.now() - Date.parse(detail.gh_pushed)) / 86400000;
      if (!isNaN(d)) out.days_since_push = Math.round(d);
    }
    if (detail.gh_archived != null) out.gh_archived = detail.gh_archived ? 1 : 0;
    if (detail.ex_count) out.ex_count = detail.ex_count;
  }
  if (coin) {
    if (coin.m && coin.v) out.turnover = +(coin.v / coin.m).toFixed(2);
    if (coin.ms && coin.cs) out.fdv_mcap = +((coin.m / coin.cs * coin.ms) / coin.m).toFixed(2);
  }
  if (dna) {
    var man = (dna.man && typeof dna.man === 'object') ? dna.man.v : dna.man;
    out.man = man == null ? null : man;
    var brk = (dna.brk && typeof dna.brk === 'object') ? dna.brk.v : dna.brk;
    out.brk = brk ? 1 : 0;
  }
  return out;
}
