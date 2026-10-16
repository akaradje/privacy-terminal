/* engine/flags.js — Red Flag & Bull-Run Opportunity Engine (v3 blueprint §5 + v2.8 Bull-Run Scanner)
 * Input: a flat metric object per coin (market + dev + curated + 6-pillar scores).
 * Output: [{id, lv, msg}] sorted CRITICAL -> LOW, plus positive bull-run signals.
 */
var FLAG_LEVELS = ['CRITICAL', 'HIGH', 'MED', 'LOW'];

var FLAG_RULES = [
  { id: 'dead_repo', lv: 'CRITICAL', test: function (x) { return x.days_since_push > 365 || x.gh_archived; }, msg: 'Repo ไม่เคลื่อนไหวเกิน 1 ปี หรือถูก archive' },
  { id: 'unpatched_break', lv: 'CRITICAL', test: function (x) { return x.brk === 1; }, msg: 'เคยมีช่องโหว่ privacy ที่ยังไม่ปิด (brk=1)' },
  { id: 'single_venue', lv: 'CRITICAL', test: function (x) { return x.top_venue_share > 0.7; }, msg: 'พึ่งพากระดานเทรดเดียวเกิน 70% ของ volume' },
  { id: 'bus_factor_1', lv: 'HIGH', test: function (x) { return x.bus_factor === 1; }, msg: 'bus factor = 1 (คนเดียวหายแล้วโปรเจกต์สะดุด)' },
  { id: 'heavy_unlock', lv: 'HIGH', test: function (x) { return x.unlock_30d > 5; }, msg: 'มี unlock เกิน 5% ของ supply ใน 30 วัน' },
  { id: 'wash_suspicion', lv: 'HIGH', test: function (x) { return x.turnover > 1.0; }, msg: 'turnover > 1.0 — volume สูงผิดปกติเมื่อเทียบ mcap' },
  { id: 'centralized_consensus', lv: 'HIGH', test: function (x) { return x.nakamoto != null && x.nakamoto <= 2; }, msg: 'Nakamoto coefficient ≤ 2' },
  { id: 'recent_delist', lv: 'HIGH', test: function (x) { return x.delist_recent === 1; }, msg: 'ถูกถอดจากกระดานเทรดภายใน 12 เดือน' },
  { id: 'ghost_chain', lv: 'HIGH', test: function (x) { return x.days_since_push > 60 && x.c30 != null && x.c30 > 50; }, msg: 'ราคา +50% ใน 30 วัน แต่ไม่มีการ push โค้ดเกิน 60 วัน — ราคาวิ่งโดยไม่มีงานพัฒนา' },
  { id: 'illiquid', lv: 'HIGH', test: function (x) { return x.turnover != null && x.turnover < 0.002; }, msg: 'turnover ต่อวันต่ำกว่า 0.2% ของ mcap — ออกของไม่ได้โดยไม่กดราคา' },
  { id: 'dev_stalled', lv: 'MED', test: function (x) { return x.days_since_push > 90 && x.days_since_push <= 365; }, msg: 'ไม่มีการ push โค้ดเกิน 90 วัน' },
  { id: 'micro_cap', lv: 'MED', test: function (x) { return x.mcap != null && x.mcap < 5000000; }, msg: 'mcap ต่ำกว่า $5M — ความเสี่ยงสภาพคล่องและการเพิกถอน' },
  { id: 'mcap_imputed', lv: 'LOW', test: function (x) { return x.mcap_imputed === 1; }, msg: 'market cap มาจากการคำนวณ (price × supply) เพราะ API รายงาน 0 — ตัวเลขสภาพคล่องอ่านโดยประมาณ' },
  { id: 'no_dev_data', lv: 'LOW', test: function (x) { return x.days_since_push == null; }, msg: 'ไม่มีข้อมูล repo ที่ยืนยันได้ — ประเมิน pillar D ไม่ได้' },
  { id: 'high_inflation', lv: 'MED', test: function (x) { return x.inflation > 10; }, msg: 'เงินเฟ้อปีละเกิน 10%' },
  { id: 'fdv_overhang', lv: 'MED', test: function (x) { return x.fdv_mcap > 3; }, msg: 'FDV สูงกว่า mcap เกิน 3 เท่า (แรงเทขายจากเหรียญที่ยังล็อกอยู่)' },
  { id: 'locked_overhang', lv: 'MED', test: function (x) { return x.fdv_mcap > 1.75 && x.fdv_mcap <= 3 && x.locked_pct >= 35; }, msg: 'มีเหรียญเสกไว้แล้วแต่ยังล็อกอยู่ 35%–65% ของอุปทาน (FDV 1.8x–3.0x ของ mcap)' },
  { id: 'optin_theatre', lv: 'MED', test: function (x) { return x.man === 0 && x.shielded_pct != null && x.shielded_pct < 5; }, msg: 'privacy แบบ opt-in ที่มีคนใช้ต่ำกว่า 5% (privacy theatre)' },
  { id: 'thin_liquidity', lv: 'MED', test: function (x) { return x.depth2 != null && x.depth2 < 50000; }, msg: 'depth ±2% ต่ำกว่า $50k' },
  { id: 'stale_data', lv: 'LOW', test: function (x) { return x.data_age_days > 180; }, msg: 'ข้อมูลเก่ากว่า 180 วัน' },
  { id: 'no_recent_audit', lv: 'LOW', test: function (x) { return x.audits_24m === 0; }, msg: 'ไม่มี audit ใน 24 เดือน' }
];

/* Opportunity & Bull-Run Alpha signals — read for what is GOOD (v3 blueprint §3.3 "🟢").
 * Specifically calibrated to surface "The Next Zcash" (high fundamental quality + compliance/access
 * rails + clean float + early accumulation before a multi-billion re-rating). */
var POSITIVE_RULES = [
  {
    id: 'zec_archetype',
    test: function (x) {
      return x.P != null && x.P >= 42 && x.comp === 2 && x.days_since_push != null &&
             x.days_since_push <= 35 && !x.sanctioned && (x.brk == null || x.brk < 1);
    },
    msg: 'พิมพ์เขียว ZEC: มี Viewing Key / Selective Disclosure (comp=2) + กลไกความลับจริง + โค้ด active พร้อมรับเม็ดเงินสถาบัน/CEX'
  },
  {
    id: 'asymmetric_gem',
    test: function (x) {
      return x.composite != null && x.composite >= 64 && x.mcap != null &&
             x.mcap >= 5e6 && x.mcap <= 6e8 && (x.fdv_mcap == null || x.fdv_mcap <= 1.45) &&
             (x.locked_pct == null || x.locked_pct <= 22);
    },
    msg: 'Asymmetric Gem: คะแนนพื้นฐานระดับ Top-tier (Composite ≥64) + โซนสะสม ($5M–$600M) + ไร้ระเบิดเวลา FDV'
  },
  {
    id: 'sovereign_scarcity',
    test: function (x) {
      return x.P != null && x.P >= 70 && x.man != null && x.man >= 0.5 &&
             (x.locked_pct == null || x.locked_pct <= 15) && x.days_since_push != null && x.days_since_push <= 35;
    },
    msg: 'Sovereign Privacy: ความลับระดับสูงสุด (P ≥70, Default/Mandatory) + ไร้ VC Unlock Overhang'
  },
  {
    id: 'early_accumulation',
    test: function (x) {
      return x.turnover != null && x.turnover >= 0.015 && x.turnover <= 0.35 &&
             ((x.c7 != null && x.c7 > 0 && x.c30 != null && x.c30 > 8) ||
              (x.c24 != null && x.c24 > 3 && x.c7 != null && x.c7 > 3)) &&
             (x.c1y == null || x.c1y < 250);
    },
    msg: 'สัญญาณสะสมต้นรอบ: Volume หมุนเวียนคึกคัก (1.5%–35%/วัน) พร้อมโมเมนตัมราคาเริ่มยกตัวจากฐาน'
  },
  {
    id: 'multi_venue_rail',
    test: function (x) {
      return x.ex_count != null && x.ex_count >= 10 && x.turnover != null && x.turnover >= 0.01 && !x.sanctioned;
    },
    msg: 'ท่อสภาพคล่องตลาดกระทิงพร้อม: ลิสต์ ≥10 กระดานเทรด และมีสภาพคล่องรองรับเม็ดเงินรอบใหม่'
  },
  { id: 'dev_active', test: function (x) { return x.days_since_push != null && x.days_since_push <= 14; }, msg: 'โค้ดเคลื่อนไหวภายใน 14 วัน' },
  { id: 'dev_surge', test: function (x) { return x.stars != null && x.stars >= 500 && x.days_since_push != null && x.days_since_push <= 30; }, msg: 'repo มีนักพัฒนา/ผู้ติดตามสูง (★ ≥500) และยัง active ใน 30 วัน' },
  { id: 'deep_liquidity', test: function (x) { return x.turnover != null && x.turnover >= 0.02 && x.mcap >= 5e7; }, msg: 'สภาพคล่องหนา (turnover ≥2% ต่อวัน, mcap ≥$50M)' },
  { id: 'low_fdv', test: function (x) { return x.fdv_mcap != null && x.fdv_mcap <= 1.1; }, msg: 'FDV ใกล้ mcap — ไม่มี unlock overhang กดราคาในตลาดกระทิง' },
  { id: 'managed_float', test: function (x) { return x.cs != null && x.eff_max != null && x.eff_max > 0 && x.cs / x.eff_max >= 0.9; }, msg: 'เหรียญหมุนเวียนแล้วเกิน 90% (ไร้แรงเทขายจากเหรียญปลดล็อก)' },
  { id: 'repricing_from_low', test: function (x) { return x.c1y != null && x.c1y > 100 && x.mcap >= 1e7; }, msg: 'ขึ้นเกิน 100% ในรอบปีจากฐานต่ำ — ตลาดเริ่มรับรู้มูลค่าแล้ว' }
];

function evaluatePositives(x) {
  x = x || {};
  var out = [];
  for (var i = 0; i < POSITIVE_RULES.length; i++) {
    var r = POSITIVE_RULES[i];
    try { if (r.test(x)) out.push({ id: r.id, msg: r.msg }); } catch (e) { /* missing metric */ }
  }
  return out;
}

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

function _unw(v) {
  return (v && typeof v === 'object') ? v.v : v;
}

/* metrics the engine can derive from what the build already collects */
function metricsFor(coin, detail, dna, asof) {
  var out = {};
  var refMs = asof ? Date.parse(String(asof).length <= 10 ? String(asof) + 'T00:00:00Z' : String(asof)) : NaN;
  if (isNaN(refMs)) refMs = Date.now();
  if (detail) {
    if (detail.gh_pushed) {
      var pMs = Date.parse(detail.gh_pushed.length <= 10 ? detail.gh_pushed + 'T00:00:00Z' : detail.gh_pushed);
      var d = (refMs - pMs) / 86400000;
      if (!isNaN(d)) out.days_since_push = Math.round(d);
    }
    if (detail.gh_archived != null) out.gh_archived = detail.gh_archived ? 1 : 0;
    if (detail.ex_count != null) out.ex_count = detail.ex_count;
    if (detail.stars != null) out.stars = detail.stars;
  }
  if (coin) {
    if (coin.m && coin.v) out.turnover = +(coin.v / coin.m).toFixed(4);
    var effMax = Math.max(coin.ms || 0, coin.ts || 0);
    if (effMax > 0 && coin.cs && coin.cs > 0) {
      out.fdv_mcap = +(effMax / coin.cs).toFixed(2);
      out.eff_max = effMax;
      var locked = Math.max(0, (coin.ts || coin.cs) - coin.cs);
      out.locked_pct = +((locked / effMax) * 100).toFixed(1);
    } else if (coin.fdv && coin.m && coin.m > 0) {
      out.fdv_mcap = +(coin.fdv / coin.m).toFixed(2);
    }
    if (coin.m != null) out.mcap = coin.m;
    if (coin.mi != null) out.mcap_imputed = coin.mi;
    if (coin.cs != null) out.cs = coin.cs;
    if (coin.ts != null) out.ts = coin.ts;
    if (coin.ms != null) out.ms = coin.ms;
    if (coin.c24 != null) out.c24 = coin.c24;
    if (coin.c7 != null) out.c7 = coin.c7;
    if (coin.c30 != null) out.c30 = coin.c30;
    if (coin.c1y != null) out.c1y = coin.c1y;
  }
  if (dna) {
    out.man = _unw(dna.man);
    var brk = _unw(dna.brk);
    /* Preserve ternary brk (0 / 0.5 / 1): only brk === 1 is an unpatched break. */
    out.brk = brk == null ? null : +brk;
    out.comp = _unw(dna.comp);
    out.audit = _unw(dna.audit);
    out.sanctioned = _unw(dna.sanctioned) ? 1 : 0;
  }
  if (typeof pillarsOf === 'function' && dna) {
    try {
      var pl = pillarsOf(dna, coin, detail, asof);
      if (pl) {
        out.P = pl.P; out.D = pl.D; out.L = pl.L; out.T = pl.T; out.S = pl.S; out.R = pl.R;
      }
      if (typeof compositeOf === 'function') {
        out.composite = compositeOf(dna, coin, detail, asof, 'privacy_investor', true);
      }
      if (typeof asymmetryOf === 'function') {
        var asy = asymmetryOf(dna, coin, detail, asof);
        if (asy) {
          out.bullScore = asy.score;
          out.archetype = asy.archetype;
        }
      }
    } catch (e) { /* standalone flags evaluation */ }
  }
  return out;
}
