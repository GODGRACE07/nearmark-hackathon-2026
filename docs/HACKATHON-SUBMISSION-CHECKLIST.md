# NEAR HACKATHON submission checklist

**Official development/submission deadline in the current organizer guide: 14 November 2026, 23:59 UTC.** Recheck the live rules immediately before submitting: https://nearhackathon.com/HACKATHON.md

## Track

- Primary fit: `security` — AI Security & Defense (Track 06).
- Do not select `privacy` solely because the app can call a NEAR AI model. The current app's raw model-inference endpoint does not independently verify a TEE attestation or exact response signature.

## Required before the one-time submission

- [ ] Run `scripts/NEARMARK-ONE-CLICK.sh` successfully and retain the log.
- [ ] If Testnet deployment is completed, retain `artifacts/nearmark-testnet-evidence.json` and the explorer transaction links.
- [ ] Publish the source repository publicly. The repository must remain accessible to judges. Do not include `.env`, `.env.local`, key files, `.near-credentials`, `.nearmark`, `node_modules`, or Rust `target` output.
- [ ] Record a short demo video showing the product, a real account/key inspection, a counterparty ALLOW/BLOCK decision, the browser lab, and the Rust/Testnet Gate evidence. Distinguish local Sandbox evidence from live Testnet evidence.
- [ ] Publish a public X post that says the project was built at NEAR HACKATHON, tags `@NEARProtocol`, includes `#NEARHackathon`, and attaches the video or screenshots. Save the public post URL.
- [ ] Prepare the final form details: project name, lead name, contact email, team size, track IDs, Mainnet NEAR payout account, public repository URL, public demo-post URL, and a 20–2000 character project description.
- [ ] Read the organizer's contact notice and consent only if you agree to it.
- [ ] Check that this repository has not already been submitted.

The Testnet owner account is **not** the Mainnet payout account. The organizer guide explicitly asks for a Mainnet NEAR payout address. Do not paste a Testnet address into that field.

## Accurate project description draft

> NEARMARK is an evidence-first security tool for autonomous agents on NEAR. It inspects finalized account and access-key permissions, evaluates proposed recipients against an owner-defined mandate, and includes a native-NEAR Gate that constrains agent payments through a dedicated FunctionCall key. The Gate independently checks the agent account and public key, approved recipients, per-payment and daily limits, a one-use nonce, expiry, and an owner emergency pause. The SDK blocks denied decisions and requires explicit human approval for warnings; the contract remains the final on-chain enforcement layer. NEARMARK combines a React dashboard, Node API, developer SDK, CLI/MCP interfaces, local benchmark harness, and reproducible Rust Sandbox/Testnet checks. Reports distinguish confirmed chain facts, controlled observations, inferences, and unknowns rather than presenting a security score as a guarantee.

Update the sentence about Testnet only after the release runner has actually succeeded. Do not claim NEAR AI response attestation or an OutLayer TEE worker is live unless those integrations have separately passed their official verifiers.

## Demo post draft

> Built **NEARMARK** at #NEARHackathon with @NEARProtocol.
>
> AI agents should not need unrestricted wallet authority. NEARMARK inspects NEAR account permissions, evaluates recipients against an owner mandate, and tests a native-NEAR Gate that limits an agent to one approved payment method, recipients and spending caps.
>
> The demo shows real permission inspection, fail-closed policy checks, and reproducible contract attack tests. Evidence is labeled by what was actually confirmed — not by marketing claims.
>
> Demo: [add video link or attachment]
> Repository: [add public repository URL]

## Submission safety

The organizer guide says one submission per project/repository and that the submission cannot be edited. Do not submit until the public repository, demo post, payout address and every form field are verified. Never automate the final POST without reviewing the exact payload and getting the project lead's explicit confirmation.

Official guide: https://nearhackathon.com/HACKATHON.md
