use anyhow::Result;
use near_workspaces::{
    types::{AccessKey, KeyType, NearToken, SecretKey},
    Account,
};
use serde_json::{json, Value};
use std::time::{SystemTime, UNIX_EPOCH};

const FIRST_PAYMENT: u128 = 5_000_000_000_000_000_000_000;
const MAX_PAYMENT: u128 = 15_000_000_000_000_000_000_000;
const DAILY_LIMIT: u128 = 20_000_000_000_000_000_000_000;

fn payment(receiver: &str, nonce: u64, amount: u128) -> Value {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock must be valid")
        .as_nanos() as u64;

    json!({
        "receiver_id": receiver,
        "amount_yocto": amount.to_string(),
        "nonce": nonce.to_string(),
        "expires_at_ns": now.saturating_add(120_000_000_000).to_string(),
        "memo": "NEARMARK NASB security test"
    })
}

async fn assert_contract_rejected(
    result: near_workspaces::Result<near_workspaces::result::ExecutionFinalResult>,
    label: &str,
) -> Result<()> {
    match result {
        Ok(outcome) => {
            let failure = outcome.into_result().err().ok_or_else(|| {
                anyhow::anyhow!("SECURITY FAILURE: {} unexpectedly succeeded.", label)
            })?;

            let diagnostic = format!("{failure:#?}\n{failure}");
            let lower = diagnostic.to_lowercase();

            if !lower.contains("panicked") {
                return Err(anyhow::anyhow!(
                    "UNVERIFIED REJECTION for '{}'. Expected an on-chain contract panic:\n{}",
                    label,
                    diagnostic
                ));
            }

            println!("PASS: {} [on-chain contract panic]", label);
            Ok(())
        }
        Err(error) => Err(anyhow::anyhow!(
            "NOT COUNTED as a security pass: {}. Transaction/broadcast error:\n{error:#?}",
            label
        )),
    }
}

async fn assert_protocol_rejected(
    result: near_workspaces::Result<near_workspaces::result::ExecutionFinalResult>,
    label: &str,
    expected_reason: &str,
) -> Result<()> {
    let error = match result {
        Err(error) => error,
        Ok(outcome) => {
            let failure = outcome.into_result().err().ok_or_else(|| {
                anyhow::anyhow!("SECURITY FAILURE: {} unexpectedly succeeded.", label)
            })?;

            return Err(anyhow::anyhow!(
                "Expected protocol rejection '{}' for '{}', but got an on-chain failure:\n{failure:#?}",
                expected_reason,
                label
            ));
        }
    };

    let diagnostic = format!("{error:#?}\n{error}");

    if !diagnostic.contains(expected_reason) {
        return Err(anyhow::anyhow!(
            "WRONG FAILURE for '{}'. Expected '{}':\n{}",
            label,
            expected_reason,
            diagnostic
        ));
    }

    println!("PASS: {} [{}]", label, expected_reason);
    Ok(())
}

#[tokio::test]
async fn gate_enforces_real_agent_payment_permissions() -> Result<()> {
    println!("\n======================================");
    println!(" NEARMARK GATE SECURITY INTEGRATION");
    println!("======================================");

    // 1. Start isolated Sandbox.
    let worker = near_workspaces::sandbox().await?;

    println!("PASS: Local NEAR Sandbox started.");

    // 2. Create independent accounts.
    let owner = worker.dev_create_account().await?;
    let agent = worker.dev_create_account().await?;
    let vendor = worker.dev_create_account().await?;
    let attacker = worker.dev_create_account().await?;

    println!("PASS: Owner, agent, vendor and attacker created.");

    // 3. Deploy the compiled Gate.
    let wasm_path = std::env::var("NEARMARK_GATE_WASM")?;
    let wasm = std::fs::read(&wasm_path)?;

    let gate = worker.dev_deploy(&wasm).await?;

    println!("PASS: Gate deployed: {}", gate.id());

    // 4. Create a separate Function Call signing key.
    let agent_secret = SecretKey::from_random(KeyType::ED25519);
    let agent_public = agent_secret.public_key();
    let agent_public_text = agent_public.to_string();

    // 5. Owner of the agent account installs the restricted key.
    let add_key = agent
        .batch(agent.id())
        .add_key(
            agent_public.clone(),
            AccessKey::function_call_access(
                gate.id(),
                &["execute_payment"],
                Some(NearToken::from_near(15)),
            ),
        )
        .transact()
        .await?;

    add_key.into_result()?;

    println!("PASS: Function Call key installed.");

    // Use ONLY the restricted key for subsequent agent operations.
    let restricted_agent = Account::from_secret_key(agent.id().clone(), agent_secret, &worker);

    // 6. Initialize the Gate with the real restricted public key.
    let initialization = owner
        .call(gate.id(), "new")
        .args_json(json!({
            "owner_id": owner.id(),
            "agent_id": agent.id(),
            "agent_public_key": agent_public_text,
            "allowed_receivers": [vendor.id()],
            "max_payment_yocto": MAX_PAYMENT.to_string(),
            "daily_limit_yocto": DAILY_LIMIT.to_string()
        }))
        .max_gas()
        .transact()
        .await?;

    initialization.into_result()?;

    println!("PASS: Gate initialized with restricted agent identity.");

    // 7. Fund the Gate's dedicated payment budget.
    let funding = owner
        .transfer_near(gate.id(), NearToken::from_near(1))
        .await?;

    funding.into_result()?;

    println!("PASS: Gate received its isolated test budget.");

    // 8. Record vendor balance before payment.
    let vendor_before = vendor.view_account().await?.balance.as_yoctonear();

    // 9. Execute a legitimate payment with the restricted key.
    let valid_payment = restricted_agent
        .call(gate.id(), "execute_payment")
        .args_json(payment(&vendor.id().to_string(), 0, FIRST_PAYMENT))
        .max_gas()
        .transact()
        .await?;

    valid_payment.into_result()?;

    println!("PASS: Restricted agent executed approved vendor payment.");

    let vendor_after = vendor.view_account().await?.balance.as_yoctonear();

    assert_eq!(
        vendor_after - vendor_before,
        FIRST_PAYMENT,
        "Vendor did not receive the expected payment."
    );

    println!("PASS: Actual vendor balance increased by the authorised amount.");

    // 10. Read Gate state.
    let mut status: Value = gate.call("get_status").view().await?.json()?;

    assert_eq!(status["next_nonce"].as_str(), Some("1"));
    assert_eq!(
        status["spent_today_yocto"].as_str(),
        Some(FIRST_PAYMENT.to_string().as_str())
    );

    println!("PASS: Gate state and first payment reservation verified.");

    // 11. Prompt injection: substitute an unapproved recipient.
    let wrong_receiver = restricted_agent
        .call(gate.id(), "execute_payment")
        .args_json(payment(&attacker.id().to_string(), 1, FIRST_PAYMENT))
        .max_gas()
        .transact()
        .await;

    assert_contract_rejected(
        wrong_receiver,
        "Prompt-injected attacker recipient rejected",
    )
    .await?;

    // 12. Replay an already consumed nonce.
    let replay = restricted_agent
        .call(gate.id(), "execute_payment")
        .args_json(payment(&vendor.id().to_string(), 0, FIRST_PAYMENT))
        .max_gas()
        .transact()
        .await;

    assert_contract_rejected(replay, "Replayed payment authorization rejected").await?;

    // 13. Exceed the per-payment limit.
    let oversized = restricted_agent
        .call(gate.id(), "execute_payment")
        .args_json(payment(&vendor.id().to_string(), 1, MAX_PAYMENT + 1))
        .max_gas()
        .transact()
        .await;

    assert_contract_rejected(oversized, "Per-payment limit enforced").await?;

    // 14. Spend exactly the remaining daily allowance.
    let second_payment = restricted_agent
        .call(gate.id(), "execute_payment")
        .args_json(payment(&vendor.id().to_string(), 1, MAX_PAYMENT))
        .max_gas()
        .transact()
        .await?;

    second_payment.into_result()?;

    println!("PASS: Payment at the exact remaining daily allowance accepted.");

    // 15. Attempt to exceed daily allowance by one yoctoNEAR.
    let daily_attack = restricted_agent
        .call(gate.id(), "execute_payment")
        .args_json(payment(&vendor.id().to_string(), 2, 1))
        .max_gas()
        .transact()
        .await;

    assert_contract_rejected(daily_attack, "Daily spending limit enforced").await?;

    // 16. Attempt to call a method not in the Function Call key scope.
    let unauthorized_method = restricted_agent
        .call(gate.id(), "set_paused")
        .args_json(json!({"paused": true}))
        .max_gas()
        .transact()
        .await;

    assert_protocol_rejected(
        unauthorized_method,
        "Unauthorized contract method blocked",
        "MethodNameMismatch",
    )
    .await?;

    // 17. Attempt a direct transfer with the Function Call key.
    let direct_transfer = restricted_agent
        .transfer_near(attacker.id(), NearToken::from_yoctonear(1))
        .await;

    assert_protocol_rejected(
        direct_transfer,
        "Direct transfer blocked for restricted Function Call key",
        "RequiresFullAccess",
    )
    .await?;

    // 18. Owner emergency pause.
    let pause = owner
        .call(gate.id(), "set_paused")
        .args_json(json!({"paused": true}))
        .max_gas()
        .transact()
        .await?;

    pause.into_result()?;

    let paused_payment = restricted_agent
        .call(gate.id(), "execute_payment")
        .args_json(payment(&vendor.id().to_string(), 2, 1))
        .max_gas()
        .transact()
        .await;

    assert_contract_rejected(paused_payment, "Emergency pause blocked agent payment").await?;

    status = gate.call("get_status").view().await?.json()?;

    assert_eq!(status["paused"], true);
    assert_eq!(status["next_nonce"].as_str(), Some("2"));

    println!("PASS: Final Gate state verified.");

    println!("\n======================================");
    println!(" NEARMARK GATE SECURITY TESTS PASSED");
    println!("======================================");

    println!("Approved payments: 2");
    println!("Rejected attack attempts: 7");
    println!("Function Call key: restricted to Gate.execute_payment");
    println!("Direct transfers: protocol-rejected");
    println!("Network: isolated local Sandbox");
    println!("No Testnet or Mainnet deployment performed.");

    Ok(())
}
