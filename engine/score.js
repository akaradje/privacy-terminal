/* engine/score.js — DNA v2 scorer (v3 blueprint §3.1, §4)
 * SINGLE SOURCE OF TRUTH for the P (Privacy Strength) pillar.
 * Loaded by build (Node) and by the browser — never re-implement this formula elsewhere.
 *
 * scoring_version: 2.3.1-preview
 *
 * --- Definition of `aset` (one definition for every mechanism family) -------------
 * `aset` = EFFECTIVE PER-TRANSACTION ANONYMITY SET: the number of plausible counterparties an
 * observer must consider for ONE transaction, at the moment it is made. Full rubric:
 *   data/schema/rubric.json
 *   ring signature   -> the EFFECTIVE value after known heuristics (decoy selection, change
 *                       output, timing), not the raw ring size; must cite research
 *   shielded pool    -> all note commitments in THAT pool (spent notes stay indistinguishable),
 *                       counted per pool (Sapling and Orchard are never merged)
 *   mixer / coinjoin -> size of the deposit pool for the same denomination/epoch
 *   TEE / MPC        -> number of USERS interacting with the same contract/pool during that
 *                       epoch. Trusting the operator is NOT anonymity: that risk belongs in
 *                       `tl` only, and counting it here would double-count it.
 * Precedence (rubric 2.1): protocol-enforced per-tx value -> live pool depth at asof ->
 * fallback to the lowest band when the claim is unverifiable (no src / conf=low).
 * Architecture role: `arch` = value-transfer | transport | compute. A transport/compute token
 * that lives on a transparent host chain scores hs/hr/ha = 0 — the privacy of its data packets
 * is not the privacy of its transfers, and is captured by hmeta/hnet instead.
 * It is NOT the cumulative size of the whole pool, and NOT the number of holders.
 * Consequence (accepted, not a bug): ring-based coins score low on the bits component by
 * construction; they recover the difference through `man` (mandatory privacy), which is the
 * property that actually carries their security argument. Never compare two families on
 * `aset` alone — compare on P, and read the parts.
 *
 * --- Missing data is NOT zero -----------------------------------------------------
 * A gene that has no value is null/absent, never 0. A component counts only when its genes
 * are present; the score is computed over the available weight and rescaled to 100, and the
 * band widens with the missing weight. `coverage` reports how much of the weight had data,
 * and `insufficient` is true below 80% — in that state the UI must not present v2 as a ranking.
 */
var SCORING_VERSION = '2.3.1-preview';
var ASET_BITS_FULL = 20;   // effective set of 2^20 == full credit for the bits component

/* Conservative baseline imputation — closes the null-rescale loophole.
 * Dropping a missing component out of the denominator assumes its value equals the average of
 * the remaining ones. For `bits` that assumption is systematically WRONG for ring families:
 * ring 16 scores 3/15, i.e. far below the average of the other components — so omitting `aset`
 * used to PAY, and a coin with no anonymity-set evidence outranked one that had published a
 * smaller, proven set. Rubric 2.2 tier-3 already states that an unproven anonymity set cannot
 * buy credit; this makes it binding in the arithmetic instead of only in prose.
 * An imputed component keeps its weight in the denominator at the floor value, is listed in
 * `imputed`, still appears in `missing`, and still widens `band` / lowers `coverage`.
 * A component with NO known floor keeps the null-aware behaviour (weight dropped, uncertainty
 * carried by `coverage`/`band`) — we do not pretend an unknown value is zero either.
 * Scoped to `bits` for now: it is the one component whose missing value is knowably low across
 * a whole family. Extending this table changes scores and needs its own evidence. */
var IMPUTE = { bits: 0 };

var W = { cov: 30, bits: 15, man: 12, tl: 12, hmeta: 10, hnet: 8, mat: 8, pq: 5, brkPenalty: 15 };
var CONF = { high: 1.0, med: 0.6, low: 0.3 };

/* a gene is either a bare number (legacy v1) or {v, conf, src, asof, note} (v2) */
function gval(g, key) {
  if (!g) return null;
  var x = g[key];
  if (x == null) return null;
  if (typeof x === 'object') return (x.v == null ? null : x.v);
  return x;
}
function gconf(g, key) {
  if (!g) return 'low';
  var x = g[key];
  if (x && typeof x === 'object') return x.conf || (x.src ? 'med' : 'low');
  return 'low';                       // bare numbers carry no evidence trail
}
function gsrc(g, key) {
  if (!g) return '';
  var x = g[key];
  return (x && typeof x === 'object' && x.src) ? x.src : '';
}

/* v1 score — kept so everything published before v3 stays comparable */
function scoreV1(d) {
  if (!d || gval(d, 'hs') == null) return null;
  var denom = 8 - (gval(d, 'nst') ? 2 : 0);
  var cov = Math.min((gval(d, 'hs') + gval(d, 'hr') + gval(d, 'ha') + (gval(d, 'hst') || 0)) / denom, 1);
  return Math.round(cov * 60 + (gval(d, 'man') ? 15 : 0) + (gval(d, 'tl') ? 15 : 0) + (gval(d, 'big') ? 10 : 0));
}

/* v2 — null-aware: score over the available weight, rescale to 100, widen the band */
function scoreP(d) {
  if (!d) return null;
  var nst = gval(d, 'nst') ? 1 : 0;
  var denom = 8 - 2 * nst;
  var hs = gval(d, 'hs'), hr = gval(d, 'hr'), ha = gval(d, 'ha'), hst = gval(d, 'hst') || 0;
  var hasCov = (hs != null && hr != null && ha != null);
  var cov = hasCov ? Math.min((hs + hr + ha + hst) / denom, 1) : null;

  var aset = gval(d, 'aset');
  var asetConf = gconf(d, 'aset'), asetSrc = gsrc(d, 'aset');
  var bits = (aset != null && aset > 1) ? Math.min(Math.log(aset) / Math.LN2 / ASET_BITS_FULL, 1) : null;
  /* rubric 2.1: an unverifiable anonymity-set claim cannot buy credit — cap it at the lowest band */
  if (bits != null && (!asetSrc || asetConf === 'low')) {
    bits = Math.min(bits, Math.log(1000) / Math.LN2 / ASET_BITS_FULL);
  }

  var man = gval(d, 'man');      // 0 opt-in | 0.5 default-on | 1 mandatory
  var tl = gval(d, 'tl');        // 0..2
  var hmeta = gval(d, 'hmeta');  // 0..2
  var hnet = gval(d, 'hnet');    // 0..2
  var mat = gval(d, 'mat');      // 0..2
  var pq = gval(d, 'pq');        // 0..2
  var brk = gval(d, 'brk') ? 1 : 0;

  var comps = [
    { k: 'cov', w: W.cov, v: cov == null ? null : cov, conf: hasCov ? gconf(d, 'hs') : null },
    { k: 'bits', w: W.bits, v: bits, conf: bits == null ? null : gconf(d, 'aset') },
    { k: 'man', w: W.man, v: man == null ? null : man, conf: man == null ? null : gconf(d, 'man') },
    { k: 'tl', w: W.tl, v: tl == null ? null : tl / 2, conf: tl == null ? null : gconf(d, 'tl') },
    { k: 'hmeta', w: W.hmeta, v: hmeta == null ? null : hmeta / 2, conf: hmeta == null ? null : gconf(d, 'hmeta') },
    { k: 'hnet', w: W.hnet, v: hnet == null ? null : hnet / 2, conf: hnet == null ? null : gconf(d, 'hnet') },
    { k: 'mat', w: W.mat, v: mat == null ? null : mat / 2, conf: mat == null ? null : gconf(d, 'mat') },
    { k: 'pq', w: W.pq, v: pq == null ? null : pq / 2, conf: pq == null ? null : gconf(d, 'pq') }
  ];

  var total = 0, avail = 0, observed = 0, earned = 0, confSum = 0, confN = 0, evid = 0, parts = {}, imputed = [];
  var EV_KEYS = { cov: ['hs', 'hr', 'ha', 'hst'], bits: ['aset'], man: ['man'], tl: ['tl'],
                  hmeta: ['hmeta'], hnet: ['hnet'], mat: ['mat'], pq: ['pq'] };
  for (var i = 0; i < comps.length; i++) {
    var c = comps[i];
    total += c.w;
    if (c.v == null) {
      /* Missing. If a conservative floor is known for this component the weight STAYS in the
       * denominator (so omitting the data cannot pay); otherwise the weight is dropped and the
       * uncertainty is carried by coverage/band instead. Never assume the average. */
      if (Object.prototype.hasOwnProperty.call(IMPUTE, c.k)) {
        avail += c.w;
        earned += c.w * IMPUTE[c.k];
        parts[c.k] = IMPUTE[c.k] * c.w;
        imputed.push(c.k);
        confSum += CONF.low; confN++;      // a floored value is the weakest evidence there is
      } else {
        parts[c.k] = null;
      }
      continue;
    }
    avail += c.w;
    observed += c.w;
    earned += c.w * c.v;
    parts[c.k] = +(c.w * c.v).toFixed(1);
    confSum += (CONF[c.conf] || CONF.low);
    confN++;
    /* evidence share: a component only counts as evidenced if its genes carry a src.
     * Without this, a bare-number coin (no evidence trail) outranks a fully sourced one. */
    var ks = EV_KEYS[c.k] || [], allSrc = true;
    for (var j = 0; j < ks.length; j++) {
      if (gval(d, ks[j]) != null && !gsrc(d, ks[j])) { allSrc = false; break; }
    }
    if (allSrc) evid += c.w;
  }
  parts.brk = -(W.brkPenalty * brk);
  if (observed === 0 || avail === 0) return null;   // nothing observed — no basis to score

  /* coverage/evCoverage describe OBSERVED data only, so a floored component still shows up as
   * missing (wide band, `insufficient`) while never dropping out of the score denominator. */
  var coverage = observed / total;
  var evCoverage = evid / total;
  var avgConf = confN ? confSum / confN : CONF.low;
  var P = Math.max(0, Math.min(100, Math.round((earned / avail) * 100 - W.brkPenalty * brk)));
  /* band: evidence weakness + missing weight, capped so it stays usable for decisions */
  var band = Math.min(25, Math.round((1 - avgConf) * 15 + (1 - coverage) * 40));

  return {
    P: P, band: band, coverage: +coverage.toFixed(2), evCoverage: +evCoverage.toFixed(2),
    conf: +avgConf.toFixed(2),
    insufficient: coverage < 0.8 || evCoverage < 0.8,
    missing: comps.filter(function (c) { return c.v == null; }).map(function (c) { return c.k; }),
    imputed: imputed, parts: parts, version: SCORING_VERSION,
    v1: scoreV1(d)
  };
}

/* composite presets (§4.1) — defaults, meant to be tuned in the Weight Lab */
var PRESETS = {
  purist: { P: 45, S: 20, D: 15, T: 5, L: 0, R: 5, U: 10 },
  investor: { P: 15, S: 15, D: 15, T: 20, L: 20, R: 10, U: 5 },
  builder: { P: 20, S: 15, D: 35, T: 5, L: 5, R: 5, U: 15 },
  survivor: { P: 20, S: 15, D: 10, T: 5, L: 15, R: 30, U: 5 }
};

function composite(pillars, w) {
  var keys = ['P', 'S', 'D', 'T', 'L', 'R', 'U'];
  var num = 0, den = 0;
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i], ww = (w && w[k] != null) ? w[k] : 0, v = pillars[k];
    if (ww > 0 && v != null) { num += ww * v; den += ww; }
  }
  return den ? Math.round(num / den) : null;
}

/* rank stability under jittered weights (§4.3) */
function rankStability(rows, keyFn, runs, jitter) {
  runs = runs || 300; jitter = jitter || 0.2;
  var tally = {};
  for (var i = 0; i < rows.length; i++) tally[rows[i].s] = {};
  for (var r = 0; r < runs; r++) {
    var jf = 1 + (Math.random() * 2 - 1) * jitter;
    var sorted = rows.slice().sort(function (a, b) { return keyFn(b, jf) - keyFn(a, jf); });
    for (var j = 0; j < sorted.length; j++) {
      var t = tally[sorted[j].s];
      t[j + 1] = (t[j + 1] || 0) + 1;
    }
  }
  var out = {};
  for (var s in tally) {
    var best = 0, bestN = 0;
    for (var k in tally[s]) if (tally[s][k] > bestN) { bestN = tally[s][k]; best = +k; }
    out[s] = { mode: best, share: +(bestN / runs).toFixed(2) };
  }
  return out;
}
