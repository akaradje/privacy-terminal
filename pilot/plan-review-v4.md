# Review of the proposed v4 upgrade plan

Reviewed: 2026-10-16 · context: the pilot round just **failed its gates** (`pilot/result.md`)

## Verdict in one line

The plan is directionally right but **mis-ordered**: it proposes four new capability layers on top of a
scoring core that has not yet passed a single validation gate. Two of its technical items are also
wrong for this codebase. Build the foundation first; the plan's §2–§4 become meaningful afterwards.

## Blocking dependency (what the plan does not account for)

| Gate | State | Consequence for the plan |
|---|---|---|
| Rubric has no rule for systems without on-chain value transfer | **open defect** | any new pillar inherits the same class of modelling hole (NYM ranked 2nd because of it) |
| `aset` has no repeatable measurement procedure | **open** | §2 "Anonymity set size" cannot be filled without inventing numbers |
| Evidence coverage | 72 / 364 values (20%) | §2's new metrics would be added as unsourced numbers, which the data contract forbids |
| Pilot gates (coverage 100%, band ≤ ±10, order, stability) | **failed** | §3 alpha features consume scores that are not yet trustworthy |
| `history/` depth | **1 day** | §3.1 (30–90 day divergence) and §3.2 (rotation) are arithmetically impossible today |

## Triage

### Do first (unblocks everything else)
1. **Fix the rubric defect** — add a "no value transfer" rule so `hs/hr/ha` score 0 and are excluded from
   the coverage denominator for mixnet/dVPN/messenger assets. *(`data/schema/rubric.json`)*
2. **Define the `aset` evidence procedure** — one measurement recipe per mechanism family (explorer query +
   date recorded as `src`), or explicitly accept `aset` as null in pass 1 and redistribute the `bits` weight
   instead of silently widening the band. *(`data/schema/rubric.json` + `engine/score.js`)*
3. **Re-run the 6-coin pilot against the gates** — including the blind second pass that has not been done.
4. **Then fill the remaining 45 coins** with `src` + `asof`.

### Do next (the plan's §2, in blueprint order)
5. Pillars **D** (development vitality) and **L** (liquidity) — both are API-derivable, low ambiguity.
6. Pillars **T** (tokenomics) and **S** (security/decentralisation) — partly curated, partly API.
7. Pillar **R** (regulatory) — fully curated, and the most judgement-heavy; do it last of the six.
8. **Anomaly detection in `validate.py`** — the plan's §4.4 is a genuinely good idea and cheap: reject
   `mcap == 0`, `volume == 0`, or a >90% day-over-day jump against `history/`, and flag instead of ingest.

### Do later (blocked by data depth, not by code)
9. **§3.1 dev-vs-mcap divergence** — needs ≥30 days of `history/` with pillar scores in it. The history
   snapshot already stores genes/flags/pillars, so the data will be there; the code would be premature today.
10. **§3.2 sector rotation** — same dependency; the category snapshots exist but a single day cannot show flow.
11. **§3.3 time-series compaction** — worth doing once `history/` has ~14+ files, not before.
12. **§4.3 head-to-head radar** — the radar needs the seven pillar scores; today only P exists, so a radar
    would render one axis. Build after items 5–7.

### Won't do as proposed (with reasons)
13. **"Rewrite the fetchers as async and CI drops to seconds."** False for this project. The fetcher is not
    CPU- or latency-bound; it is **rate-limit-bound**. Measured on 2026-10-15: 51 dossiers took ~35–40 minutes
    *with* an 8 s sleep and 75 s backoff on HTTP 429. Concurrency does not raise a rate limit — it triggers
    more 429s and can get the IP throttled harder. The correct fixes, in order: (a) a CoinGecko **Pro key**
    (the plan omits this, and it is the only change that actually solves it), (b) fewer endpoints,
    (c) `ETag` / `If-Modified-Since` to skip unchanged payloads, (d) jittered backoff. Async is a fine
    implementation detail *after* those; it is not the bottleneck.
14. **GitHub GraphQL** — reasonable but low-yield here: `gh` CLI calls are authenticated at 5,000 req/h and the
    enrichment is ~50 calls. Worth doing when the pillar-D metrics need per-repo commit/contributor history,
    which REST makes awkward. Not a priority on its own.
15. **Web Workers for custom rubric weighting** — solves a non-problem. Scoring 51 assets × 12 genes is
    microseconds; there is no jank to remove. Moving `engine/score.js` into a worker adds a message-passing
    boundary and a second code path for zero measured benefit.
16. **Lazy-loading the detail JSONs** — genuinely improves first paint (the bundle is now 241 KB because every
    dossier is embedded), but it **breaks two stated design goals**: single-file distribution and offline use.
    Treat it as a deliberate trade-off, not a pure win: either accept the bundle size, or ship a second
    "online" build variant. Do not silently drop the offline property.

## Corrected order (with rough effort)

| # | Work | Effort | Why here |
|---|---|---|---|
| 1 | Rubric: no-value-transfer rule | S | unblocks all filling |
| 2 | `aset` evidence procedure | S | removes the largest null block |
| 3 | Re-run pilot + blind pass | S | proves the core before scaling |
| 4 | Fill the remaining 45 coins | L | the actual data asset |
| 5 | Anomaly detection in `validate.py` | S | protects every ingest from here on |
| 6 | Pillars D + L | M | API-derivable, feeds §3 |
| 7 | Pillars T + S | M | mixed sources |
| 8 | Pillar R | S | curated, judgement-heavy |
| 9 | Radar compare (2–4 coins) | M | needs 7 pillars |
| 10 | History compaction + divergence/rotation | M | needs ≥30 days of history |
| 11 | Pro API key, then ETag, then jitter, then async | S–M | fixes the real bottleneck |
| 12 | Lazy-load decision (explicit trade-off) | M | only if first paint is worth losing offline |

## Answer to "which file should we start with?"

Not a file — **`data/schema/rubric.json`**. Every other item in the plan depends on the rubric producing
values that two independent researchers would agree on. Adding pillars, alpha features or a faster pipeline
before that simply multiplies the number of unsourced numbers in the system.
