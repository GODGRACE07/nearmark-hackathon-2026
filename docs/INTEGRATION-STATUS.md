# NEARMARK integration status

- NEAR AI Cloud: actual `provider_tee` inference receipt verified in the project evidence. The RED model route generates defensive hypotheses only; those hypotheses are not attacks until executed in Sandbox.
- NEAR Sandbox: Native Gate integration test executed and passed. FT Gate Rust unit tests passed; a separate FT Gate Testnet payment settled.
- OutLayer: WASI Preview 2 receipt-signing worker builds and local canonical-signature verifier tests pass. Remote deployment and independent TDX verification are pending until an `outlayer-verify bundle --offline` run exits 0.
- Cloudflare: deployment pipeline targets one Workers Static Assets + Workers API + D1 service on the Free plan with a 10 ms CPU cap. Public deployment must pass post-deploy health, benchmark, inspection and MCP smoke tests.
- Agent Market: service discovery is read-only. Paid job creation is disabled unless the operator configures a private server token, a server-side budget cap and explicit spend confirmation. Publishing NEARMARK as a provider service requires marketplace-side enrollment/API support not assumed by this repository.
- NEAR Intents: 1Click token metadata and dry quote preview only. No deposit address, swap, payment or Testnet execution is submitted.
- MCP: stateless HTTP JSON-RPC endpoint exposes read-only inspection, Authority Shadow, counterparty checks, local NASB, NEAR AI RED hypotheses, Agent Market discovery and NEAR Intents token metadata. It does not expose signing keys or arbitrary transaction signing.
