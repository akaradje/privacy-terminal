# Round: T/S de-duplication · Pillar R · Compare view

**asof:** 2026-10-16 · **scoring:** `2.6.0-preview` · **scope:** all 51 assets
**Files:** `engine/score.js` · `app.js` · `template.html` · `validate.py` · `data/schema/rubric.json`
· `pilot/pass_security.py` · `data/curated/repos.json`

---

## 1. T and S stop double-counting

T was blending three things that answered different questions: mainnet age, the `mat` gene (which
itself mixes age **and** audits), and a plain "has an audit" flag. Audit therefore counted twice —
once inside `mat` inside P, and once inside T.

| | before | after |
|---|---|---|
| **T** | 45% age + 35% `mat` + 20% audit | **70% mainnet age + 30% dev continuity** — no audit, no `mat` |
| **S** | 50% `brk` (binary) + 50% "has an audit" | **40% audit quality (0/1/2) + 35% exploit history + 25% the primitive's trust assumption** |

T keeps its hard cap at 40 for a mainnet under a year old. The `tl` term inside S is a deliberate
overlap with P and is stated in the engine comment: S is a roll-up of the security dimension, not
an independent measurement.

---

## 2. `brk` becomes a history, and only the unpatched case costs P

`brk` was 0 for 47 coins with `conf=low` — "we did not check" dressed as "never happened". It is now
ternary, and the gate is that **a 0.5 must carry a real CVE or post-mortem citation**:

| value | meaning | effect |
|---|---|---|
| `0` | none found | no P penalty |
| `0.5` | a protocol/enclave-level break that was **patched or replaced** | **no P penalty** (P measures current exposure) · scores 55 in S |
| `1` | unpatched | P −15 · `unpatched_break` flag |

The reasoning for not charging 0.5 in P is exactly the asymmetry that would otherwise appear:
charging a patched history would punish a coin for a bug it fixed, while a coin with an *unmeasured*
leak (Grin's stem-phase problem, which Bogatyy quantified) pays nothing. The history is still
recorded — it just lives in S, where it belongs.

**Sourced this round:** ZEC (counterfeiting vulnerability 2018; Orchard soundness bug 2026-06 →
Ironwood 2026-07) and SCRT (SGX ÆPIC Leak 2022 — mitigation is enclave/key rotation, not a protocol
patch, so the hardware-level risk persists).

**Not sourced, and left at 0 with the gap named:** XMR (the claimed 2017 key-image bug), FIRO
(Zerocoin/Sigma exploits), GRIN and BEAM (early-stage bugs). An unsourced 0.5 is the fabrication the
data contract forbids, so the honest output is `0` + a note saying which citation is missing.
AZTEC stays **null** — the V5 patch status is unconfirmed.

---

## 3. Pillar R (regulatory & censorship resilience)

| component | weight | source |
|---|---|---|
| protocol censorship resistance | **55%** | `tl` — nothing to switch off, no enclave vendor, no permissioned notary |
| compliance capability | **45%** | `comp`, a new graded field (viewing keys / selective disclosure / proof of innocence) |
| **sanction cap** | — | a directly sanctioned protocol is capped at **25** regardless of the above |

**Tornado Cash** is the case the cap exists for: designated by OFAC 2022-08-08, re-designated
2022-11-18, and overturned by W.D. Texas in 2025-01 — the cap reflects that the practical damage
(frontends and listings removed) outlived the ruling. R: **25**.

`comp` was graded for all 51: 2 (documented) for ZEC, AZTEC, RAIL, ALEO, IRON, NIGHT, CC, DUSK,
ZKP, the Zcash-derived forks (ARRR/YEC/ZCL/ZER/VRSC/PIVX) and SCRT (SNIP-20 viewing keys); 0 for
the Monero/CryptoNote family and the transparent or pure-mixer coins; **1 for 14 coins means "not
evidenced", not "partial"**, and that is stated in the rubric and in every note.

**One artifact found and fixed while building it:** `comp = 1` ("not evidenced", 50 points) scored
*higher* than `comp = 0` ("known to have no affordance", 0) — so leaving a coin unchecked beat
having checked it. Resolving the two fork families (Zcash-derived inherit viewing keys; CryptoNote
has none by design) removed the inversion: BDX and GRIN now both sit at R 55.

**Not in R, for lack of a source:** venue breadth / DEX-vs-CEX liquidity. Exchange ticker data is
not collected, so that component's weight is left unassigned rather than guessed.

---

## 4. Compare view — radar + gene table

Select 2–4 coins with the new **⇄** button in the last column of the table, then switch to
**เปรียบเทียบ (n)**:

- **Radar** over P/D/L/T/S/R — the profile shape, i.e. which pillar carries a coin and which one is
  missing. Now possible because there are six pillars to plot; with one it would have been a dot.
- **Gene table underneath** — 18 genes per coin with a confidence dot per cell (none = high,
  `·` = med, `··` = low, `—` = no value). A shape alone is not a finding; the table is the evidence
  for every axis.

Verified: 51 toggle buttons render, 25 table rows (1 header + 6 pillar + 18 gene), 8 radar polygons
(4 grid rings + 4 series), 24 vertex markers, empty state and clear button both work.

---

## 5. A third stale repo, found by pillar D

`AztecProtocol/aztec` is **archived** — GitHub confirms `archived: true`, last push 2022-12-13 —
and the dossier pointed at it, giving Aztec `D = 0`. Development continued at
`AztecProtocol/aztec-packages` (2026-10-15, 456★) with `aztec-nr` (Noir circuits) also active.
Curated override added; **D 0 → 100**. This is the third instance of the same class (after DERO and
ZEC), which is why the override file exists rather than patching the enrichment script again.

---

## 6. Composite (risk-adjusted, top 12 of 50)

| # | | comp | P | D | L | T | S | R |
|---|---|---|---|---|---|---|---|---|
| 1 | XMR | 83 | 78 | 100 | 60 | 100 | 100 | 55 |
| 2 | BDX | 78 | 75 | 100 | 55 | 100 | 60 | 55 |
| 3 | GRIN | 77 | 75 | 100 | 65 | 100 | 60 | 55 |
| 4 | ZANO | 74 | 67 | 100 | 49 | 100 | 60 | 55 |
| 5 | BEAM | 73 | 75 | 100 | 38 | 100 | 60 | 55 |
| 6 | EPIC | 72 | 75 | 100 | 35 | 100 | 60 | 55 |
| 7 | ARRR | 70 | 61 | 100 | 44 | 100 | 48 | 73 |
| 8 | ZEC | 68 | 49 | 55 | 79 | 87 | 84 | 100 |
| 9 | FIRO | 67 | 44 | 100 | 35 | 100 | 80 | 78 |
| 10 | XTM | 67 | 75 | 100 | 34 | 65 | 60 | 55 |
| 11 | AZTEC | 66 | 36 | 100 | 71 | 65 | — | 100 |
| 12 | PIVX | 64 | 38 | 100 | 49 | 100 | 48 | 73 |

**Value traps still caught:** ZEPH (#35, P 71, D 0), IRON (#38, P 61, D 0).
**Weak-mechanism coins held down:** DASH #28, XVG #32.
**Sanctioned:** TORN #45 (R capped at 25).

---

## 7. Open items

1. **`S` depends on an audit field nobody has filled in for 46 of 51 coins.** Tier 0 means "no
   record found", so S's absolute level is soft until someone reads 46 security pages.
2. **`brk` history is sourced for 2 coins only** (ZEC, SCRT). XMR/FIRO/GRIN/BEAM need citations
   before their 0 can be trusted as anything other than "not checked".
3. **`comp` is "not evidenced" for 14 coins** — the neutral 50 is a placeholder, not a finding.
4. **R has no venue component** — needs exchange ticker data.
5. **`T` and `D` overlap by design** (dev continuity is 30% of T) — smaller than the old double
   count, but it is still an overlap.
6. **`aset` still null for 47/51** → `bits` unearned board-wide.
7. **Blind second pass still outstanding.**
