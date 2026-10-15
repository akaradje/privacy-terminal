# Pilot round — result (6 coins × 12 genes)

Run: 2026-10-16 · `scoring_version 2.0.0-preview` · expected ranking was committed first in `pilot/expected.md`
Fill script: `pilot/fill_pilot.py` · raw values now live in `data/dna3.json` as `{v, conf, src, asof}`

## 1. Scores vs expected

| Coin | P | band | coverage | conf | insufficient | missing |
|---|---|---|---|---|---|---|
| XMR | **77** | ±2 | 100% | 0.86 | no | — |
| NYM | **64** | ±11 | 85% | 0.67 | no | bits |
| ZEC | **52** | ±8 | 85% | 0.89 | no | bits |
| SCRT | **44** | ±11 | 85% | 0.67 | no | bits |
| MPC | **44** | ±14 | 85% | 0.49 | no | bits |
| AZTEC | **42** | ±12 | 85% | 0.63 | no | bits |

- **Expected:** XMR > ZEC > AZTEC ≈ MPC > SCRT > NYM
- **Actual:** XMR > **NYM** > ZEC > SCRT > MPC > AZTEC
- **Verdict: the order does not match, and the mismatch is a real signal, not noise.**

The pre-registered falsifiable expectation fired: *"if NYM > 55 then the coverage genes are not
discriminating metadata-only privacy"*. NYM scored **64**, second overall, ahead of ZEC.

### Why NYM ranked second (evidence, not opinion)
The fill gave NYM `hs=1, hr=1` on the grounds that a mixnet hides the sender/receiver of
*communication*. But `hs/hr/ha` are defined in `rubric.json` as hiding the sender, receiver and
amount **of an on-chain transfer** — NYM does not do that at all. Its `ha=0` was the only penalty,
and `ha` is one of four equally weighted genes inside the 30-point coverage component, so it lost
only ~7.5 points while collecting full marks on `hmeta` (10), `hnet` (8), `man` (12) and `mat` (8).
**This is a rubric defect, not an engine defect:** the rubric has no rule for systems with no
on-chain value transfer.

## 2. rankStability() — ±20% jitter on all eight weights, 1000 runs

| Coin | p10–p90 rank | mode | spread | gate (≤1) |
|---|---|---|---|---|
| XMR | 1–1 | 1 | 0 | pass |
| NYM | 2–2 | 2 | 0 | pass |
| ZEC | 3–3 | 3 | 0 | pass |
| SCRT | 4–5 | 4 | 1 | pass |
| MPC | 5–6 | 5 | 1 | pass |
| AZTEC | 4–6 | 6 | 2 | **fail** |

Rankings are stable for the top three; AZTEC wobbles two places, which is consistent with it
having the thinnest evidence (conf 0.63) and no `aset`.

## 3. Values that could not be sourced (left null, never guessed as 0)

| Coin | Gene | Why it is null |
|---|---|---|
| ZEC | `aset` | Orchard note-commitment count is not published in a citable form; the shielded-pool figure is in ZEC, not in notes |
| AZTEC | `aset` | No public count of notes/users per epoch for the rollup |
| SCRT | `aset` | No public count of users interacting per contract/epoch |
| MPC | `aset` | Same — epoch-level user counts are not published |
| NYM | `aset` | No published count of active mixnet users per epoch |
| AZTEC | `brk` | The July 2026 V5 proving-system vulnerability is disclosed, but I could not confirm that remediation is complete; setting 0 would understate, setting 1 would overstate |

Consequence: the `bits` component (weight 15) is missing for 5 of 6 coins, so coverage caps at 85%.

## 4. Pilot gate — result

| Gate | Result | Detail |
|---|---|---|
| 100% gene coverage, every value with src + asof | **FAIL** | 5/6 coins missing `aset`; all other 71 values carry src + asof |
| band ≤ ±10 | **FAIL** | XMR ±2, ZEC ±8 pass; SCRT ±11, NYM ±11, AZTEC ±12, MPC ±14 fail |
| order matches `expected.md` | **FAIL** | NYM ranked 2nd instead of 6th |
| rankStability within ±1 | **5/6 pass** | AZTEC spread 2 |
| blind second pass on 2 coins | **NOT DONE** | needs a second independent pass; cannot be self-administered |

**Conclusion: the pilot round does not pass.** The engine and schema work; the rubric and the
evidence procedure do not yet support a defensible fill.

## 5. What must change before filling all 51

1. **Rubric: add a rule for systems with no on-chain value transfer.** `hs/hr/ha` must score 0 for
   them and be excluded from the coverage denominator (the same way `nst` excludes `hst`), so a
   mixnet is judged on `hmeta`/`hnet` instead of being credited for hiding transfers it does not hide.
2. **`aset` needs an evidence procedure, not a hope.** Either (a) define a repeatable measurement
   (explorer query + date, recorded as `src`), or (b) accept `aset` as a "measured" field that is
   allowed to be null in the first pass, with the `bits` weight redistributed instead of silently
   widening the band.
3. **The band gate needs restating.** With several low-confidence genes, a global band ≤ ±10 is not
   reachable without either better evidence or a per-component confidence rule (e.g. require
   conf ≥ med on the three heaviest available components).
4. **Three of my own calls need a second opinion** before they harden into data:
   ZEC `hs/hr/ha = 1` (opt-in) rather than 2 · AZTEC `man = 0` because public functions exist ·
   NYM `man = 1` and `hs/hr = 1` (the modelling question in item 1).
5. **Retraction:** my earlier statement "ZEC 62 vs XMR 79 ยังออกมาถูกทาง" is withdrawn. This
   pre-registered run shows the opposite for NYM, and that is the more useful result.

## 6. Where the evidence came from

Every non-null value carries `src` + `asof` (2026-10-16) in `data/dna3.json`, pointing at the
project's own specification or documentation: Zero-to-Monero, the Zcash protocol spec (ZIP-224 /
Halo 2), Aztec docs, Secret Network docs, Partisia docs, Nym docs, and the Monero research-lab repo
for the anonymity-set literature. Confidence is marked honestly: `high` where the source states the
claim, `med` where it is derived, `low` where it is an inference — the low-confidence values are
listed above and are the reason MPC's band reaches ±14.
