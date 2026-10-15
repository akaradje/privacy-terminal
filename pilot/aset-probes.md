# `aset` tier-2 evidence probes — what was tried, what came back

Probe date: 2026-10-16 · purpose: replace the five `null` tier-2 `aset` values with a repeatable source

## Probe results

| Target | Endpoint tried | Result | Usable? |
|---|---|---|---|
| ZEC shielded pool | `api.blockchair.com/zcash/stats` | **HTTP 200**, but the payload has 34 fields and **none of them is the shielded pool** (only blocks/tx/outputs/circulation/mempool). No `shielded_*`, `sprout_*`, `sapling_*`, `orchard_*` field exists. | No |
| ZEC shielded pool | `api.zcha.in/v2/mainnet/network` | HTTP 520 (origin down) | No |
| NYM mixnodes | `harbourmaster.nymtech.net/v1/status/mixnodes` | Returns an HTML SPA shell, not JSON | No |
| NYM mixnodes | `validator.nymtech.net/api/v1/mixnodes` | HTTP 404 | No |
| NYM mixnodes | `api.nymtech.net/api/v1/mixnodes` | HTTP 501 `{"code":12,"message":"Not Implemented"}` | No |
| SCRT per-epoch users | `lcd.secret.express/cosmos/base/tendermint/v1beta1/node_info` | HTTP 000 (host unreachable from this environment) | No |
| MPC per-epoch users | — | Partisia's browser API is undocumented; no public path found to quote as `src` | No |

**Conclusion:** the coverage gap is real and the proposed endpoints do not close it from this environment.
Four of five tier-2 values stay `null`, and the rubric's tier-3 fallback applies. Each asset now carries an
`aset_note` recording exactly what measurement is missing, so the gap is auditable rather than silent.

## Correction: AZTEC must **not** be set to `aset = 0` with `conf = high`

The proposal to treat Aztec as "pre-mainnet, active shielded set = 0" does not match the record:

- Aztec **Ignition mainnet launched 2025-11-20** and the **TGE was 2026-02-12** — both are already in this
  repository (`data/dna3.json`, AZTEC `hist`), and AZTEC has a live market cap in the daily snapshot.
- The premise ("zk.money sunset ⇒ no mainnet pool") conflates the **2023 shutdown of Aztec Connect / zk.money**
  with the **2025 V5 / Ignition rollout**, which is a different system.
- Writing `0` with `conf = high` would therefore assert a **false fact** and would narrow the band by
  fabricating certainty. That is precisely the failure mode the data contract exists to prevent.

**Correct treatment:** `aset` stays `null` (value unknown, not zero), with `aset_note` naming the missing
measurement — a private-transaction or note count from Aztec's own explorer at a stated `asof`. If that
source is found, it enters as tier-2 evidence and the band narrows legitimately.

## Trust-tier fix applied in the same round (rubric 2.2)

SCRT and MPC tied at 44 because **all twelve of their gene values were identical** — a data problem, not an
engine problem. `tl` now distinguishes the trust assumption:

| Level | Meaning | Applied to |
|---|---|---|
| 1 | hardware enclave (TEE) — vendor root of trust, hardware-level side-channel history | SCRT |
| 1.5 | threshold / MPC — mathematical assumption + honest majority, no single hardware failure | MPC (Partisia) |
| 2 | trustless (no setup, no hardware, on-chain verifiable) | XMR, ZEC (Orchard), AZTEC |

Result: **SCRT 44 (TEE) < MPC 48 (threshold)** — the tie is broken by an explicit, sourced assumption rather
than by an arbitrary weight nudge.
