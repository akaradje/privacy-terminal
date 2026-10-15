# Changelog

All notable changes to the scoring engine and data contract.
`scoring_version` is written into every build (`STATS.scoring_version`) — the formula lives only in `engine/score.js`.

## 2.2.0-preview — 2026-10-16

Follow-up to the pilot gate failures. Rubric and engine versions are now kept in step.

**Changed**
- **`tl` gained a trust tier.** 1 = hardware enclave (TEE, vendor root of trust) or a large trusted-setup
  ceremony; **1.5 = threshold / MPC** (mathematical assumption + honest majority, no single hardware
  failure point); 2 = trustless. This breaks the SCRT/MPC tie on an explicit, sourced assumption instead
  of a weight nudge: SCRT 44 (TEE) < MPC 48 (threshold).
- **`arch` role enforced.** `value-transfer` | `transport` | `compute`. A token on a transparent host chain
  scores `hs/hr/ha = 0`; the privacy of its data packets is captured by `hmeta`/`hnet` instead. Leaderboards
  are separated by `arch`.
- **`aset` precedence + unverifiable cap.** Protocol-enforced per-tx value → live pool depth at `asof` →
  fallback to the lowest band. An `aset` with no `src` or `conf = low` has `bits` capped at the `< 1,000`
  band, so an unbacked claim cannot buy credit.

**Evidence**
- Two probe rounds, 23 endpoints, no public key-free endpoint exposing a per-epoch anonymity-set size for
  ZEC/NYM/SCRT/MPC/AZTEC. See `pilot/aset-probes.md` and `pilot/aset-probes-round2.md`. Tier-3 fallback is
  the correct branch; `aset_note` records what is missing.
- `rankStability()` on the 2.2 data: all six pilot coins stable (spread 0).

**Result on the pilot set**
XMR 78 ±1 > ZEC 52 ±8 > NYM 52 ±10 > MPC 48 ±14 > SCRT 44 ±11 > AZTEC 42 ±12 —
within `value-transfer`: XMR > ZEC > AZTEC, matching the pre-registered expectation.

## 2.0.0-preview — 2026-10-15

DNA v2 engine + red-flag engine, added on top of the published v1 scoring.

**Added**
- `engine/score.js`: 12-gene DNA v2 (adds `hmeta`, `hnet`, `mat`, `pq`, `aset`; `man` accepts 0.5 = default-on; `tl` is 0–2), anonymity set measured in bits (`log₂(aset) / 20`), evidence confidence band, four weighting presets, `rankStability()`.
- `engine/flags.js`: 14 red-flag rules (CRITICAL/HIGH/MED/LOW) + `metricsFor()`.
- `data/schema/curated.schema.json`: gene values may be bare numbers (legacy) or `{v, conf, src, asof, note}`.
- `scripts/snapshot_history.py`: daily `history/YYYY-MM-DD.json.gz` snapshot (scores + prices) so rankings can be compared over time.
- `CHANGELOG.md` (this file).

**Fixed (review of the first v2 draft)**
- **Missing data is no longer zero.** A gene with no value is `null`; the score is computed over the available weight and rescaled to 100. `coverage` and `insufficient` are reported, and v2 is labelled **PREVIEW** in the UI until coverage passes 80%. v1 remains the score the UI ranks on.
- **`aset` now has one definition for every mechanism family** (effective per-transaction anonymity set), documented in `engine/score.js` and the schema. Ring-based coins legitimately score low on this one component and recover the difference through `man`.
- **Band capped at ±25** and scaled by evidence quality plus missing weight (it used to reach 48, which made it useless for decisions).
- **`brk` verified as a −15 penalty, not a reset**: XMR-like 79 → 64.
- **DERO repo false positive:** CoinGecko pointed at `deroproject/derosuite` (archived 2022), which triggered CRITICAL `dead_repo`. `REPO_OVERRIDE` in `data/enrich_gh.py` now pins the maintained repo `deroproject/derohe` (last push 2026-08-21).

**Changed**
- `validate.py` no longer errors on a missing `src` (it warns and treats the value as `conf = low`, per the blueprint) and now also counts bare-number genes, reporting evidence coverage as a percentage.
- `validate.py` never re-implements the formula: it shells out to `node engine/score.js`.

**Known gaps**
- Evidence coverage is 0%: all 330 gene values are still bare numbers. Phase 2 fills them with `src` + `asof`.
- Pillars S/D/T/L/R/U are not implemented yet (only P).
- `history/` starts empty — the first snapshot lands with the next scheduled refresh.
