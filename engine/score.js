/* engine/score.js — DNA v2 scorer (v3 blueprint §3.1, §4)
 * Single source of truth for the P (Privacy Strength) pillar.
 * Loaded by build (Node) and by the browser — never re-implement the formula in Python.
 * scoring_version: v2 (v1 score is still returned alongside so old snapshots stay comparable)
 */
var SCORING_VERSION = 'dna-v2';

var W = { cov: 30, bits: 15, man: 12, tl: 12, hmeta: 10, hnet: 8, mat: 8, pq: 5, brkPenalty: 15 };
var CONF = { high: 1.0, med: 0.6, low: 0.3 };

/* gene value may be a plain number (v1) or {v, conf, src, asof, note} (v2) */
function gval(g, key, dflt) {
  if (!g) return dflt;
  var x = g[key];
  if (x == null) return dflt;
  if (typeof x === 'object') return (x.v == null ? dflt : x.v);
  return x;
}
function gconf(g, key) {
  if (!g) return 'low';
  var x = g[key];
  if (x && typeof x === 'object') return x.conf || (x.src ? 'med' : 'low');
  return 'low'; // v1 bare numbers carry no evidence trail
}
function gsrc(g, key) {
  if (!g) return '';
  var x = g[key];
  return (x && typeof x === 'object' && x.src) ? x.src : '';
}

/* v1 score — kept for continuity with everything published before v3 */
function scoreV1(d) {
  if (!d || gval(d, 'hs', null) == null) return null;
  var denom = 8 - (gval(d, 'nst', 0) ? 2 : 0);
  var cov = Math.min((gval(d, 'hs', 0) + gval(d, 'hr', 0) + gval(d, 'ha', 0) + gval(d, 'hst', 0)) / denom, 1);
  return Math.round(cov * 60 + (gval(d, 'man', 0) ? 15 : 0) + (gval(d, 'tl', 0) ? 15 : 0) + (gval(d, 'big', 0) ? 10 : 0));
}

/* v2 — 12 genes, anonymity set measured in bits, evidence confidence carried through */
function scoreP(d) {
  if (!d) return null;
  var nst = gval(d, 'nst', 0) ? 1 : 0;
  var denom = 8 - 2 * nst;
  var cov = Math.min((gval(d, 'hs', 0) + gval(d, 'hr', 0) + gval(d, 'ha', 0) + gval(d, 'hst', 0)) / denom, 1);

  var aset = gval(d, 'aset', 0) || 0;
  var bits = aset > 1 ? Math.min(Math.log(aset) / Math.LN2 / 20, 1) : 0;   // 2^20 effective set == full credit

  var man = gval(d, 'man', 0);      // 0 opt-in / 0.5 default-on / 1 mandatory
  var tl = gval(d, 'tl', 0);        // 0 centralized .. 2 fully trustless
  var hmeta = gval(d, 'hmeta', 0);  // 0..2 metadata resistance
  var hnet = gval(d, 'hnet', 0);    // 0..2 network-layer privacy
  var mat = gval(d, 'mat', 0);      // 0..2 maturity
  var pq = gval(d, 'pq', 0);        // 0..2 post-quantum readiness
  var brk = gval(d, 'brk', 0) ? 1 : 0;

  var raw = W.cov * cov + W.bits * bits + W.man * man + W.tl * (tl / 2) +
            W.hmeta * (hmeta / 2) + W.hnet * (hnet / 2) + W.mat * (mat / 2) + W.pq * (pq / 2) -
            W.brkPenalty * brk;
  var P = Math.max(0, Math.min(100, Math.round(raw)));

  /* confidence band: sum of weight × spread × (1 − conf) over the genes that feed the score */
  var spreads = { cov: 1, bits: 1, man: 1, tl: 1, hmeta: 1, hnet: 1, mat: 1, pq: 1 };
  var keys = ['hs', 'hr', 'ha', 'hst', 'aset', 'man', 'tl', 'hmeta', 'hnet', 'mat', 'pq', 'brk'];
  var confs = keys.map(function (k) { return CONF[gconf(d, k)] || CONF.low; });
  var avgConf = confs.reduce(function (a, b) { return a + b; }, 0) / confs.length;
  var band = Math.round((1 - avgConf) * 25);
  var missingSrc = keys.filter(function (k) { return gval(d, k, null) != null && !gsrc(d, k); }).length;

  return {
    P: P, band: band, conf: avgConf.toFixed(2), missing_src: missingSrc,
    parts: {
      cov: +(W.cov * cov).toFixed(1), bits: +(W.bits * bits).toFixed(1), man: +(W.man * man).toFixed(1),
      tl: +(W.tl * tl / 2).toFixed(1), hmeta: +(W.hmeta * hmeta / 2).toFixed(1), hnet: +(W.hnet * hnet / 2).toFixed(1),
      mat: +(W.mat * mat / 2).toFixed(1), pq: +(W.pq * pq / 2).toFixed(1), brk: -(W.brkPenalty * brk)
    },
    version: SCORING_VERSION
  };
}

/* composite presets (§4.1) — weights are defaults, meant to be tuned in the Weight Lab */
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
    var k = keys[i], ww = (w && w[k] != null) ? w[k] : 0;
    var v = pillars[k];
    if (ww > 0 && v != null) { num += ww * v; den += ww; }
  }
  return den ? Math.round(num / den) : null;
}

/* rank stability under ±jitter weights (§4.3) */
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
