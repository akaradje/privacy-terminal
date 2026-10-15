# Pilot round 2 — after rubric 2.1 (arch roles + aset precedence)

> **ตัวเลข NYM / SCRT / MPC ในเอกสารถูกแก้ภายหลัง** — ดู "Corrections" ใน
> [`pilot/batch3-4-result.md`](batch3-4-result.md): `NYM.tl` 1 → 1.5 (mixnet = threshold)
> และ `SCRT`/`MPC` `hs/hr/ha` 1 → 0 (การโอนโทเคน native โปร่งใส) → NYM 47, SCRT 27, MPC 30


Run: 2026-10-16 · rubric `2.1.0-preview` · supersedes §1–§4 of `pilot/result.md`

## What changed in rubric 2.1

1. **Non-value-transfer rule.** Every asset carries `arch` = `value-transfer` | `transport` | `compute`.
   A token that lives on a transparent host chain scores `hs/hr/ha = 0` — the secrecy of its data
   packets is not the secrecy of its transfers, and is captured by `hmeta`/`hnet` instead.
2. **`aset` precedence, in fixed order.** (1) protocol-enforced per-tx set (e.g. Monero ring size = 16
   at consensus level) → (2) live pool depth at `asof` (note/UTXO count or % of supply) → (3) fallback to
   the lowest band when the claim is unverifiable.
3. **Unverifiable cap, enforced in the engine.** An `aset` with no `src` or `conf = low` has its `bits`
   contribution capped at the `< 1,000` band, so an unbacked claim cannot buy credit.
4. **Separate leaderboards by `arch`** (the reviewer's Option B) — value-transfer assets are not ranked
   against infrastructure assets, because their gene sets mean different things.

## Scores after the fix

| Coin | arch | P | was | band | coverage | conf | missing |
|---|---|---|---|---|---|---|---|
| XMR | value-transfer | **78** | 77 | ±1 | 100% | 0.95 | — |
| ZEC | value-transfer | **52** | 52 | ±8 | 85% | 0.89 | bits |
| AZTEC | value-transfer | **42** | 42 | ±12 | 85% | 0.63 | bits |
| NYM | transport | **52** | **64** | ±10 | 85% | 0.73 | bits |
| SCRT | compute | **44** | 44 | ±11 | 85% | 0.67 | bits |
| MPC | compute | **44** | 44 | ±14 | 85% | 0.49 | bits |

**NYM fell from rank 2 to rank 3 overall (64 → 52)** once the non-value-transfer rule was applied, and
XMR's band tightened from ±2 to ±1 because its `aset` now carries a protocol-level source.

## Order check — grouped, as the rubric now requires

| Group | Actual | Expected | Verdict |
|---|---|---|---|
| value-transfer | XMR=78 > ZEC=52 > AZTEC=42 | XMR > ZEC > AZTEC | **match** |
| compute | SCRT=44 = MPC=44 | — | tie (see below) |
| transport | NYM=52 | — | single asset |

The pre-registered expectation was written about the value-transfer group, and that group now matches
exactly. The remaining cross-group question — is a metadata-only network really "stronger" than a
private-by-default rollup? — is now an explicit product decision rather than a hidden scoring artefact.

## Gate status

| Gate | Before | Now |
|---|---|---|
| 100% coverage, every value with src + asof | FAIL (5/6 missing aset) | still FAIL — `aset` needs tier-2 measurement for ZEC/AZTEC/SCRT/MPC/NYM; each coin now records what is missing in `aset_note` |
| band ≤ ±10 | FAIL (4/6) | **2/6 pass** (XMR ±1, ZEC ±8); SCRT ±11, NYM ±10 borderline, AZTEC ±12, MPC ±14 |
| order matches expected | FAIL (NYM 2nd) | **PASS within group** |
| rankStability ≤ ±1 | AZTEC spread 2 | to be re-run on the 2.1 data |
| blind second pass | NOT DONE | still pending — requires a second researcher; cannot be self-administered |

## Open items carried forward

1. `aset` tier-2 measurement: pick one explorer that counts notes (Zcash) and one that exposes
   per-epoch users (SCRT/MPC/NYM), and record the query + date as `src`. Until then those five assets
   cannot pass the coverage gate.
2. SCRT and MPC tie at 44. A tie is a signal that the engine is under-specified between two different
   trust models (TEE vs MPC); check the parts before trusting the tie.
3. MPC's band (±14, conf 0.49) is driven by low-confidence values in `hmeta`/`hnet`/`mat`/`pq`/`brk`.
   Either source them or leave them null — a low-confidence guess is worse than an explicit gap.
4. The `arch` split needs a UI surface so users cannot accidentally compare across groups; the group
   chip is shown in the dossier panel and in the DNA Matrix.
