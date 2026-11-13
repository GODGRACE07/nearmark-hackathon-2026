# Nearmark data sources and evidence boundaries

This document maps every Track 06 signal to its source, retrieval method, current implementation status, and limits. A missing or unavailable signal must remain `UNKNOWN`/`WARN`; it must never be silently treated as safe.

## Evidence matrix

| Signal | Source and method | Current status | Important limitation |
|---|---|---|---|
| Account existence and current state | NEAR JSON-RPC `query` with `request_type: view_account` and `finality: final` | Implemented in `server/near.mjs` | A point-in-time state read; an RPC outage is not evidence that an account is malicious. |
| Registered access keys | NEAR JSON-RPC `query` with `request_type: view_access_key_list` | Implemented | Shows public permission configuration, not the identity or custody of the private-key holder. |
| FunctionCall receiver/method scope | Parse each access-key permission's `FunctionCall.receiver_id`, `method_names`, and `allowance` | Implemented | A FunctionCall method can have downstream effects in the called contract. Gas allowance is not a token-spend limit. |
| Account activity / first observed transaction | FastNear Transactions API `POST /v0/account` with pagination | Implemented as a sampled first-seen indicator | First indexed transaction is not guaranteed to be account creation. The UI and API must call it `first-seen indexed activity`. |
| Receiver contract detection | `view_account.code_hash` compared with the protocol's no-contract hash | Implemented | Presence of code does not establish that code is safe. |
| Historical code changes | Compare `code_hash` at historical/finalized block heights using archival RPC and locate deployment activity | Partially implemented: current code hash only | Do not claim a recent code-change result until historical snapshots and deployment events are actually retrieved. |
| Agent-to-recipient interaction history | Paginated transaction/receipt history joined by signer, receiver, method and agent public key | Not yet implemented in the prototype | Current counterparty response explicitly returns `previousInteraction.status = not_checked`. |
| Shared threat reports | Nearmark report intake, with evidence reference and pending status | Local pending-report store implemented | No pending report can block. Verification workflow, Sybil resistance and durable shared storage are future work. |
| Verified threat list | Owner/operator-curated `NEARMARK_VERIFIED_BLOCKLIST` environment setting | Implemented as a local operator configuration | This is not a decentralized community reputation network. Protect and audit this list. |
| Contract method/downstream effects | Source/WASM analysis plus NEAR Sandbox/near-workspaces execution traces | Design documented; not yet integrated in the web app | Static analysis is incomplete for arbitrary contracts. Only observed sandbox effects should be called observed. |
| NEAR AI model discovery/inference | NEAR AI Cloud OpenAI-compatible API (`/v1/models`, `/v1/chat/completions`) | Implemented when server API key is configured | A completion is not attestation. The current route explicitly says verification has not been performed. |
| NEAR AI attestation | Official `nearai-cloud-verifier` flow with fresh nonce, attestation and response-signature verification | Integration guide only | No Verified badge may be shown until the exact applicable verification checks pass. |
| OutLayer wallet address, balance and policy | OutLayer read-only address/balance/policy API endpoints | Implemented when the server API key is configured | The current app does not sign or transfer funds through OutLayer. |
| OutLayer TEE benchmark receipt | Dedicated OutLayer WASI worker plus protected signing key and verified execution attestation | Deployment guide only | No worker or OutLayer attested receipt is deployed by this prototype. Local Ed25519 receipts are not TEE receipts. |

## Official source links

- NEAR RPC overview: https://docs.near.org/api/rpc/introduction
- NEAR access keys: https://docs.near.org/protocol/accounts-contracts/access-keys
- FastNear Transactions API: https://docs.fastnear.com/tx
- NEAR AI Cloud: https://docs.near.ai/
- Official NEAR AI Cloud verifier: https://github.com/nearai/nearai-cloud-verifier
- OutLayer Agent Custody: https://app.outlayer.ai/docs/agent-custody
- OutLayer TEE attestation: https://app.outlayer.ai/docs/tee-attestation
- OutLayer signing keys: https://app.outlayer.ai/docs/signing-keys
- NEAR Workspaces: https://github.com/near/near-workspaces-js

## Rules for interpreting the evidence

1. Use finalized NEAR state for account and key inspection.
2. Attach retrieval time, network, block height and source to each report.
3. Keep `UNKNOWN` distinct from `SAFE`, `ALLOW` and `BLOCK`.
4. Use owner policy as the source of truth for allowed payees, asset, amount, method, contract and expiry.
5. Never treat account age, a model's confidence, a code hash or a TEE attestation as standalone proof of wallet safety.
6. A pending community report is an unverified allegation, not a blocklist entry.
7. Benchmark comparison is valid only when suite version, code commit, wallet/custody configuration, funding, environment and attack scenarios are pinned and disclosed.
8. Do not publish third-party rankings without their exact tested artifact, reproducible logs, fair failure handling and an opportunity to respond.
