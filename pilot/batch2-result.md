# Batch 2 — result: Zcash forks, masternode CoinJoin & legacy privacy coins

**asof:** 2026-10-16 · **scoring:** `2.3.1-preview` · **assets:** 11 · **engine:** `engine/score.js`
**Rule applied:** every value carries `src` + `asof`; a value that cannot be sourced is `null` with a
note (never guessed as 0); `conf=low` marks an inference that still needs verification.

---

## 1. Gene table (values only; `src` per value lives in `data/dna3.json`)

| Coin | arch | hs | hr | ha | hst | nst | man | tl | hmeta | hnet | mat | pq | brk | P | band |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **NAV** (Navio) | value-transfer | 2 | 2 | 2 | 0 | 1 | 1 | 2 | 1 | 0 | 2 | 0 | 0 | **67** | ±13 |
| **ARRR** (Pirate) | value-transfer | 2 | 2 | 2 | 0 | 1 | 1 | 1 | 1 | 0 | 2 | 0 | 0 | **61** | ±13 |
| **FIRO** (Firo) | value-transfer | 1 | 1 | 1 | 0 | 1 | 0 | 2 | 1 | 0 | 2 | 0 | 0 | **40** | ±13 |
| **PART** (Particl) | value-transfer | 1 | 1 | 1 | 0 | 1 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | **35** | ±13 |
| **ZCL** (Zclassic) | value-transfer | 1 | 1 | 1 | 0 | 1 | 0 | 1 | 1 | 0 | 2 | 0 | 0 | **34** | ±13 |
| **PIVX** | value-transfer | 1 | 1 | 1 | 0 | 1 | 0 | 1 | 1 | 0 | 2 | 0 | 0 | **34** | ±13 |
| **YEC** (Ycash) | value-transfer | 1 | 1 | 1 | 0 | 1 | 0 | 1 | 1 | 0 | 2 | 0 | 0 | **34** | ±13 |
| **VRSC** (Verus) | value-transfer | 1 | 1 | 1 | 0 | 0 | 0 | 1 | 1 | 0 | 2 | 0 | 0 | **30** | ±13 |
| **DCR** (Decred) | value-transfer | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 2 | 0 | 0 | **26** | ±13 |
| **DASH** | value-transfer | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | **13** | ±13 |
| **XVG** (Verge) | value-transfer | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 2 | 0 | 0 | **12** | ±13 |

`aset` is `null` for all 11 (tier-1/tier-2 measurement unavailable — see §4) and is floored at 0 with
the weight retained, per engine 2.3.1.

---

## 2. Sources used (one per value; the full list is in `data/dna3.json`)

| Coin | Primary src |
|---|---|
| NAV | `https://navcoin.org/` — "Confidential by default. Powered by BLSCT and Proof-of-Private-Stake" · `github.com/nav-io/libblsct` |
| ARRR | `https://piratechain.com/` — 100% shielded peer-to-peer transfers, zk-SNARKs |
| FIRO | `https://firo.org/2022/05/10/introducing-lelantus-spark.html` — "hides the sender, receiver, transaction amount"; project calls the protocol trustless |
| DASH | `https://docs.dash.org/en/stable/docs/user/private-send.html` — PrivateSend (masternode CoinJoin, optional) |
| PIVX | `https://pivx.org/shield` — SHIELD "based on zk-SNARKs Sapling" |
| ZCL | `https://zclassic.org/` — states it uses the same parameters produced in the Zcash trusted-setup ceremony |
| YEC | `https://y.cash/` — Zcash-derived, opt-in shielded |
| VRSC | `https://verus.io/` — "brings Sapling performance and zero knowledge features" |
| DCR | `https://docs.decred.org/privacy/` — CoinShuffle++ opt-in mixing |
| PART | `github.com/particl/particl-core` — "Privacy Protocols: Confidential Transactions (CT) and RingCT" |
| XVG | `https://vergecurrency.com/` — Tor/I2P only; ledger transparent |

---

## 3. Findings

**1. The `arch` rule generalised cleanly.** XVG is `value-transfer` but its ledger is fully
transparent, so `hs/hr/ha = 0` — the non-value-transfer rule turns out to be a special case of a
more general statement: *a privacy score must be assessed on the layer the token's transfers
actually live on*. XVG lands at **12**, the lowest of the 28 rankable assets, which is the intended
effect.

**2. `tl` separates the Zcash forks on a real technical fact, not on a weight nudge.**
ZEC currently uses Orchard/Halo 2 → no trusted setup → `tl = 2`. The Sapling-era forks (ARRR, YEC,
ZCL, PIVX, VRSC) still depend on the Sapling trusted-setup ceremony → `tl = 1`. That single gene is
worth 6 points and it is the reason ARRR (61) sits well below what a "100% shielded" headline would
suggest: mandatory shielding is real, but the setup assumption is not free.

**3. Two coins score high purely on mechanism — and that is what P is for.**
NAV (67) and ARRR (61) are `man=1` + full coverage. NAV is a very small project. P measures the
*mechanism*, not the project; the risk/scale judgement belongs to the other pillars (S, D, T, L, R, U)
which are not built yet. Reading a high P as a buy signal would be a category error — the UI keeps
the v2 PREVIEW label for exactly this reason.

**4. Dash's PrivateSend is weak on the two components people assume it covers.** It hides the
sender only partially (`hs=1`, masternode-coordinated, `tl=0`) and hides neither the receiver
(`hr=0` — the payment output is a normal transparent address) nor the amount (`ha=0` — fixed
denominations make the total reconstructible). 13/100 is the honest reading.

**5. VRSC and DCR lose points for having a *public* state layer.** `nst=0` keeps `hst` in the
denominator, and their state (VerusID/PBaaS, Decred treasury/tickets) is transparent → `hst=0`.
This is the correct behaviour: a chain with an unshielded execution layer is not penalised for
"not having state", it is penalised for exposing it.

**6. All 11 land in one `arch` group**, so no cross-group comparison was introduced. The
`value-transfer` leaderboard is now: XMR 78 > ABEL 72 > BDX/ZANO/GRIN/BEAM/DERO/XTM 71 >
ZEPH/EPIC/MWC 67 = NAV 67 > XEL 63 > ARRR 61 > ZEC 44 > …

---

## 4. Values that could not be sourced (left `null`, never 0)

`aset` for **all 11 coins** — tier 2 requires a live pool/note/UTXO count at `asof`, and no public
key-free endpoint exposes one (23 endpoints probed across two rounds; see
`pilot/aset-probes.md` and `pilot/aset-probes-round2.md`). Each coin carries an `aset_note` naming
the exact measurement that is missing.

Values carrying `conf=low` (recorded, but flagged as needing verification): `hmeta`/`hnet` for all
11, `tl` for NAV (`libblsct` trusted-setup status) and DCR (mixnet-server role), `man` for PART
(default mode), `brk` for all (advisory sweep not yet complete).

---

## 5. Coverage

| | before batch 1 | after batch 1 | after batch 2 |
|---|---|---|---|
| gene values carrying `src` | 21% | 51% | **72%** |
| assets rankable under v2 | 6 | 17 | **28** |
| assets still without an evidence trail | 45 | 34 | **23** |

The 23 remaining are Batch 3 (ZK L1/L2 + mixers/shielded smart contracts) and Batch 4
(DePIN/transport/FHE-TEE compute).

---

## 6. Open item for the maintainer (found while testing this batch)

The engine floors a missing `aset` (weight retained, value 0) but still *rescales* for any other
missing component. That leaves a smaller version of the same perverse incentive:

```
{hs:2,hr:2,ha:2,nst:1,man:1,tl:0,hmeta:0,hnet:0,mat:2,pq:0}   → P = 50
same record with tl deleted                                    → P = 57
```

i.e. **omitting a bad value scores higher than reporting it.** Batch 2 avoids the trap by never
leaving a component `null` when a defensible value exists (every coin above has `tl` filled), but
the general fix is to floor *every* missing component at 0 and carry the uncertainty only in
`coverage`/`band`/`insufficient`. That makes the score monotonic — adding evidence can never lower
it — and removes the incentive to omit. Not applied here because it changes the null-aware
semantics that were explicitly requested earlier; flagged for a decision.
