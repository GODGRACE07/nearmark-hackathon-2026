# NEARMARK Gate — Rust payment control contract

**Status in this source release: compiled and exercised in the local NEAR Sandbox by the project owner; not independently audited and not yet deployed to a public Testnet or Mainnet at the time this bundle was assembled.**

NEARMARK Gate is a deliberately narrow, owner-mandated native-NEAR payment contract. It belongs to a dedicated, funded Gate account. It is not the owner's primary wallet and it is not a general-purpose contract-call router.

## What this version enforces on-chain

- Owner-only initialization, policy updates, agent rotation and emergency pause.
- A dedicated agent account and exact configured agent public key.
- Exact recipient allowlist.
- Per-payment cap and UTC calendar-day spend cap based on the NEAR block timestamp.
- Monotonic one-use nonce; replayed or out-of-order nonce is rejected.
- Five-minute maximum authorization lifetime.
- No attached deposit to `execute_payment`.
- State is updated before the transfer promise is scheduled, so concurrent transactions are serialized against the same contract state.
- Failed transfer callback releases the daily spend reservation when it is still in the same daily bucket. The nonce remains consumed.
- NEP-297-style structured event logs.

## Important scope boundary

This Gate only sends native NEAR from its own account balance. It does not transfer FT tokens, call arbitrary business contracts, enforce a model-generated decision, query a threat oracle, or replace the off-chain Counterparty API. `WARN` human approval remains an application workflow; only owner-configured hard limits and the allowlist are enforced by this initial Gate.

The Gate account must be separately funded with a bounded test budget. The owner must retain control of the Gate account and the agent account. Do not put the owner's Full Access key in the agent runtime.

## FunctionCall key setup requirement

Install the configured agent public key on `agent_id` as a **FunctionCall** access key with:

- `receiver_id` equal to the deployed Gate account;
- `method_names` containing only `execute_payment`;
- a conservative gas allowance;
- no Full Access key delivered to the agent.

The contract additionally checks both the predecessor account and `env::signer_account_pk()` against the configured agent identity. The FunctionCall key's gas allowance is not a token spending cap; the contract's own per-payment and daily limits provide the token budget.

The contract cannot inspect the permission type of its caller's access key. The FunctionCall restriction is enforced by NEAR protocol account-key configuration and must be independently checked after installation.

## Build and verify

The maintained release command is:

```bash
bash scripts/NEARMARK-ONE-CLICK.sh
```

It runs the repository tests, TypeScript checks, Vite build, Rust formatting/unit tests, official `cargo-near` WASM build, and modern near-workspaces Sandbox integration. The runner then offers an explicitly confirmed Testnet deployment path and writes a non-secret evidence record under `artifacts/`.

For the contract-only checks:

```bash
cd contracts/near-gate
cargo +1.95.0 fmt --check
cargo +1.95.0 test --lib
cargo +1.95.0 near build non-reproducible-wasm --no-abi
cargo +1.95.0 test --test sandbox_smoke -- --nocapture
```

WASM output:

`target/near/nearmark_gate.wasm`

## Testnet deployment

The one-click runner is hard-locked to `.testnet` account IDs and `https://rpc.testnet.near.org`. It requires the operator to type `DEPLOY TESTNET` before it creates/funds the demo subaccounts, installs the restricted FunctionCall key, deploys the Gate, or submits its small test payment. It uses the fresh owner account as the Gate contract account to ensure the initialization call is made by the declared owner. It does not deploy to Mainnet.

The contract is not independently audited. Passing compilation, unit tests, Sandbox tests or Testnet smoke tests is not a security audit or a guarantee of safety for real funds.
