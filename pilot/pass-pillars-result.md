# P-core close-out + Pillars D/L — result

**asof:** 2026-10-16 · **scoring:** `2.4.0-preview` · **scope:** all 51 assets
**Files:** `engine/score.js` · `engine/flags.js` · `validate.py` · `data/schema/rubric.json`
· `pilot/pass_hmeta_hnet.py` · `data/curated/repos.json`

---

## 1. Closing the P core

### 1.1 `hst` now covers off-chain private computation (option 2A, as chosen)

`hst` was "hides smart-contract state". It now also counts **off-chain / client-side private
computation and zkTLS attestation** — a protocol that processes sensitive data off-chain and puts
only a proof on-chain is protecting private state, just not on L1.

This is the correct home for zkPass rather than a 13th gene. One value change, five genes move:

| gene | before | after | reason |
|---|---|---|---|
| `hst` | 0 | **2** | the source data never leaves the client |
| `nst` | 1 | **0** | there *is* state being protected, so it must stay in the denominator |
| `man` | 0 | **1** | no transparent mode for the attested data (conf=low) |
| `tl` | 1 | **1.5** | 3P-TLS needs a proxy in the TLS session → threshold, not trustless |
| `mat` | 0 | **1** | 1–3 years live; audit count unverified |

**ZKP 6 → 38**, landing between OCT (41) and ZAMA (30) instead of at the bottom of the table.

### 1.2 `hnet` / `hmeta` re-valued from protocol features

Both genes now have explicit 0/1/2 criteria readable off a node/client/protocol document. All 51
assets were re-read against them:

| criterion | `hnet` | `hmeta` |
|---|---|---|
| **2** | enforced/default at the protocol layer (mixnet, onion routing, Dandelion++ built-in, Tor/I2P in the core client) | graph hidden **and** timing/size correlation mitigated (fixed-size packets, cut-through + kernel aggregation, shielded pool with no linkage) |
| **1** | opt-in Tor/I2P in the official client | content hidden but call timing / gas / input-output counts visible |
| **0** | standard gossip / RPC | linkage graph clearly exposed |

Confidence moved **low 100/102 → high 9 / med 25 / low 68**. `conf` is raised only where a project
document states the feature; where it is *inherited from a fork* it stays low on purpose
(BDX/ZEPH ← Monero's Dandelion++, MWC/EPIC/XTM ← Grin's cut-through).

**Correction made:** DERO/ZANO/XEL/ABEL dropped from `hnet 1 → 0`. Their earlier 1 was an
unverified guess ("no evidence found" is a value of 0, not of 1).

### 1.3 Band floored at ±2

XMR scored **±0** — literally "no uncertainty whatsoever", which this model cannot claim: the
`aset` definition itself (protocol-enforced vs effective after heuristics) is contested in the
literature, and `hmeta`/`hnet` are read off feature lists rather than measured.

### 1.4 Reordering that follows from the criteria (flagged, not adjusted)

The MimbleWimble family now leads at **80** (GRIN/BEAM/XTM/EPIC/MWC) with XMR at **78**. That comes
directly from the approved `hmeta` criterion — cut-through + kernel aggregation = 2, while XMR's
RingCT exposes input/output counts = 1 — plus XMR spending its proven 3/15 on `bits` where the MW
coins are floored at 0. It is the criteria working as written, not a weight change, but it is a
visible reordering and is listed here for confirmation.

---

## 2. `validate.py`: statistical anomaly detection

New `anomaly_check()` compares today's market snapshot against the newest `history/*.json.gz` and
warns on:
* a value that became 0 / None while it was non-zero yesterday (feed failure, delisting)
* a day-over-day move larger than **90%** in market cap or volume

Warnings, never errors — a genuine 100% move is possible, it just needs a look.

**It caught a real problem on its first run:**
> `MWC: market cap reports 0 — no market data for this asset`

Verified in the raw feed: MWC has a live price ($11.84) and volume ($394) but `market_cap: 0.0`.
Without this check the terminal would show a $0 market cap for a live coin.

Also added: a warning for every asset whose repo is **archived**, because that forces pillar D to 0
and the link itself may be stale rather than the project dead — which turned out to be true twice
(see 3.2).

---

## 3. Pillars D and L

### 3.1 Definitions (and what D cannot do)

| pillar | formula | honest limitation |
|---|---|---|
| **D** | recency of the last repo push (`≤7d 100`, `≤30d 80`, `≤90d 55`, `≤365d 25`, `0` otherwise) · archived → 0 | A **proxy**. CoinGecko's free tier no longer returns `developer_data` and the GitHub GraphQL pass (commit history, contributor counts, Dependabot filtering) is still on the roadmap. What we do have is exactly the signal that separates a live project from a legacy fork. |
| **L** | `0.45·turnover + 0.35·depth + 0.20·float` where turnover = vol/mcap, depth = log₁₀(mcap) scaled $1M→$1B, float = cs/ms | No DEX/CEX split and no order-book depth are available, so "delisting risk from a single venue" cannot be evaluated yet. |

Computed against a **fixed snapshot date** (`ASOF_DATE`), not `Date.now()`, so the same data always
produces the same D and daily diffs stay meaningful.

### 3.2 Two wrong-repo findings that pillar D exposed immediately

Same class as the DERO case — the link was stale, not the project dead. Both fixed with a curated
override in `data/curated/repos.json` (data, not code):

| asset | CoinGecko pointed at | reality | D before → after |
|---|---|---|---|
| **ZEC** | `zcash/zcash` — **archived** (GitHub API confirms `archived: true`, last push 2026-07-19) | development continued at `ZcashFoundation/zcashd` (2026-09-08); `ZcashFoundation/zebra` also active (2026-10-15) | **0 → 55** |
| **ALEO** | org-level link → enrichment picked the most-starred repo, `aleo-education` (docs, 2024-06-18) | the codebase is `AleoNet/snarkvm` / `snarkOS` (2026-05-27); `AleoNet/aleo` no longer exists (404) | **0 → 25** |

The other two archived repos are **correctly** dead: `dusk-network/dusk-blockchain` (2024-02-10) and
`sentinel-official/sentinel` (2021-04-13). The validator now names all of them so the next stale
link surfaces the same way.

### 3.3 A weighting problem in the blueprint's `investor` preset — fixed by adding, not replacing

Measured with only P/D/L available, the blueprint's `investor` preset gives P just **15 of 50**
weight. Result: **DASH (P 17) and XVG (P 16) both landed in its top 15** — a liquid, actively
developed coin with an almost non-existent privacy mechanism outranks a strong one. For a terminal
whose purpose is finding *privacy* assets that is the wrong question.

`privacy_investor: {P 45, D 30, L 25}` was **added** (the blueprint presets are untouched) and the
panel shows both, so the difference is visible and the choice is reversible.

### 3.4 Guard: no P → no composite

`compositeOf` returns null when the preset gives P weight and P is unavailable. Without it NOCK
(P unevidenced) ranked 12th on dev + liquidity alone.

---

## 4. The investment screen (what this was all for)

**Composite — privacy-investor preset (P 45 / D 30 / L 25), top 10 of 50:**

| # | | comp | P | D | L |
|---|---|---|---|---|---|
| 1 | GRIN | 82 | 80 | 100 | 65 |
| 2 | XMR | 80 | 78 | 100 | 60 |
| 3 | BDX | 78 | 75 | 100 | 55 |
| 4 | BEAM | 76 | 80 | 100 | 38 |
| 5 | EPIC | 75 | 80 | 100 | 35 |
| 6 | XTM | 75 | 80 | 100 | 34 |
| 7 | ZANO | 72 | 67 | 100 | 49 |
| 8 | MWC | 70 | 80 | 55 | — |
| 9 | ARRR | 68 | 61 | 100 | 44 |
| 10 | ZAMA | 66 | 30 | 100 | 91 |

**Value traps — strong mechanism, no development** (the screen working as intended):

| | P | D | note |
|---|---|---|---|
| **ZEPH** | 71 | **0** | repo untouched for ~490 days |
| **IRON** | 61 | **0** | repo untouched for ~430 days |

**High P + active dev + liquid:** XMR, BDX, ZANO, ARRR, GRIN, DERO (D 55 — active but slower).

**ZAMA at #10 is the honest artefact of a thin pillar set:** P 30 (conf 0.30), D 100, L 91. Nothing
in the current weights reflects that a young FHE project has a small anonymity set and an unproven
mechanism — pillar T (trust maturity) is exactly the missing piece.

---

## 5. Open items

1. **`avgConf` averages**, so one contested value among eight barely moves the band. A worst-case
   term is the principled fix; flagged in the engine, not applied unilaterally.
2. **D is a proxy** — commit-level velocity needs the GitHub GraphQL pass.
3. **Pillars T, S, R still missing** (trust maturity, decentralisation, regulatory). Until T exists
   the composite cannot tell ZAMA (young FHE) from XMR.
4. **`aset` still null for 47/51** → the `bits` component is unearned across the board.
5. **MWC's market cap reads 0** in the CoinGecko feed — the anomaly check flags it, the value itself
   needs a manual correction or an id re-check.
6. **DUSK / P2P repos are genuinely archived** — their D = 0 is a real finding, not a data bug.
7. **Blind second pass still outstanding** (needs a second researcher).
