# @nearmark/sdk (local workspace package)

A small JavaScript/TypeScript client for the Nearmark REST API. It deliberately never accepts a private key and never signs or broadcasts transactions.

## Install inside the Nearmark monorepo

```bash
npm install
```

The root npm workspaces link this package as `@nearmark/sdk`.

## Install into another local project

```bash
npm install /absolute/path/to/nearmark/packages/sdk
```

The package is not published to the public npm registry by this prototype.

## Usage

```ts
import { NearmarkClient } from "@nearmark/sdk";

const near = new NearmarkClient({
  baseUrl: process.env.NEARMARK_API_URL ?? "http://localhost:8787"
});

const wallet = await near.inspect("agent.near", "ed25519:PUBLIC_KEY");
const decision = await near.checkCounterparty({
  agentAccount: "agent.near",
  receiver: "vendor.near",
  amount: "5",
  allowedRecipients: ["vendor.near"],
  strictRecipients: true,
  maxAmount: "10",
  allowedMethods: ["transfer"],
  method: "transfer"
});

// `enforceDecision` throws on BLOCK and requires an `onWarn` callback.
// The return value is advisory until the caller's signing path independently
// enforces the owner mandate through a reviewed on-chain Gate/custody policy.
await near.enforceDecision({ /* same check input */ }, {
  onWarn: async (result) => askHuman(result)
});
```

Never put a seed phrase, private key or signing credential in this SDK. The current API prototype is not production-authenticated; see `docs/PRODUCTION-PLAN.md` before exposing it publicly.


## Guarded Gate execution (Track 06)

`executeThroughGate()` is the agent-side execution wrapper. It:

1. asks the Nearmark API for `ALLOW`, `WARN` or `BLOCK`;
2. refuses `BLOCK` and requires an explicit `onWarn` approval for `WARN`;
3. inspects the agent public key and requires one FunctionCall key scoped only to the configured Gate account and `execute_payment` method;
4. reads the Gate's live on-chain status, verifies the agent identity, pause state, recipient allowlist, per-payment cap and remaining daily budget;
5. converts the approved NEAR amount to exact yoctoNEAR without floating-point arithmetic;
6. submits the exact recipient, amount, current nonce and short expiry through the supplied Gate adapter.

The adapter is intentionally supplied by the integration so this SDK does not hold keys. Its `executePayment(args)` MUST call only the configured Gate contract's `execute_payment` method using the restricted FunctionCall signer. It MUST NOT perform a direct transfer to the receiver. The Gate contract independently rechecks its policy on-chain.

```ts
const result = await near.executeThroughGate({
  agentAccount: 'agent.testnet',
  agentPublicKey: 'ed25519:YOUR_PUBLIC_KEY',
  receiver: 'vendor.testnet',
  amount: '0.005',
  method: 'transfer',
  allowedRecipients: ['vendor.testnet'],
  strictRecipients: true,
  maxAmount: '0.01',
  allowedMethods: ['transfer']
}, {
  gateAccountId: 'nearmark-gate.testnet',
  gate: gateAdapter,
  onWarn: async decision => askHumanToApprove(decision)
});
```

The Gate adapter must provide `accountId`, `getStatus()` and `executePayment(args)`. Never pass a Full Access signer. A FunctionCall gas allowance is not a token spending cap. The on-chain Gate enforces the actual recipient and spending limits. This SDK check is still not a security audit, and the service's API decision is not cryptographically attested.


### near-api-js v7 adapter

The SDK exports `createNearApiJsGateAdapter`. The application that owns the restricted signer constructs a `near-api-js` `Account` with that FunctionCall key and passes the Account object to the adapter. Keep the secret in a server-side secret store or a local environment variable; never send it to the browser or Nearmark API.

```js
import { Account, JsonRpcProvider } from 'near-api-js';
import { NearmarkClient, createNearApiJsGateAdapter } from '@nearmark/sdk';

const agentAccountId = process.env.NEARMARK_AGENT_ACCOUNT;
const gateAccountId = process.env.NEARMARK_GATE_ACCOUNT;
const provider = new JsonRpcProvider({ url: process.env.NEAR_RPC_URL });

// This key must be the registered FunctionCall key for Gate.execute_payment.
const agentSigner = new Account(
  agentAccountId,
  provider,
  process.env.NEARMARK_AGENT_FUNCTION_CALL_PRIVATE_KEY
);

const gate = createNearApiJsGateAdapter({
  account: agentSigner,
  provider,
  agentAccountId,
  gateAccountId,
});

const near = new NearmarkClient({ baseUrl: process.env.NEARMARK_API_URL });
const result = await near.executeThroughGate({
  agentAccount: agentAccountId,
  agentPublicKey: process.env.NEARMARK_AGENT_FUNCTION_CALL_PUBLIC_KEY,
  receiver: 'vendor.testnet',
  amount: '0.005',
  method: 'transfer',
  allowedRecipients: ['vendor.testnet'],
  strictRecipients: true,
  maxAmount: '0.01',
  allowedMethods: ['transfer'],
}, { gate, gateAccountId, onWarn: async decision => approveWithHuman(decision) });
```

`createNearApiJsGateAdapter` uses the provider only for `get_status`; its signer Account can only call `execute_payment` on the configured Gate and always sends zero attached deposit. The on-chain Gate transfers the approved amount from its separately funded balance. The caller must provision and rotate the FunctionCall key safely and ensure its gas allowance is adequate. This adapter is a code-level convenience, not proof of the supplied Account's private key; the NEAR protocol and Gate contract remain the final enforcement layers.

## Authority Shadow and ecosystem adapters

```js
const shadow = await client.authorityShadow('agent.near', 'ed25519:...');
const hypotheses = await client.nearAiRedAnalysis('Generate defensive hypotheses for this authorized test scope.');
const services = await client.listAgentMarketServices('security');
const tokens = await client.listNearIntentsTokens();
```

NEAR AI RED output is hypothesis generation only; execute accepted scenarios in an isolated Sandbox. Agent Market service discovery is read-only; creating jobs can spend escrow. NEAR Intents token and quote-preview routes are mainnet-only and do not submit deposits.
