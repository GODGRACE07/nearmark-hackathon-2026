use near_sdk::json_types::{U128, U64};
use near_sdk::serde::Serialize;
use near_sdk::{env, near, AccountId, Gas, NearToken, PanicOnDefault, Promise};

const NANOS_PER_DAY: u64 = 86_400_000_000_000;
const MAX_PERMIT_TTL_NS: u64 = 300_000_000_000; // five minutes
const CALLBACK_GAS_TGAS: u64 = 10;
const MAX_ALLOWED_RECEIVERS: usize = 64;
const MAX_MEMO_BYTES: usize = 160;

/// NEARMARK Gate v0.1.
///
/// This contract intentionally supports native NEAR transfers only. It is a
/// hard on-chain boundary for a dedicated, funded Gate account. It is not a
/// general-purpose arbitrary-call router and does not custody the owner's
/// primary wallet.
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct NearmarkGate {
    owner_id: AccountId,
    agent_id: AccountId,
    agent_public_key: String,
    allowed_receivers: Vec<AccountId>,
    max_payment_yocto: u128,
    daily_limit_yocto: u128,
    spent_today_yocto: u128,
    current_day: u64,
    next_nonce: u64,
    policy_version: u64,
    paused: bool,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct GateStatus {
    pub owner_id: AccountId,
    pub agent_id: AccountId,
    pub agent_public_key: String,
    pub allowed_receivers: Vec<AccountId>,
    pub max_payment_yocto: U128,
    pub daily_limit_yocto: U128,
    pub spent_today_yocto: U128,
    pub current_day: U64,
    pub next_nonce: U64,
    pub policy_version: U64,
    pub paused: bool,
}

#[near]
impl NearmarkGate {
    /// Initialize from the owner account. The caller must be the declared
    /// owner, preventing an unrelated account from front-running init.
    #[init]
    #[deny_unknown_arguments]
    pub fn new(
        owner_id: AccountId,
        agent_id: AccountId,
        agent_public_key: String,
        allowed_receivers: Vec<AccountId>,
        max_payment_yocto: U128,
        daily_limit_yocto: U128,
    ) -> Self {
        assert_eq!(
            env::predecessor_account_id(),
            owner_id,
            "only the declared owner may initialize the Gate"
        );
        assert!(
            !agent_public_key.trim().is_empty(),
            "agent public key is required"
        );
        assert!(
            agent_public_key.len() <= 128,
            "agent public key is too long"
        );
        Self::validate_policy(&allowed_receivers, max_payment_yocto.0, daily_limit_yocto.0);

        let now_day = env::block_timestamp() / NANOS_PER_DAY;
        Self {
            owner_id,
            agent_id,
            agent_public_key,
            allowed_receivers,
            max_payment_yocto: max_payment_yocto.0,
            daily_limit_yocto: daily_limit_yocto.0,
            spent_today_yocto: 0,
            current_day: now_day,
            next_nonce: 0,
            policy_version: 1,
            paused: false,
        }
    }

    /// Agent entry point. The caller account AND signing public key must match
    /// the one configured by the owner. Install that key on the agent account
    /// as a FunctionCall key scoped only to this Gate account and this method.
    ///
    /// The Gate reserves the daily budget and consumes the nonce atomically
    /// before scheduling the transfer. If the transfer receipt fails, a
    /// private callback releases the daily reservation; the nonce remains
    /// consumed to prevent replay.
    #[deny_unknown_arguments]
    pub fn execute_payment(
        &mut self,
        receiver_id: AccountId,
        amount_yocto: U128,
        nonce: U64,
        expires_at_ns: U64,
        memo: Option<String>,
    ) -> Promise {
        assert_eq!(
            env::attached_deposit().as_yoctonear(),
            0,
            "attached deposit is not accepted"
        );
        assert!(!self.paused, "Gate is paused");
        assert_eq!(
            env::predecessor_account_id(),
            self.agent_id,
            "unauthorized agent account"
        );
        assert_eq!(
            env::signer_account_id(),
            self.agent_id,
            "agent signer account mismatch"
        );
        assert_eq!(
            env::signer_account_pk().to_string(),
            self.agent_public_key,
            "unauthorized agent key"
        );
        assert!(
            self.allowed_receivers.contains(&receiver_id),
            "recipient is not owner-approved"
        );
        assert!(
            amount_yocto.0 > 0,
            "payment amount must be greater than zero"
        );
        assert!(
            amount_yocto.0 <= self.max_payment_yocto,
            "per-payment limit exceeded"
        );
        assert_eq!(nonce.0, self.next_nonce, "invalid or replayed nonce");

        let now = env::block_timestamp();
        assert!(expires_at_ns.0 > now, "payment authorization has expired");
        assert!(
            expires_at_ns.0 <= now.saturating_add(MAX_PERMIT_TTL_NS),
            "payment authorization expiry is too far in the future"
        );

        let day = now / NANOS_PER_DAY;
        if day != self.current_day {
            self.current_day = day;
            self.spent_today_yocto = 0;
        }

        let new_spend = self
            .spent_today_yocto
            .checked_add(amount_yocto.0)
            .expect("daily spending arithmetic overflow");
        assert!(
            new_spend <= self.daily_limit_yocto,
            "daily spending limit exceeded"
        );

        if let Some(text) = memo.as_ref() {
            assert!(text.len() <= MAX_MEMO_BYTES, "memo is too long");
        }

        self.spent_today_yocto = new_spend;
        self.next_nonce = self.next_nonce.checked_add(1).expect("nonce exhausted");

        Self::emit_event(
            "payment_authorized",
            near_sdk::serde_json::json!({
                "agent_id": self.agent_id,
                "receiver_id": receiver_id,
                "amount_yocto": amount_yocto.0.to_string(),
                "nonce": nonce.0,
                "policy_version": self.policy_version,
                "day": day
            }),
        );

        let callback_args = near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({
            "amount_yocto": amount_yocto,
            "reservation_day": day,
            "nonce": nonce
        }))
        .expect("callback arguments must serialize");

        let callback = Promise::new(env::current_account_id()).function_call(
            "on_transfer_complete".to_string(),
            callback_args,
            NearToken::from_yoctonear(0),
            Gas::from_tgas(CALLBACK_GAS_TGAS),
        );

        Promise::new(receiver_id)
            .transfer(NearToken::from_yoctonear(amount_yocto.0))
            .then(callback)
    }

    /// Owner-only policy replacement. Empty recipient lists are rejected so
    /// the Gate cannot accidentally become an unrestricted payment router.
    #[deny_unknown_arguments]
    pub fn update_policy(
        &mut self,
        allowed_receivers: Vec<AccountId>,
        max_payment_yocto: U128,
        daily_limit_yocto: U128,
    ) {
        self.assert_owner();
        Self::validate_policy(&allowed_receivers, max_payment_yocto.0, daily_limit_yocto.0);
        self.allowed_receivers = allowed_receivers;
        self.max_payment_yocto = max_payment_yocto.0;
        self.daily_limit_yocto = daily_limit_yocto.0;
        self.policy_version = self
            .policy_version
            .checked_add(1)
            .expect("policy version exhausted");
        Self::emit_event(
            "policy_updated",
            near_sdk::serde_json::json!({ "policy_version": self.policy_version }),
        );
    }

    /// Owner-only agent rotation. The replacement key must also be installed
    /// on the agent account as a Gate-scoped FunctionCall key.
    #[deny_unknown_arguments]
    pub fn rotate_agent(&mut self, agent_id: AccountId, agent_public_key: String) {
        self.assert_owner();
        assert!(
            !agent_public_key.trim().is_empty(),
            "agent public key is required"
        );
        assert!(
            agent_public_key.len() <= 128,
            "agent public key is too long"
        );
        self.agent_id = agent_id;
        self.agent_public_key = agent_public_key;
        // Keep the nonce monotonic across agent rotations; never reopen an old nonce.
        self.policy_version = self
            .policy_version
            .checked_add(1)
            .expect("policy version exhausted");
        Self::emit_event(
            "agent_rotated",
            near_sdk::serde_json::json!({ "agent_id": self.agent_id, "policy_version": self.policy_version }),
        );
    }

    #[deny_unknown_arguments]
    pub fn set_paused(&mut self, paused: bool) {
        self.assert_owner();
        self.paused = paused;
        self.policy_version = self
            .policy_version
            .checked_add(1)
            .expect("policy version exhausted");
        Self::emit_event(
            "gate_pause_changed",
            near_sdk::serde_json::json!({ "paused": paused, "policy_version": self.policy_version }),
        );
    }

    /// Public view. The public key is not a secret; no private credentials are
    /// stored by this contract.
    pub fn get_status(&self) -> GateStatus {
        GateStatus {
            owner_id: self.owner_id.clone(),
            agent_id: self.agent_id.clone(),
            agent_public_key: self.agent_public_key.clone(),
            allowed_receivers: self.allowed_receivers.clone(),
            max_payment_yocto: U128(self.max_payment_yocto),
            daily_limit_yocto: U128(self.daily_limit_yocto),
            spent_today_yocto: U128(self.spent_today_yocto),
            current_day: U64(self.current_day),
            next_nonce: U64(self.next_nonce),
            policy_version: U64(self.policy_version),
            paused: self.paused,
        }
    }

    /// Internal transfer callback. On a failed transfer, release the reserved
    /// daily amount if the reservation is still in today's bucket. The nonce
    /// intentionally stays consumed.
    #[private]
    #[deny_unknown_arguments]
    pub fn on_transfer_complete(
        &mut self,
        amount_yocto: U128,
        reservation_day: u64,
        nonce: U64,
    ) -> bool {
        match env::promise_result_checked(0, 0) {
            Ok(_) => {
                Self::emit_event(
                    "payment_settled",
                    near_sdk::serde_json::json!({ "amount_yocto": amount_yocto.0.to_string(), "nonce": nonce.0 }),
                );
                true
            }
            Err(_) => {
                if self.current_day == reservation_day {
                    self.spent_today_yocto = self.spent_today_yocto.saturating_sub(amount_yocto.0);
                }
                Self::emit_event(
                    "payment_failed",
                    near_sdk::serde_json::json!({ "amount_yocto": amount_yocto.0.to_string(), "nonce": nonce.0 }),
                );
                false
            }
        }
    }
}

impl NearmarkGate {
    fn assert_owner(&self) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner_id,
            "only the owner may change Gate policy"
        );
    }

    fn validate_policy(receivers: &[AccountId], max_payment: u128, daily_limit: u128) {
        assert!(
            !receivers.is_empty(),
            "at least one approved receiver is required"
        );
        assert!(
            receivers.len() <= MAX_ALLOWED_RECEIVERS,
            "too many approved receivers"
        );
        assert!(
            max_payment > 0,
            "per-payment limit must be greater than zero"
        );
        assert!(
            daily_limit >= max_payment,
            "daily limit must be at least the per-payment limit"
        );
        for (index, receiver) in receivers.iter().enumerate() {
            assert!(
                !receivers[..index].contains(receiver),
                "duplicate approved receiver"
            );
        }
    }

    fn emit_event(event: &str, data: near_sdk::serde_json::Value) {
        env::log_str(&format!(
            "EVENT_JSON:{}",
            near_sdk::serde_json::json!({
                "standard": "nearmark_gate",
                "version": "1.0.0",
                "event": event,
                "data": [data]
            })
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::{testing_env, PublicKey};
    use std::str::FromStr;

    const NOW: u64 = 1_800_000_000_000_000_000;
    const OWNER_KEY: &str = "ed25519:11111111111111111111111111111111";
    const AGENT_KEY: &str = "ed25519:11111111111111111111111111111112";
    const OTHER_KEY: &str = "ed25519:11111111111111111111111111111113";

    fn account(value: &str) -> AccountId {
        AccountId::from_str(value).unwrap()
    }

    fn set_context(predecessor: &str, signer: &str, public_key: &str, timestamp: u64) {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(account("gate.testnet"))
            .predecessor_account_id(account(predecessor))
            .signer_account_id(account(signer))
            .signer_account_pk(PublicKey::from_str(public_key).unwrap())
            .block_timestamp(timestamp);
        testing_env!(builder.build());
    }

    fn new_gate() -> NearmarkGate {
        set_context("owner.testnet", "owner.testnet", OWNER_KEY, NOW);
        NearmarkGate::new(
            account("owner.testnet"),
            account("agent.testnet"),
            AGENT_KEY.to_string(),
            vec![account("vendor.testnet")],
            U128(10),
            U128(25),
        )
    }

    fn invoke(gate: &mut NearmarkGate, receiver: &str, amount: u128, nonce: u64) {
        set_context("agent.testnet", "agent.testnet", AGENT_KEY, NOW);
        let _promise = gate.execute_payment(
            account(receiver),
            U128(amount),
            U64(nonce),
            U64(NOW + 60_000_000_000),
            Some("NASB sandbox scenario".to_string()),
        );
    }

    #[test]
    fn owner_can_initialize_and_status_is_readable() {
        let gate = new_gate();
        let status = gate.get_status();
        assert_eq!(status.owner_id, account("owner.testnet"));
        assert_eq!(status.agent_id, account("agent.testnet"));
        assert_eq!(status.allowed_receivers, vec![account("vendor.testnet")]);
        assert_eq!(status.max_payment_yocto, U128(10));
        assert_eq!(status.daily_limit_yocto, U128(25));
        assert_eq!(status.next_nonce, U64(0));
        assert!(!status.paused);
    }

    #[test]
    #[should_panic(expected = "only the declared owner may initialize the Gate")]
    fn unrelated_account_cannot_front_run_initialization() {
        set_context("attacker.testnet", "attacker.testnet", OTHER_KEY, NOW);
        NearmarkGate::new(
            account("owner.testnet"),
            account("agent.testnet"),
            AGENT_KEY.to_string(),
            vec![account("vendor.testnet")],
            U128(10),
            U128(25),
        );
    }

    #[test]
    fn approved_payment_consumes_nonce_and_daily_budget() {
        let mut gate = new_gate();
        invoke(&mut gate, "vendor.testnet", 7, 0);
        let status = gate.get_status();
        assert_eq!(status.next_nonce, U64(1));
        assert_eq!(status.spent_today_yocto, U128(7));
    }

    #[test]
    #[should_panic(expected = "recipient is not owner-approved")]
    fn prompt_injected_recipient_substitution_is_blocked() {
        let mut gate = new_gate();
        invoke(&mut gate, "attacker.testnet", 5, 0);
    }

    #[test]
    #[should_panic(expected = "per-payment limit exceeded")]
    fn per_payment_limit_is_enforced() {
        let mut gate = new_gate();
        invoke(&mut gate, "vendor.testnet", 11, 0);
    }

    #[test]
    #[should_panic(expected = "daily spending limit exceeded")]
    fn daily_limit_is_enforced_across_sequential_calls() {
        let mut gate = new_gate();
        invoke(&mut gate, "vendor.testnet", 10, 0);
        invoke(&mut gate, "vendor.testnet", 10, 1);
        invoke(&mut gate, "vendor.testnet", 10, 2);
    }

    #[test]
    #[should_panic(expected = "invalid or replayed nonce")]
    fn consumed_nonce_cannot_be_replayed() {
        let mut gate = new_gate();
        invoke(&mut gate, "vendor.testnet", 5, 0);
        invoke(&mut gate, "vendor.testnet", 5, 0);
    }

    #[test]
    #[should_panic(expected = "unauthorized agent key")]
    fn another_key_on_agent_account_is_rejected() {
        let mut gate = new_gate();
        set_context("agent.testnet", "agent.testnet", OTHER_KEY, NOW);
        let _promise = gate.execute_payment(
            account("vendor.testnet"),
            U128(1),
            U64(0),
            U64(NOW + 60_000_000_000),
            None,
        );
    }

    #[test]
    #[should_panic(expected = "payment authorization has expired")]
    fn expired_authorization_is_rejected() {
        let mut gate = new_gate();
        set_context("agent.testnet", "agent.testnet", AGENT_KEY, NOW);
        let _promise = gate.execute_payment(
            account("vendor.testnet"),
            U128(1),
            U64(0),
            U64(NOW - 1),
            None,
        );
    }

    #[test]
    #[should_panic(expected = "Gate is paused")]
    fn paused_gate_rejects_agent_payments() {
        let mut gate = new_gate();
        set_context("owner.testnet", "owner.testnet", OWNER_KEY, NOW);
        gate.set_paused(true);
        invoke(&mut gate, "vendor.testnet", 1, 0);
    }
}
