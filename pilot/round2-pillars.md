# Round: MimbleWimble hmeta cap · MWC market cap · Pillars T/S + risk-adjusted composite

**asof:** 2026-10-16 · **scoring:** `2.5.0-preview` · **scope:** all 51 assets

---

## 1. MimbleWimble `hmeta` 2 → 1 (the reordering, resolved without touching weights)

**Ruling:** no weight fudging — the criterion was wrong, not the formula.

Cut-through hides the graph *after* a block closes. The mempool/stem phase still leaks, and that is
measured, not theorised:

> **Ivan Bogatyy** (Dragonfly Research, Nov 2019), *"Breaking MimbleWimble's Privacy Model"* —
> by running sniffer nodes in the stem phase he identified the sender and receiver of **~96% of
> Grin transactions in real time**, for about **$60/week** of AWS, before the blocks closed.
> Interactive transaction building (the sender and receiver must exchange a slate) adds connection
> metadata on top of that.

Vitalik Buterin's response to the same paper is the reason the cap is principled rather than
arbitrary: *a medium anonymity set is a small anonymity set* — only a global anonymity set
(ZK-SNARKs) actually guarantees privacy. Granting MimbleWimble the same `hmeta = 2` as a mixnet with
fixed-size packets and cover traffic, or a fully shielded Orchard pool, was crediting the mechanism
for a property it does not have.

**Source:** `https://github.com/mimblewimble/docs/wiki/Privacy-Prerequisites-and-FAQ` (Grin's own
documentation of the limitation — verified reachable; the Dragonfly page is behind a 403 to
automated requests, so the citation is recorded in the note rather than the `src`).

| | before | after |
|---|---|---|
| GRIN / BEAM / MWC / EPIC / XTM | 80 | **75** |
| XMR | 78 (rank 6) | **78 (rank 1)** |

XMR is back at the top of both P and the composite on a technical argument, and the criterion now
states the cap explicitly so a future filler cannot re-grant it.

---

## 2. MWC market cap = 0 — the fallback had to go one step further

The suggested `price × circulating_supply` could not fire, because the feed reports **both** fields
as zero:

```
symbol: mwc · price: 11.84 · volume: 394.04
market_cap: 0.0 · circulating_supply: 0.0 · max_supply: 20,000,000 · FDV: 130,414,780
```

`build.py` now tries, in order, and stops at the first that works:

1. `price × circulating_supply`
2. `price × (FDV / price)` — i.e. the FDV itself, which is the supply figure CoinGecko itself used.
   Guarded: the implied supply must be positive and no larger than `max_supply`.

For MWC this yields **$130,414,780**, implying **11,015,014** coins — which matches the known
circulating supply (~10.9–11M) and is the number the report expected. The record carries `mi: 1`, a
new `mcap_imputed` LOW flag fires, the panel prints "imputed", and the validator warning now says
the fallback exists. Pillar L for MWC: null → **45**.

---

## 3. Pillars T and S, and the risk-adjusted composite

### T — tech / network maturity

`45%` mainnet age (from `yr`) + `35%` the `mat` gene (age + public audits) + `20%` an audit record,
with a **hard cap at 40** when the mainnet is under a year old. A pre-mainnet or freshly launched
protocol cannot be battle-tested however good the design is — that cap is the mechanism that
answers the ZAMA case at the pillar level, independently of the band penalty below.

### S — security & audit posture

`50%` "is there an unpatched privacy break?" (`brk`) + `50%` "is there a public audit record?".
**S is null when `brk` is unknown** — the security posture of a coin whose exploit history has not
been checked cannot be scored. Only AZTEC is in that state, and it is correctly excluded from S
rather than given a generous default.

Known softness, stated in the engine: most `brk = 0` values carry `conf=low`, so an unaudited coin
gets 50 and an audited one gets 100. The gap is real; the absolute level is soft.

### Risk-adjusted composite

`privacy_investor` moved from `{P 45, D 30, L 25}` to **`{P 35, D 20, L 15, T 15, S 15}`** and now
uses `P_conservative = P − band/2` in place of the point estimate — the way an institutional reader
treats a wide estimate. Applied only to `privacy_investor`; the blueprint presets are untouched.

### The ZAMA case

| | P | band | P used | D | L | T | S | composite | rank |
|---|---|---|---|---|---|---|---|---|---|
| before | 30 | ±17 | 30 | 100 | 91 | — | — | 66 | **10** |
| after | 30 | ±17 | **22** | 100 | 91 | **9** | **50** | **50** | **27** |

XMR, by contrast, loses 1 point (78 → 77) because its band is ±2. That asymmetry — the penalty
scales with the uncertainty — is the whole point.

---

## 4. Final composite (risk-adjusted, top 12 of 50)

| # | | comp | P | D | L | T | S |
|---|---|---|---|---|---|---|---|
| 1 | XMR | 86 | 78 | 100 | 60 | 100 | 100 |
| 2 | GRIN | 74 | 75 | 100 | 65 | 80 | 50 |
| 3 | BDX | 72 | 75 | 100 | 55 | 80 | 50 |
| 4 | EPIC | 69 | 75 | 100 | 35 | 80 | 50 |
| 5 | BEAM | 69 | 75 | 100 | 38 | 80 | 50 |
| 6 | ZEC | 68 | 49 | 55 | 79 | 100 | 100 |
| 7 | ZANO | 68 | 67 | 100 | 49 | 80 | 50 |
| 8 | FIRO | 68 | 44 | 100 | 35 | 100 | 100 |
| 9 | ARRR | 65 | 61 | 100 | 44 | 80 | 50 |
| 10 | XTM | 65 | 75 | 100 | 34 | 58 | 50 |
| 11 | SCRT | 62 | 27 | 100 | 34 | 100 | 100 |
| 12 | MWC | 61 | 75 | 55 | 45 | 80 | 50 |

**Value traps still caught:** ZEPH (#35, P 71, D 0) and IRON (#38, P 61, D 0).
**Weak-mechanism coins correctly held down:** DASH #16, XVG #23.

---

## 5. Open items

1. **`S` rests on a binary audit field.** "Has an audit record" is a 0/20-percent swing; audit
   quality, recency and scope are not represented. A structured `audits` list (firm, date, scope)
   is the fix.
2. **`brk = 0` with `conf=low` for 47 of 51 coins.** Nobody has read every advisory; S's absolute
   level is correspondingly soft.
3. **`T` and `mat` overlap** (mat already encodes age + audits) — the 35/45 split double-counts
   age. Acceptable for now, flagged.
4. **`aset` still null for 47/51** → the `bits` component stays unearned board-wide.
5. **`avgConf` averaging** still means one contested value barely moves the band.
6. **Blind second pass still outstanding.**
