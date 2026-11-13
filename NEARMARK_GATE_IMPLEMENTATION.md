# NEARMARK Gate implementation patch

This patch adds the first native Rust Gate contract to the existing NEARMARK repository.

It is intentionally narrow: owner-configured native NEAR payments only, from a separately funded Gate account. The agent is restricted to one exact public key and one contract entry point. Contract-level allowlist, per-transfer cap, daily cap, expiry and monotonic nonce are enforced independently of NEAR AI.

The patch does not implement FT transfers, arbitrary contract calls, signed off-chain oracle attestations, or a full WARN approval workflow. It is not audited and must not be deployed to mainnet.

The contract uses `near-sdk = 5.30.1` and Rust 1.95.0, matching current published package compatibility information. Source: https://docs.rs/crate/near-sdk/latest
