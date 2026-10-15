# Pilot round — expected ranking (written BEFORE any gene value was filled)

> Commit this file **before** filling the pilot coins. If the result differs from this list,
> the difference must be explained by evidence — never by re-tuning weights to match a wish.
> Written: 2026-10-16 · scoring_version under test: `2.0.0-preview`

## Pilot set (6 coins, 6 mechanism families)

| Coin | Family | Why it is in the pilot |
|---|---|---|
| XMR | ring signature | mandatory currency privacy, the reference point for "strong" |
| ZEC | zk-SNARK shielded pool | opt-in shielded pool, ETF-listed, the sector's largest cap |
| AZTEC | zk-rollup (private-by-default execution) | hides contract state, client-side proving |
| SCRT | TEE | confidential contracts, hardware trust — should be punished by `tl` |
| MPC (Partisia) | MPC | secret-sharing compute, honest-majority assumption |
| NYM | mixnet | metadata/IP privacy only — tests whether coverage genes discriminate |

## Expected order (P, descending)

1. **XMR** — every coverage gene mandatory (`hs/hr/ha` = 2), trustless (no trusted setup),
   no address graph at all, 12 years of operation. Its weak spot is the ring-based `aset`,
   which is modest in absolute terms — but `man` and `tl` are both maximal.
   **Expected P ≈ 85–95.**
2. **ZEC** — best-in-class cryptography (Halo 2, no trusted setup) but **opt-in** (`man` = 0)
   and a pool-based `aset`; metadata resistance is partial at best.
   **Expected P ≈ 65–75.**
3. **AZTEC** — private-by-default execution (`man` = 1, `hst` = 2) and trustless proving, but
   young (maturity low) and the rollup's effective set is still small.
   **Expected P ≈ 55–65.**
4. **MPC (Partisia)** — hides contract inputs, but opt-in and honest-majority (`tl` = 1);
   `aset` = users interacting in the epoch, which is small for a niche network.
   **Expected P ≈ 50–62.**
5. **SCRT** — confidential contracts with **mandatory** private state, but the trust anchor is
   hardware (`tl` = 1 by definition: operator trust is counted in `tl`, never in `aset`).
   **Expected P ≈ 50–60.**
6. **NYM** — metadata-only privacy: strong `hmeta`/`hnet`, but the amount gene cannot be
   satisfied and there is no state layer to hide, so coverage caps it.
   **Expected P ≈ 40–52.**

## Falsifiable expectations (what would tell us the engine is wrong)

| If this happens | It means |
|---|---|
| SCRT ≥ ZEC | `tl` is not discriminating — TEE trust is not being priced |
| NYM > 55 | the coverage genes are not discriminating metadata-only privacy |
| XMR < 75 | the ring-based `aset` is dominating a design that is mandatory end-to-end |
| band > ±10 on any pilot coin | evidence is too thin to call the score (fails the pilot gate) |
| two coins tie within ±2 | the engine may be under-specified; check the parts before trusting the tie |

## Pilot gate (from the review)

- [ ] all 6 coins at 100% gene coverage, every value with `src` + `asof`
- [ ] band ≤ ±10 on every pilot coin
- [ ] order matches this file, or every deviation is justified from evidence
- [ ] `rankStability()` keeps each rank within ±1 (p10–p90)
- [ ] a blind second pass over 2 of the 6 coins differs by ≤ 1 level per gene
