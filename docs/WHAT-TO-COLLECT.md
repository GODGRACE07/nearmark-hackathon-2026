# Nearmark — accounts, credentials, tools and evidence to collect

Use testnet/sandbox first. Never paste private keys, seed phrases, OutLayer wallet API keys, NEAR AI API keys or GitHub tokens into chat or the browser frontend. Put secrets only in the server-side `.env` or the relevant provider's encrypted secret store.

## 1. Install locally

| Item | Why | Official download / guide | Required? |
|---|---|---|---|
| Node.js 24.22.1+ and npm | Runs the React/Vite app, Node API, SDK, CLI and MCP server | https://nodejs.org/en/download/ | Required |
| Git | Clone official integrations and version-control Nearmark | https://git-scm.com/downloads | Required |
| Rust stable + rustup/cargo | Builds the NEAR Gate contract and OutLayer WASI worker | https://rustup.rs/ | Required for contract/worker |
| `wasm32-unknown-unknown` target | NEAR smart-contract WASM | https://github.com/near/near-sdk-rs | Required for Gate |
| `wasm32-wasip2` target | OutLayer WASI Preview 2 worker | https://app.outlayer.ai/docs/sdk | Required for OutLayer worker |
| cargo-near | Build/deploy NEAR Rust contract and ABI | https://github.com/near/cargo-near | Required for Gate |
| near-cli-rs | Inspect accounts, deploy and call contracts | https://near.cli.rs/ | Required for testnet workflow |
| near-workspaces Rust crate | Run the repository local NEAR Sandbox integration tests | https://github.com/near/near-workspaces-rs | Required for reproducible Gate attack demo |
| pnpm | Install and run official NEAR AI verifier TS code | https://pnpm.io/installation | Required for verifier clone |
| Python 3.10+ | Optional alternative for NEAR AI verifier scripts | https://www.python.org/downloads/ | Optional |

## 2. Accounts and credentials to create yourself

| Account / credential | Where to obtain it | What to save locally |
|---|---|---|
| NEAR testnet owner account | https://testnet.mynearwallet.com/ or `cargo near create-dev-account` | Account ID only in `.env`; keep signer credentials in NEAR's local credential store |
| Testnet funds | https://near-faucet.io/ | Fund only disposable test accounts |
| NEAR AI Cloud API key | https://cloud.near.ai/ | `NEAR_AI_API_KEY` in server `.env` |
| NEAR AI model ID | Live `GET https://cloud-api.near.ai/v1/models` response | `NEAR_AI_MODEL`; select an available TEE-hosted model |
| OutLayer account | https://app.outlayer.ai/ | Account login; connect owner NEAR wallet in dashboard |
| OutLayer testnet custody wallet | OutLayer dashboard / Agent Custody docs | `OUTLAYER_API_KEY`, `OUTLAYER_WALLET_ID`; use testnet API URL for testnet |
| OutLayer compute project | https://app.outlayer.ai/projects | Project owner/name, published WASM URL and SHA-256 |
| OutLayer compute Payment Key | https://app.outlayer.ai/payment-keys | Payment key (`owner:nonce:secret`) stored in server environment/secret store; separate from custody API key |
| FastNear API key | https://docs.fastnear.com/ (Get API key) | `FASTNEAR_API_KEY` in server `.env`; the current Transactions API docs say to send an API key with every request |
| GitHub account | https://github.com/ | Public repository URL; enable secret scanning where available |
| X account | https://x.com/ | Public demo post URL; publish manually |

## 3. Nearmark identifiers to record (not secrets)

- `NEARMARK_OWNER_ACCOUNT`: testnet owner account, e.g. a real account you control.
- `NEARMARK_GATE_ACCOUNT`: deployed Gate contract account after contract deployment.
- `NEARMARK_AGENT_ACCOUNT`: the test agent account.
- Agent public key: `ed25519:...` (public key only).
- `OUTLAYER_WALLET_ID`: test wallet identifier.
- `OUTLAYER_PROJECT_OWNER` and `OUTLAYER_PROJECT_NAME`: project identifier for the TEE worker.
- Published worker WASM URL and exact SHA-256.
- NEAR AI model ID copied from live `/v1/models`.
- Test-suite version, Git commit, sandbox network, benchmark input/output hashes and public attestation/receipt URLs.

## 4. Server `.env` variables

The prototype already includes the first set in `.env.example`:

```dotenv
VITE_API_BASE_URL=
NEAR_RPC_URL=https://rpc.testnet.fastnear.com
NEAR_NETWORK=testnet
FASTNEAR_TX_API=https://tx.testnet.fastnear.com/v0/account
FASTNEAR_API_KEY=
NEAR_AI_BASE_URL=https://cloud-api.near.ai/v1
NEAR_AI_API_KEY=
NEAR_AI_MODEL=
OUTLAYER_API_URL=https://testnet-api.outlayer.ai
OUTLAYER_API_KEY=
OUTLAYER_WALLET_ID=
OUTLAYER_PROJECT_OWNER=
OUTLAYER_PROJECT_NAME=
OUTLAYER_PAYMENT_KEY=
NEARMARK_OWNER_ACCOUNT=
NEARMARK_GATE_ACCOUNT=
NEARMARK_AGENT_ACCOUNT=
PORT=8787
ALLOWED_ORIGIN=http://localhost:5173
MAX_BODY_BYTES=1048576
NEARMARK_VERIFIED_BLOCKLIST=
```

Use mainnet endpoints only for read-only public lookups where appropriate or after a separately approved mainnet release. OutLayer's current docs say ordinary account/balance/policy/call operations work on testnet, but NEAR Intents and confidential-intents endpoints are mainnet-only because there are no testnet solvers. Do not send production funds during the hackathon demo.

Do not prefix secrets with `VITE_`; Vite variables are bundled into public browser code.

## 5. Official source repositories and integrations

- Hackathon rules (re-read before submission): https://nearhackathon.com/HACKATHON.md
- Track 06 exact starter: https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/06-security.md
- NEAR agent setup prompt: https://github.com/nearai/near-hackathon-prompt-examples/blob/main/00-setup.md
- NEAR RPC: https://docs.near.org/api/rpc/introduction
- Access-key semantics/caveats: https://docs.near.org/protocol/accounts-contracts/access-keys
- NEAR Rust SDK: https://github.com/near/near-sdk-rs
- cargo-near: https://github.com/near/cargo-near
- NEAR CLI: https://near.cli.rs/
- NEAR Workspaces JS: https://github.com/near/near-workspaces-js
- FastNear docs: https://docs.fastnear.com/
- FastNear Transactions API: https://docs.fastnear.com/tx
- NEAR AI Cloud: https://cloud.near.ai/
- NEAR AI Cloud verification docs: https://docs.near.ai/cloud/verification
- Official NEAR AI verifier: https://github.com/nearai/nearai-cloud-verifier
- NEAR AI cybersecurity launch: https://near.ai/cybersecurity
- OutLayer getting started: https://app.outlayer.ai/docs/getting-started
- OutLayer Agent Custody: https://app.outlayer.ai/docs/agent-custody
- OutLayer TEE attestation: https://app.outlayer.ai/docs/tee-attestation
- OutLayer Trust & Verification: https://app.outlayer.ai/docs/trust-verification
- OutLayer signing keys: https://app.outlayer.ai/docs/signing-keys
- OutLayer SDK: https://app.outlayer.ai/docs/sdk
- OutLayer projects: https://app.outlayer.ai/docs/projects
- OutLayer HTTPS API: https://app.outlayer.ai/docs/https-api
- OutLayer pricing: https://app.outlayer.ai/docs/pricing
- OutLayer source repo/examples: https://github.com/out-layer/outlayer
- OutLayer CLI: https://github.com/out-layer/outlayer-cli
- Agent Market SDK: https://github.com/nearai/agents-market-sdk
- NEAR MCP: https://github.com/nearai/near-mcp
- NEAR Intents: https://docs.near-intents.org/
- NEAR agentic payments / MPP: https://www.near.org/agentic-payments

## 6. What is not a credential and must not be treated as proof

- A NEAR AI API key is not a TEE attestation.
- A model completion is not proof that an attested model produced it.
- An OutLayer custody API key is not the same as an OutLayer compute Payment Key.
- An OutLayer public key/signature alone is not a full TEE verification; verify the execution attestation and WASM/input/output binding.
- A FunctionCall gas allowance is not a token spending limit.
- An account's first indexed transaction is not necessarily its creation date.
- A testnet wallet and a mainnet wallet are not interchangeable.

## 7. Release gate before any real users or funds

1. Implement the Rust Gate and owner-signed mandate.
2. Test with `near-workspaces` local Sandbox and disposable testnet accounts.
3. Add replay, recipient substitution, wrong network, changed arguments, stale permit, RPC outage and oracle signature failure tests.
4. Implement historical code-hash and agent-recipient-history retrieval or disclose them as unsupported/UNKNOWN.
5. Deploy a dedicated OutLayer WASI worker; publish its exact WASM SHA-256 and verify each attestation.
6. Integrate the official NEAR AI Cloud verifier with a fresh nonce and response binding.
7. Add authentication, durable storage, rate limiting, key rotation, audit logs, monitoring and backup/recovery.
8. Obtain an independent security review before production custody or real-value payments.

No software can be guaranteed unhackable. Keep the first public release read-only or sandbox/testnet-only until the release gate is complete.
