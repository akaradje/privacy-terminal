# Changelog

All notable changes to the scoring engine and data contract.
`scoring_version` is written into every build (`STATS.scoring_version`) — the formula lives only in `engine/score.js`.

## 2.8.0-preview — 2026-10-16

Bull-Run Asymmetry & "Next Zcash" Scanner (`asymmetryOf()`, `bull_hunter` preset, venue breadth in Pillar R, 5 new bull-run positive rules, and 5 verified data gap closures).

**1. Bull-Run Asymmetry Model (`asymmetryOf()` in `engine/score.js`) & `bull_hunter` preset.**
- Solves the lagging-indicator bias where Pillar L rewards coins *after* they reach $1B+ market cap.
- `asymmetryOf(d, coin, det, asof)` scores 4 dimensions of a Zcash-style re-rating ($700M → $25.95B):
  **50% Fundamental Quality** (`P_adj 35, D 25, R 20, S 10, T 10`, with a 0.6× penalty if `D=0`) +
  **20% Valuation Upside Room** (sweet spot $5M–$150M = 100, $150M–$800M = 95→80, gated by `min(1, P_adj/45)` so weak-privacy coins cannot score high on small cap alone) +
  **15% Clean Tokenomics** (`(cs/ms)^0.85` to penalize heavy VC unlock overhang) +
  **15% Market Access Rails** (`comp=2` selective disclosure/viewing keys + exchange count `ex_count` + daily turnover).
- Added preset `bull_hunter: {P:25, D:20, L:15, T:10, S:10, R:20}` (risk-adjusted).

**2. Venue Breadth integrated into Pillar R (`regulatoryScore(d, det)`).**
- When dossier `ex_count` is available, Pillar R blends **45% censorship resistance (`tl`) + 40% compliance capability (`comp`) + 15% exchange breadth (`min(ex_count/12, 1)`)**; falls back to 55/45 when `det` is omitted so standalone DNA monotonicity tests remain invariant.

**3. Bull-Run Alpha Signals & `brk=0.5` fix in `engine/flags.js`.**
- Fixed a bug in `metricsFor()` where `brk ? 1 : 0` coerced `brk=0.5` (patched historical bug in XMR/ZEC/SCRT) to `1`, falsely triggering CRITICAL `unpatched_break`.
- Added 5 bull-run opportunity rules to `POSITIVE_RULES`: `zec_archetype`, `asymmetric_gem`, `sovereign_scarcity`, `early_accumulation`, `multi_venue_rail`.

**4. Five data gaps closed with HTTP-200 primary sources.**
- **FIRO `comp=2` (high):** IACR ePrint `https://eprint.iacr.org/2021/1173` (Lelantus Spark) confirms opt-in incoming/full viewing keys without delegating spend authority (FIRO composite 65 → 74, Bull Asymmetry #1 at 82).
- **ZAMA `comp=2` (high):** `https://github.com/zama-ai/fhevm` README confirms programmable smart-contract access control logic + threshold KMS decryption.
- **ROSE `comp=2` (med):** `https://docs.oasis.io/build/sapphire/develop/concept` confirms View-Call Authentication and selective event disclosure.
- **DUSK & P2P active repo overrides in `data/curated/repos.json`:** `dusk-network/rusk` (pushed 2026-08-16, 208★) and `sentinel-official/sentinel-dvpnx` (pushed 2026-10-13, 138★) replace archived legacy repos, clearing both false-positive `dead_repo` warnings.

**5. UI upgraded with `⚡ Bull-Run Radar` view, sortable `Score` & `Bull Upside` columns, and Preset/Bull Filter selectors.**

## 2.7.0-preview — 2026-10-16

Three cleanups that close the last logical leaks in Pillar R / S and make the history snapshot usable.

**1. `comp` no longer grants a free 50%.** The old `comp=1` meant "not evidenced" and scored 50 in
Pillar R — so a coin with *no* compliance evidence outscored a coin proven to have *none* (`comp=0` →
0). Re-defined: `2` = documented selective disclosure / viewing keys / proof of innocence · `1` = basic
or partial (XMR native view key, CryptoNote, IP-only privacy) · `0` = no privacy to disclose and no
tooling · `null` = not evidenced. The engine now floors `comp=null` to **0 with its 0.45 weight
retained** (not dropped). Monotonicity holds: `R(comp=0)=55` equals `R(comp=null)=55`, so an unknown
can never outrank a known absence.

**2. S citations filled for XMR / FIRO / RAIL / AZTEC (all `src` HTTP-probed before acceptance).**
- XMR `brk=0.5` (HIGH) — getmonero.org 2017 disclosure, HTTP 200, content confirms "key image" /
  "double-spend"; `audit=1` (med) from monero-project/research-lab vulnerability-response process
  (not a named firm); `comp=1` (native view key).
- FIRO `tl=2` (med) from the repo README, HTTP 200; `brk=0`, `audit=1`; `comp=null` — the supplied
  2019 post-mortem URLs were all 404, recorded as dead, never encoded.
- RAIL `comp=2` (med, railgun.org); `audit=0`, `brk=0`.
- AZTEC `comp=2` (med, docs.aztec.network); `audit=1` (med) — SECURITY.md says "under internal and
  external review" + Cantina bounty, no published Tier-1 audit, so `1` not `2`; `brk=null` stays a
  named gap (V5 patch status unconfirmed). Dead links supplied (firo.org post-mortem, Railgun-Community
  contract, railgun.org/audits SPA) were recorded, not scored.

**3. `snapshot_history.py` now records all six pillars + composite.** Calls `pillarsOf()` /
`compositeOf()` from the engine per asset, emits `pillars:{P,D,L,T,S,R,composite}`, adds an `_asof()`
helper so pillar D is diffable day-over-day, and fixed two bugs (a self-recursive `_asof()` that caused
`RecursionError`, and an invalid `\.` escape). Output: `history/2026-10-16.json.gz` — 51 assets,
`scoring_version: 2.7.0-preview`.

Validation: **0 errors, 16 named warnings** (12 `comp=null` gaps, AZTEC `brk=null`, DUSK/P2P archived
repos, MWC imputed market cap). Composite leaderboard (`privacy_investor`, risk-adjusted): XMR 81 ›
BDX 78 › GRIN 77 › ZANO 74 › BEAM 73 › EPIC 72 › ARRR 70 › ZEC 68 › XTM 67 › AZTEC 66 › FIRO 65 › PIVX 64.

## 2.6.0-preview — 2026-10-16

Three things: T and S stop double-counting, `brk` becomes a real history, and pillar R exists.

**1. T and S de-duplicated.** T was mixing age, `mat` (age + audits) and an audit flag. It is now
**70% mainnet age + 30% dev continuity** and nothing else — audit is S's job. S moved from a binary
"has an audit" to **40% audit quality (0/1/2) + 35% exploit history + 25% the primitive's trust
assumption**. Audit 0 means "no record found in our sources", stated in every note and not the same
as "never audited".

**2. `brk` is ternary, and only the unpatched case costs P.** 0 = none found · 0.5 = a
protocol/enclave-level break that was **patched or replaced** · 1 = unpatched. P charges only 1:
charging a patched history would punish XMR for a bug it fixed while GRIN — which has the
stem-phase leak Bogatyy measured — pays nothing. The 0.5 value is recorded with a real citation and
scores 55 in S instead of 0, because a coin that has been broken and fixed is more fragile than one
never attacked, but it is not currently broken. Only two coins could be sourced this round (ZEC,
SCRT); XMR/FIRO/GRIN/BEAM stayed at 0 with the missing citation named, because an unsourced 0.5 is
exactly the fabrication the data contract forbids. AZTEC stays null — the V5 patch status is
unconfirmed.

**3. Pillar R.** 55% censorship resistance (from `tl`) + 45% compliance capability (a new graded
`comp` field: viewing keys / selective disclosure / proof of innocence), with a **cap at 25 for a
directly sanctioned protocol**. Tornado Cash: designated by OFAC 2022-08-08, re-designated
2022-11-18, overturned by W.D. Texas 2025-01 — the cap reflects that the practical damage
(frontends, listings) outlived the ruling. `privacy_investor` is now
**{P 30, D 20, L 15, T 15, S 10, R 10}**.
*Not included for lack of a source:* venue breadth / DEX-vs-CEX liquidity. Exchange ticker data is
not collected, so that component's weight is left unassigned rather than guessed.

**4. Compare view (radar + gene table).** Select 2–4 coins with the ⇄ button; the radar shows the
profile shape over P/D/L/T/S/R and the table underneath is the evidence for every axis, with a
confidence dot per cell (none = high, · = med, ·· = low).

**5. A third stale repo, found by pillar D.** `AztecProtocol/aztec` is **archived** (GitHub
confirms `archived: true`, last push 2022-12-13); development continued at
`AztecProtocol/aztec-packages` (2026-10-15). D 0 → 100, with a curated override recording why.

**Composite top 12:** XMR 83 > BDX 78 > GRIN 77 > ZANO 74 > BEAM 73 > EPIC 72 > ARRR 70 > ZEC 68 >
FIRO 67 > XTM 67 > AZTEC 66 > PIVX 64. Tornado Cash #45, ZAMA #18.

## 2.5.0-preview — 2026-10-16

Three corrections from review: the MimbleWimble `hmeta` over-credit, the MWC market cap, and the
pillars that let a wide-band coin climb on momentum.

**1. MimbleWimble `hmeta` 2 → 1.** Cut-through hides the graph *after* a block closes, but the
mempool/stem phase still leaks: Ivan Bogatyy (Dragonfly Research, Nov 2019), *"Breaking
MimbleWimble's Privacy Model"*, traced ~96% of Grin transactions in real time (~$60/week of AWS) by
sniffing the stem phase before blocks closed, and interactive slate exchange adds connection
metadata on top. Vitalik Buterin's response to it — a medium anonymity set *is* a small anonymity
set — is the argument for capping this family at the same level as RingCT. The criterion now states
the cap explicitly. Effect: GRIN/BEAM/MWC/EPIC/XTM 80 → **75**, and **XMR is back at rank 1 (78)**
of both P and the composite, on technical grounds rather than a weight change.

**2. Market-cap imputation in `build.py`.** MWC reports `market_cap: 0` **and**
`circulating_supply: 0` while carrying a live price ($11.84) and volume, so the plain
`price × supply` fallback could not fire. The fallback now tries `price × circulating_supply`
first, then `price × (FDV / price)` — the supply figure CoinGecko itself used — guarded so the
implied supply must be positive and no larger than max supply. MWC → **$130.4M**, implying 11.015M
coins, which matches the known circulating supply (~10.9–11M). The record carries `mi: 1`, a new
`mcap_imputed` LOW flag exists, and the panel says the number was derived.

**3. Pillars T and S, and a risk-adjusted composite.**
- **T** (tech/network maturity) = 45% mainnet age + 35% the `mat` gene + 20% an audit record, hard
  capped at **40** when the mainnet is under a year old.
- **S** (security/audit posture) = 50% "no unpatched break" + 50% "has an audit record"; **null**
  when `brk` is unknown — the security posture of a coin whose exploit history has not been
  checked cannot be scored.
- `privacy_investor` extended from `{P 45, D 30, L 25}` to **`{P 35, D 20, L 15, T 15, S 15}`** and
  is now **risk-adjusted**: the P point estimate is replaced by its lower half (`P − band/2`), the
  way an institutional reader treats a wide estimate.

**Effect on the ZAMA case:** #10 → **#27**. P 30 with band ±17 becomes 22, T is 9 (2026 mainnet →
the <1yr cap), S is 50 (no audit record). Dev 100 and liquidity 91 can no longer carry it alone.

**Final composite (risk-adjusted, top 12):** XMR 86 > GRIN 74 > BDX 72 > EPIC 69 = BEAM 69 >
ZEC 68 = ZANO 68 = FIRO 68 > ARRR 65 = XTM 65 > SCRT 62 > MWC 61.

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
