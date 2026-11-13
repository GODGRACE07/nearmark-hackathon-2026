# Security policy

Nearmark is a prototype. Do not connect it to wallets holding production funds.

## Supported security reports

Please report vulnerabilities privately to the project maintainer. Do not disclose secrets, private keys, seed phrases or personal data in issue trackers.

## Current trust boundaries

- Browser: untrusted client. It cannot hold privileged API credentials.
- Nearmark API: reads public RPC data and applies explicit policy inputs. It is not a signing authority.
- NEAR RPC/FastNear: external data sources; results can be stale, incomplete or unavailable.
- NEAR AI: model output is untrusted analysis until official attestation/response verification has been performed.
- OutLayer: optional external custody/TEE provider; use least-privilege credentials and only documented read endpoints in this prototype.
- Local benchmark signer: ephemeral process-local key; not a production identity.

## Before production

Require an independent review of the on-chain Gate, mandate authorization, signature format, nonce storage, expiry handling, oracle key rotation, account recovery, benchmark reproducibility, API authentication, rate limiting, threat report moderation and dependency supply chain.
