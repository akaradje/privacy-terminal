# Changelog

All notable changes to the scoring engine and data contract.
`scoring_version` is written into every build (`STATS.scoring_version`) — the formula lives only in `engine/score.js`.

## 2.4.0-preview — 2026-10-16

Closes the P core: the `hst` definition now covers off-chain private computation, `hnet`/`hmeta`
have protocol-feature criteria instead of vibes, and the band has a floor.

**`hst` extended.** Was "hides smart-contract state". Now also counts **off-chain / client-side
private computation and zkTLS attestation** — a protocol that processes sensitive data off-chain
and puts only a proof on-chain is protecting private state, just not on L1. This is the correct
home for zkPass (ZKP) rather than a 13th gene: `hst 0 → 2`, `nst 1 → 0` (there *is* state being
protected), `man 0 → 1` (no transparent mode for the attested data), `tl 1 → 1.5` (3P-TLS needs a
proxy in the TLS session → threshold), `mat 0 → 1`. ZKP 6 → 38, landing beside the other compute
assets instead of at the bottom of the table.

**`hnet`/`hmeta` re-valued from protocol features.** Both genes now have explicit 0/1/2 criteria
(readable off a node/client/protocol document). All 51 assets were re-read against them:
confidence moved from **low 100/102 → high 9 / med 25 / low 68**. `conf` is raised only where a
project document states the feature; where it is *inherited from a fork* (BDX/ZEPH from Monero's
Dandelion++, MWC/EPIC/XTM from Grin's cut-through) it stays low on purpose.

**Band floored at ±2.** XMR scored `±0`, i.e. "no uncertainty whatsoever" — not a claim this model
can make. Known weakness left in place: `avgConf` averages, so one contested value among eight
barely moves the band; a worst-case term is the fix and is flagged, not applied.

**Consequence to review:** the MimbleWimble family now leads at 80 (GRIN/BEAM/XTM/EPIC/MWC) with
XMR at 78. That follows directly from the approved `hmeta` criterion ("cut-through + kernel
aggregation" = 2 while XMR's RingCT exposes input/output counts = 1), and from XMR spending its
proven 3/15 on `bits` where the MW coins are floored at 0. It is the criteria working as written,
not a weight change — but it is a visible reordering and is flagged for confirmation.

## 2.3.2-preview — 2026-10-16

Extends the 2.3.1 floor to every component, making P strictly monotonic.

**Change.** `IMPUTE = {bits: 0}` becomes a single `FLOOR = 0` applied to *any* component with no
value. The weight always stays in the denominator, so the score no longer stretches when data is
absent. The only remaining denominator reduction is structural non-applicability decided by the
architecture, not by the data (`nst = 1` removes `hst` from the coverage denominator).

**Why.** 2.3.1 fixed `aset` but left the general case open: deleting a weak value still raised the
score. Measured before the change — `{hs:2,hr:2,ha:2,nst:1,man:1,tl:0,hmeta:0,hnet:0,mat:2,pq:0}`
scored 50, and the same record with `tl` deleted scored 57. A reviewer who discovers that a coin's
trust assumption is bad would have been rewarded for not writing it down.

**Verification.** 510 deletion cases across all 51 assets, 0 monotonicity violations. The
leaderboard is unchanged for every currently-filled asset (none of them had a non-`aset` gap), so
XMR stays rank 1 at 78 ±1 and the rankable set stays at 28.

**Not a contradiction of "unknown is not zero".** That principle is preserved one layer up: the
value stays null in the data, appears in `missing` and `imputed`, lowers `coverage`, widens `band`
and trips `insufficient`. A sourced `tl: 0` and an unknown `tl` remain distinguishable to the
reader (narrow vs wide band) — they are identical only in the ranking number, which by definition
reports the proven lower bound.

## 2.3.1-preview — 2026-10-16

Closes the null-rescale loophole that the batch-1 leaderboard exposed.

**Problem.** A missing component was dropped from the denominator and the rest rescaled to 100.
That assumes the missing value equals the average of the others. For `bits` the assumption is
systematically wrong for ring families (ring 16 scores 3/15, well below average), so a coin with
no anonymity-set evidence collected full credit for the 15% it never proved: ALEO 89 / OCT 89
(no evidence at all) and BDX/ZANO/GRIN/BEAM 84 all sat above XMR 78, which had proven its set.

**Fix — conservative baseline imputation.** `IMPUTE = { bits: 0 }`. When `aset` is null the 15%
weight stays in the denominator and scores 0. Imputed components are listed in `imputed`, remain
in `missing`, and still widen `band` / lower `coverage` — the uncertainty does not disappear, it
just stops paying. Scoring stays `earned / total`, so the scale no longer stretches.

**Effect on the batch-1 set** (all had `aset = null`): BDX/ZANO/GRIN/BEAM/DERO/XTM 84 → 71,
ABEL 85 → 72, ZEPH/EPIC/MWC 79 → 67, XEL 74 → 63. XMR unchanged at 78 and is now rank 1 of 17
on proven evidence (100% coverage, band ±1). The pilot five also lose the same 8 points for the
same reason (ZEC 44, NYM 44, MPC 41, SCRT 38, AZTEC 36); their relative order is unchanged.

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
