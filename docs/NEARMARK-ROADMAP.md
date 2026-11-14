# NEARMARK — Product Roadmap

This roadmap describes the long-term strategy. Items below are not all implemented in the current hackathon MVP.

## Four-engine vision

1. **Authority Intelligence:** move from public account/key inspection and known Gate-path mapping toward broader evidence-backed effective-authority analysis.
2. **Attack Laboratory:** extend the six deterministic NASB cases into AI-assisted scenario generation and actual sandbox execution, including concurrency tests. Generated hypotheses must not be labelled executed attacks.
3. **Verifiable Benchmark:** evolve NASB-0.1 into a versioned, independently reproducible standard with disclosed methodology, undisclosed evaluation cases, false-block measurement and evidence-backed passports.
4. **Runtime Security SDK:** improve SDK/API/CLI/MCP interfaces and add integrations that enforce policy at the actual signing/custody boundary.

## Candidate ecosystem extensions

- NEAR AI RED cybersecurity models for hypothesis generation and analysis, followed by controlled execution in an isolated NEAR Sandbox.
- OutLayer Agent Custody policy assessment and TEE-backed evidence, with explicit verification of every output binding.
- NEAR Intents/MPP and x402 payment-request checks, only through supported routes and after execution is implemented.
- Agent Market publication of a real NEARMARK assessment service after service lifecycle and delivery are complete.
- Cross-custody benchmarking, independent reproductions and continuous monitoring.

NEAR AI RED information: https://near.ai/cybersecurity
Official launch article: https://near.ai/blog/cybersecurity-models-and-near-ai-red-launch

## Release rule

Do not change a roadmap item to implemented until the corresponding code path exists, the documented test passes, and evidence supports the exact claim.
