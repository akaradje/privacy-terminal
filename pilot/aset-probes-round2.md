# `aset` tier-2 probes — round 2 (the replacement endpoint list)

Probe date: 2026-10-16 · follows `pilot/aset-probes.md` · 10 further endpoints tested

## Result: 8 of 10 dead, 2 alive but **not** anonymity sets

| Endpoint | HTTP | What came back | Usable as `aset`? |
|---|---|---|---|
| `raw.githubusercontent.com/ZecHub/zechub-wiki/.../shielded_supply.json` | **404** | `404: Not Found` | No — path does not exist |
| `zcashblockexplorer.com/api/v1/blockchain-info` | **000** | unreachable from this environment | No |
| `validator.nymtech.net/api/v1/status/mixnodes/active/count` | **404** | empty | No |
| `validator.nymtech.net/api/v1/mixnodes/active` | **404** | empty | No |
| `nym-spectre.vercel.app/api/mixnodes` | **404** | `DEPLOYMENT_NOT_FOUND` (the Vercel deployment is gone) | No |
| `rest.lavenderfive.com/secretnetwork/.../staking/v1beta1/pool` | **200** | `{"pool":{"not_bonded_tokens":"69148346366227","bonded_tokens":"806495191477312"}}` | **No — this is staked supply, not an anonymity set** |
| `rpc.lavenderfive.com/secretnetwork/status` | **200** | `chain: secret-4`, `latest_block_height: 27628384` | No — liveness only |
| `reader.partisiablockchain.com/chain/shards` | **404** | empty | No |
| `reader.partisiablockchain.com/chain/shards/Shard0/blocks/latest` | **400** | empty | No |
| `api.aztecscan.xyz/v1/stats` | **404** | `Not found` | No |

## The one thing that did work — and why it is not `aset`

`rest.lavenderfive.com/secretnetwork/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED`
returns real data: **24 active bonded validators** on Secret Network (`secret-4`, block 27,628,384).

That is a **decentralisation metric (pillar S)**, not an anonymity set. Using the bonded stake or the
validator count as `aset` would be a category error: validators are the parties the user must *trust*,
not the crowd the user hides inside — exactly the double-counting the rubric forbids (operator trust
belongs in `tl`). It has been noted for pillar S instead.

## Conclusion after two rounds (23 endpoints)

No public, key-free endpoint found in either round exposes a per-epoch anonymity-set size for
ZEC / NYM / SCRT / MPC / AZTEC. The tier-3 fallback therefore applies, as the rubric already specifies:
`aset` stays `null`, `aset_note` records the missing measurement, and `engine/score.js` caps `bits` at the
lowest band so an unbacked claim buys no credit.

**What this means for the reviewer's decision rule:** it resolves cleanly — every one of the five falls
into the "no public verifiable endpoint" branch, so the fallback runs and the wider uncertainty band is the
correct, honest output. This is not a blocker for the remaining 45 assets; it is a property of the data
landscape that should be stated in the README.

## Process note

Both endpoint lists supplied for probing were unverified. Round 1: 7 endpoints, all unusable.
Round 2: 10 endpoints, 8 dead and 2 live-but-wrong-category. Endpoint paths that look plausible
(`/api/v1/mixnodes/active/count`, `api.aztecscan.xyz`, a ZecHub JSON path) returned 404 — a reminder that
a URL is a claim until it is probed. The probe log is the artefact; the URL list is not.
