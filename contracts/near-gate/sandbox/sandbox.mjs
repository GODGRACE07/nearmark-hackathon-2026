import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "near-workspaces";

const HERE = dirname(fileURLToPath(import.meta.url));

const WASM = resolve(
  HERE,
  "../target/wasm32-unknown-unknown/release/nearmark_gate.wasm"
);

const YOCTO = 10n ** 24n;

const AMOUNT = (15n * YOCTO / 1000n).toString();
const SMALL_AMOUNT = (YOCTO / 100n).toString();
const OVER_LIMIT = (YOCTO / 50n).toString();
const DAILY_LIMIT = (YOCTO * 2n / 100n).toString();

let worker;

function payment(receiver, nonce, amount = AMOUNT) {
  return {
    receiver_id: receiver.accountId,
    amount_yocto: amount,
    nonce: String(nonce),
    expires_at_ns: (
      BigInt(Date.now()) * 1000000n +
      120000000000n
    ).toString(),
    memo: "NEARMARK SANDBOX SECURITY TEST"
  };
}


async function executeAsAgent(agent, gate, args, keyPair) {
  return agent.call(
    gate,
    "execute_payment",
    args,
    { signWithKey: keyPair }
  );
}

async function expectBlocked(label, operation) {
  let failed = false;

  try {
    await operation();
  } catch (error) {
    failed = true;
    console.log(`PASS: ${label}`);
  }

  assert.equal(
    failed,
    true,
    `${label}: the unsafe transaction was unexpectedly accepted`
  );
}

async function status(gate) {
  return await gate.view("get_status", {});
}

async function main() {
  console.log("\n======================================");
  console.log("     NEARMARK REAL SANDBOX TESTS");
  console.log("======================================");

  assert.ok(WASM, "WASM path missing");

  const { access } = await import("node:fs/promises");
  await access(WASM);

  console.log("Compiled Gate WASM found.");

  // Start an isolated local NEAR blockchain.
  worker = await Worker.init();

  const root = worker.rootAccount;

  console.log("Local NEAR Sandbox started.");

  // Create independent test accounts.
  const owner = await root.createSubAccount("owner");
  const agent = await root.createSubAccount("agent");
  const vendor = await root.createSubAccount("vendor");
  const attacker = await root.createSubAccount("attacker");

  console.log("Owner, agent, vendor and attacker accounts created.");

  // Deploy the contract to a fresh account.
  const gate = await root.devDeploy(WASM);

  console.log("Gate deployed:", gate.accountId);

  // near-workspaces v5 exposes the account signing key through getKey().
  const agentKeyPair = await agent.getKey();

  assert.ok(
    agentKeyPair,
    "Sandbox agent signing key was not found in the local key store."
  );

  const agentPublicKey = agentKeyPair.getPublicKey().toString();

  // Verify that this exact key is installed on the Sandbox account.
  const keyList = await agent.viewAccessKeys(agent.accountId);

  const matchingKey = keyList.keys.find(
    key => key.public_key === agentPublicKey
  );

  assert.ok(
    matchingKey,
    "The agent signing key is not installed on its Sandbox account."
  );

  assert.equal(
    matchingKey.access_key.permission,
    "FullAccess",
    "Expected the initial isolated Sandbox test key to be Full Access."
  );

  console.log("Sandbox agent signing key verified.");

  console.log("Sandbox agent signing key identified.");

  // Initialize the Gate from its designated owner.
  await owner.call(gate, "new", {
    owner_id: owner.accountId,
    agent_id: agent.accountId,
    agent_public_key: agentPublicKey,
    allowed_receivers: [vendor.accountId],
    max_payment_yocto: AMOUNT,
    daily_limit_yocto: DAILY_LIMIT
  });

  console.log("PASS: Owner successfully initialized Gate.");

  let current = await status(gate);

  assert.equal(current.paused, false);
  assert.equal(String(current.next_nonce), "0");

  console.log("PASS: Gate initial state verified.");

  // TEST 1: A legitimate vendor payment.
  await executeAsAgent(agent, gate, payment(vendor, 0), agentKeyPair);

  current = await status(gate);

  assert.equal(String(current.next_nonce), "1");
  assert.equal(String(current.spent_today_yocto), AMOUNT);

  console.log("PASS: Approved vendor payment executed.");
  console.log("PASS: Daily payment reservation confirmed.");

  // TEST 2: Prompt-injected recipient substitution.
  await expectBlocked(
    "Prompt-injected attacker recipient rejected",
    () => executeAsAgent(agent, gate, payment(attacker, 1, SMALL_AMOUNT), agentKeyPair)
  );

  current = await status(gate);
  assert.equal(String(current.next_nonce), "1");

  console.log("PASS: Rejected attack did not consume nonce.");

  // TEST 3: Replay an already-consumed nonce.
  await expectBlocked(
    "Replayed authorization rejected",
    () => executeAsAgent(agent, gate, payment(vendor, 0, SMALL_AMOUNT), agentKeyPair)
  );

  // TEST 4: Per-payment spending limit.
  await expectBlocked(
    "Payment above owner limit rejected",
    () => executeAsAgent(agent, gate, payment(vendor, 1, OVER_LIMIT), agentKeyPair)
  );

  // TEST 5: Daily spending limit.
  await expectBlocked(
    "Daily spending limit enforced",
    () => executeAsAgent(agent, gate, payment(vendor, 1, SMALL_AMOUNT), agentKeyPair)
  );

  // TEST 6: Emergency pause.
  await owner.call(gate, "set_paused", {
    paused: true
  });

  await expectBlocked(
    "Emergency pause blocks agent payments",
    () => executeAsAgent(agent, gate, payment(vendor, 1, SMALL_AMOUNT), agentKeyPair)
  );

  current = await status(gate);

  assert.equal(current.paused, true);
  assert.equal(String(current.next_nonce), "1");

  console.log("\n======================================");
  console.log("     SANDBOX TESTS PASSED");
  console.log("======================================");

  console.log("Gate account:", gate.accountId);
  console.log("Agent account:", agent.accountId);
  console.log("Vendor account:", vendor.accountId);

  console.log("Tests passed: 9");
  console.log("Failed: 0");

  console.log(
    "\nIMPORTANT: These tests use an isolated Sandbox Full Access test key."
  );

  console.log(
    "They do not yet prove protocol-level FunctionCall key restrictions."
  );
}

try {
  await main();
} catch (error) {
  console.error("\nSANDBOX TEST FAILED:");
  console.error(error.stack || error);
  process.exitCode = 1;
} finally {
  if (worker) {
    await worker.tearDown().catch(error => {
      console.error("Sandbox shutdown warning:", error.message);
    });
  }
}
