# Batch 3 & 4 — result: ZK L1/L2 + mixers, DePIN/transport, FHE-TEE compute

**asof:** 2026-10-16 · **scoring:** `2.3.2-preview` · **assets:** 23 (14 + 9) · **engine:** `engine/score.js`
**Rule applied:** every value carries `src` + `asof`; a value that cannot be sourced is left as a bare
legacy number or `null` with a note — never invented. `conf=low` marks an inference that still needs
verification; it widens the band rather than hiding the uncertainty.

With this batch the dataset is **complete: 51/51 assets carry an evidence trail**, and
`validate.py` reports **0 errors / 0 warnings**.

---

## 1. Batch 3 — ZK L1/L2, mixers & shielded smart contracts (14)

| Coin | arch | hs | hr | ha | hst | nst | man | tl | hmeta | hnet | mat | pq | P | band |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **IRON** (Iron Fish) | value-transfer | 2 | 2 | 2 | 0 | 1 | 1 | 1 | 1 | 0 | 1 | 0 | **57** | ±14 |
| **ALEO** | value-transfer | 2 | 2 | 2 | 2 | 0 | 1 | 1 | 1 | 0 | 1 | 0 | **57** | ±15 |
| **NIGHT** (Midnight) | value-transfer | 1 | 1 | 1 | 2 | 0 | 0 | 2 | 1 | 0 | 0 | 0 | **36** | ±17 |
| **XAN** (Anoma) | value-transfer | 1 | 1 | 1 | 2 | 0 | 0 | 2 | 1 | 0 | 0 | 0 | **36** | ±17 |
| **DUSK** | value-transfer | 1 | 1 | 1 | 2 | 0 | 0 | 1 | 1 | 0 | 1 | 0 | **34** | ±17 |
| **AZERO** (Aleph Zero) | value-transfer | 1 | 1 | 1 | 1 | 0 | 0 | 1.5 | 0 | 0 | 2 | 0 | **32** | ±17 |
| **RAIL** (Railgun) | value-transfer | 1 | 1 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 2 | 0 | **25** | ±15 |
| **CC** (Canton) | value-transfer | 1 | 1 | 1 | 2 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | **24** | ±16 |
| **TORN** (Tornado) | value-transfer | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 2 | 0 | **22** | ±15 |
| **DARK** (DarkSwap) | value-transfer | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **11** | ±17 |
| **UMBRA** | value-transfer | 0 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | **10** | ±16 |
| **ZKP** (zkPass) | compute | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | **6** | ±17 |
| **NOCK** (Nockchain) | value-transfer | 0 | 0 | 0 | 0 | 1 | 0 | — | 0 | 0 | 0 | 0 | *not rankable* | — |
| **ZER** (ZERO) | value-transfer | 1 | 1 | 1 | 0 | 1 | 0 | 1 | 1 | 0 | 2 | 0 | **34** | ±15 |

## 2. Batch 4 — DePIN / transport / FHE-TEE compute (9)

| Coin | arch | hs | hr | ha | hst | nst | man | tl | hmeta | hnet | mat | pq | P | band |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **HOPR** | transport | 0 | 0 | 0 | 0 | 1 | 1 | 1.5 | 2 | 2 | 2 | 0 | **47** | ±17 |
| **ANYONE** | transport | 0 | 0 | 0 | 0 | 1 | 1 | 1.5 | 2 | 2 | 1 | 0 | **43** | ±17 |
| **SESH** (Session) | transport | 0 | 0 | 0 | 0 | 1 | 1 | 1.5 | 2 | 2 | 1 | 0 | **43** | ±17 |
| **OCT** (Octra) | compute | 1 | 1 | 1 | 2 | 0 | 0 | 2 | 1 | 0 | 0 | 2 | **41** | ±17 |
| **MYST** (Mysterium) | transport | 0 | 0 | 0 | 0 | 1 | 0.5 | 0 | 1 | 2 | 2 | 0 | **27** | ±17 |
| **P2P** (Sentinel) | transport | 0 | 0 | 0 | 0 | 1 | 0.5 | 0 | 1 | 2 | 2 | 0 | **27** | ±17 |
| **ROSE** (Oasis) | compute | 0 | 0 | 0 | 2 | 0 | 0 | 1 | 1 | 0 | 2 | 0 | **27** | ±17 |
| **PHA** (Phala) | compute | 0 | 0 | 0 | 2 | 0 | 0 | 1 | 1 | 0 | 2 | 0 | **27** | ±17 |
| **ZAMA** | compute | 0 | 0 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | 0 | 2 | **25** | ±17 |

---

## 3. Corrections to earlier batches (found while filling these)

Both were values written **before the rule they violate existed** — the same failure mode as the
`aset` floor and the DERO repo: a mechanism scored one way early and another way later. They are
fixed rather than left, because two researchers reading the rubric must land on the same value.

| Correction | Before | After | Reason |
|---|---|---|---|
| `NYM.tl` | 1 | **1.5** | The rubric's `tl=1` bucket is "hardware enclave or a large trusted-setup ceremony". A mixnet has neither. Its security assumption is *"at least one honest node in the path"* — a threshold honest-majority assumption, which is exactly `tl=1.5`. Filling HOPR/ANYONE/SESH at 1.5 while NYM sat at 1 would have been a pure inter-rater inconsistency. |
| `SCRT.hs/hr/ha`, `MPC.hs/hr/ha` | 1,1,1 | **0,0,0** | These are `compute` chains: the contract state is hidden (`hst=2`) but the **native token transfers are public** — the sender address is visible on chain. `hs` is defined as "hides the sender", so 1 was wrong. Their privacy is contract-level, which `hst` already measures. Effect: SCRT 38 → 27, MPC 41 → 30. |

The rubric text is updated to match: the `tl=1.5` level now names mixnet/onion routing explicitly,
and the zeroing rule is restated by its rationale — *"hs/hr/ha = 0 when the asset's own transfers are
transparent"* — which covers transport networks and transparent-ledger value-transfer coins (XVG,
NOCK) rather than applying to an `arch` value mechanically.

---

## 4. Findings

**1. Iron Fish and Aleo tie at 57 — and they earn it differently.** IRON is mandatory-encrypted
UTXO with no state layer (`nst=1`, `hst` out of the denominator); ALEO hides private application
state (`hst=2`) but is a younger mainnet (`mat=1`). The `parts` breakdown separates them; the total
coinciding is a coincidence, not a duplicate.

**2. Iron Fish carries a research caveat that must be read before trusting its top-15 position.**
A 2025 IEEE paper — *"Trust Without Transparency: An Empirical Analysis of Anonymity and
Verifiability in Iron Fish"* — suggests the anonymity analysis is contested. `hs/hr/ha=2` is taken
from the project's own documentation (`conf=med`), not from that paper. Recorded in the note field.

**3. The transport family splits cleanly on `tl`, which is the honest result.** Mixnets and onion
routing (NYM/HOPR/SESH/ANYONE, `tl=1.5`) score 43–47; single-hop dVPNs (MYST/P2P) score 27 because
`tl=0` — the exit node sees the traffic, so the user must trust an operator. The rubric's trust
ladder, not a weight tweak, produces that 20-point gap.

**4. Four of the nine Batch-4 assets are `compute`, and they expose a limitation of the rubric.**
ZKP (zkPass) lands at **6**, the lowest in the dataset, because P measures the privacy of
*transfers and state* — zkPass's product is proving facts about Web2 data without revealing the data.
That is real privacy value the rubric cannot currently see. Recorded as a rubric gap rather than
patched with a fudge factor.

**5. Several Batch-3 coins sit on thin or unverifiable documentation, and the band says so.**
NIGHT (Midnight mainnet launch still under discussion), XAN, AZERO, DUSK and OCT carry `conf=low`
across most genes → bands of ±17. That is deliberate: `conf=low` widens the band instead of
pretending to a precision the sources do not support.

**6. A wrong dossier description was caught.** The CoinGecko description for `mysterium` describes
**"Mystery"**, an unrelated lottery token. The MYST row is sourced from Mysterium Network's own
documentation (WireGuard dVPN) instead, and the discrepancy is recorded in the note field.

---

## 5. Coverage — complete

| | before | after b1 | after b2 | after b3+b4 |
|---|---|---|---|---|
| gene values carrying `src` | 21% | 51% | 72% | **100%** |
| assets rankable under v2 | 6 | 17 | 28 | **50 / 51** |
| `validate.py` warnings | 1 | 1 | 1 | **0** |

`NOCK` is the single unrankable asset: `coverage` 73% (`tl` is `null` because ZKPoW is a consensus
mechanism, not a privacy mechanism, so there is no trust assumption to assess) → the `insufficient`
gate blocks it rather than reporting a fabricated 0.

---

## 6. Open items

1. **`hmeta`/`hnet` are the weakest genes in the dataset.** Nearly every value carries `conf=low`
   because it is inferred from architecture rather than from transaction-graph research. A
   dedicated pass (fee analysis, timing correlation, Dandelion presence per chain) would tighten
   most bands.
2. **`aset` is `null` for 47 of 51** — 23 endpoints probed across two rounds, no public key-free
   source. Tier-3 fallback is doing its job, but `bits` (weight 15) is unearned across the board.
3. **`mat` depends on audit counts that were not verified** for most projects. The audit criterion
   in the rubric is real, so several `mat` values may be overstated (all flagged `conf=low`).
4. **The rubric has no gene for "application-data privacy"** (finding 4 above) — protocols whose
   product is data minimisation rather than transfer privacy score near zero.
5. **Blind second pass still outstanding** — needs a second researcher; cannot be self-administered.
