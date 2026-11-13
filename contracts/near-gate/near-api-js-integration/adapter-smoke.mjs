import assert from "node:assert/strict";

import {
  Account,
  JsonRpcProvider,
  KeyPair
} from "near-api-js";

import {
  createNearApiJsGateAdapter
} from "../../../packages/sdk/index.mjs";

assert.equal(typeof Account, "function");
assert.equal(typeof JsonRpcProvider, "function");
assert.equal(typeof KeyPair.fromRandom, "function");

const key = KeyPair.fromRandom("ed25519");

const provider = new JsonRpcProvider({
  url: "https://test.rpc.fastnear.com"
});

const account = new Account(
  "agent.testnet",
  provider,
  key.toString()
);

assert.equal(typeof account.callFunction, "function");
assert.equal(typeof provider.callFunction, "function");

const readCalls = [];
const writeCalls = [];

const mockAccount = {
  accountId: "agent.testnet",
  async callFunction(args) {
    writeCalls.push(args);
    return { success: true };
  }
};

const mockProvider = {
  async callFunction(args) {
    readCalls.push(args);
    return {
      paused: false,
      agent_id: "agent.testnet"
    };
  }
};

const adapter = createNearApiJsGateAdapter({
  account: mockAccount,
  provider: mockProvider,
  agentAccountId: "agent.testnet",
  gateAccountId: "nearmark-gate.testnet"
});

await adapter.getStatus();

await adapter.executePayment({
  receiver_id: "vendor.testnet",
  amount_yocto: "5000000000000000000000",
  nonce: "0",
  expires_at_ns: "9999999999999999999",
  memo: "NEARMARK integration test"
});

assert.equal(readCalls[0].method, "get_status");
assert.equal(writeCalls[0].contractId, "nearmark-gate.testnet");
assert.equal(writeCalls[0].methodName, "execute_payment");
assert.equal(writeCalls[0].deposit, 0n);

console.log("PASS: near-api-js v7 integration.");
console.log("PASS: Gate adapter.");
console.log("PASS: Fixed contract target.");
console.log("PASS: Restricted execution method.");
console.log("PASS: Zero attached deposit.");
console.log("No live transaction submitted.");
