# NEARMARK AI Judge Runbook

## Quick start
```bash
git clone https://github.com/GODGRACE07/nearmark-hackathon-2026.git
cd nearmark-hackathon-2026
npm ci
npm run check
npm run dev
```

## Evaluation steps
1. `/inspect`: inspect a public NEAR account.
2. Review access-key type, receiver, methods and allowance.
3. `/counterparty`: test an approved payment.
4. Substitute an unauthorized recipient and inspect the BLOCK reason.
5. `/lab`: execute the local deterministic scenarios.
6. `/benchmarks`: examine individual outcomes.
7. `/developers`: review developer interfaces.
8. `/methodology`: inspect evidence classifications.

The six NASB scenarios are recipient substitution, legitimate payment, amount limit, permit binding, replay protection and restricted method. A 6/6 local result proves these included cases only. It is not a third-party audit. An API decision alone is not signer-level enforcement.
