use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::{U128, U64};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, AccountId, Gas, NearToken, PanicOnDefault, Promise};

const NANOS_PER_DAY: u64 = 86_400_000_000_000;
const MAX_PERMIT_TTL_NS: u64 = 300_000_000_000;
const MAX_TOKENS: usize = 8;
const MAX_RECEIVERS_PER_TOKEN: usize = 64;
const MAX_MEMO_BYTES: usize = 160;
const FT_TRANSFER_GAS_TGAS: u64 = 30;
const CALLBACK_GAS_TGAS: u64 = 15;

#[near_sdk::ext_contract(ext_fungible_token)]
pub trait FungibleToken {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Serialize)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct TokenPolicy {
    pub token_id: AccountId,
    pub allowed_receivers: Vec<AccountId>,
    pub max_payment: u128,
    pub daily_limit: u128,
    pub spent_today: u128,
    pub current_day: u64,
}

#[derive(Deserialize, near_sdk::serde::Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct TokenPolicyInput {
    pub token_id: AccountId,
    pub allowed_receivers: Vec<AccountId>,
    pub max_payment: U128,
    pub daily_limit: U128,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct TokenPolicyView {
    pub token_id: AccountId,
    pub allowed_receivers: Vec<AccountId>,
    pub max_payment: U128,
    pub daily_limit: U128,
    pub spent_today: U128,
    pub current_day: U64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct NearmarkFtGate {
    owner_id: AccountId,
    agent_id: AccountId,
    agent_public_key: String,
    token_policies: Vec<TokenPolicy>,
    next_nonce: u64,
    policy_version: u64,
    paused: bool,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct GateFtStatus {
    pub owner_id: AccountId,
    pub agent_id: AccountId,
    pub agent_public_key: String,
    pub token_policies: Vec<TokenPolicyView>,
    pub next_nonce: U64,
    pub policy_version: U64,
    pub paused: bool,
}

#[near]
impl NearmarkFtGate {
    /// Initialize a fresh FT Gate. The supplied tokens and recipients are the
    /// complete initial allowlist. The owner must separately register this Gate
    /// and each receiver with each NEP-141 token's storage management contract.
    #[init]
    #[deny_unknown_arguments]
    pub fn new(
        owner_id: AccountId,
        agent_id: AccountId,
        agent_public_key: String,
        token_policies: Vec<TokenPolicyInput>,
    ) -> Self {
        assert_eq!(
            env::predecessor_account_id(),
            owner_id,
            "only the declared owner may initialize the FT Gate"
        );
        Self::validate_agent_key(&agent_public_key);
        assert!(
            !token_policies.is_empty(),
            "at least one approved FT token policy is required"
        );
        assert!(
            token_policies.len() <= MAX_TOKENS,
            "too many FT token policies"
        );
        let day = env::block_timestamp() / NANOS_PER_DAY;
        let mut policies = Vec::with_capacity(token_policies.len());
        for policy in token_policies {
            Self::validate_token_policy(
                &policy.allowed_receivers,
                policy.max_payment.0,
                policy.daily_limit.0,
            );
            assert!(
                !policies
                    .iter()
                    .any(|p: &TokenPolicy| p.token_id == policy.token_id),
                "duplicate FT token policy"
            );
            policies.push(TokenPolicy {
                token_id: policy.token_id,
                allowed_receivers: policy.allowed_receivers,
                max_payment: policy.max_payment.0,
                daily_limit: policy.daily_limit.0,
                spent_today: 0,
                current_day: day,
            });
        }
        Self {
            owner_id,
            agent_id,
            agent_public_key,
            token_policies: policies,
            next_nonce: 0,
            policy_version: 1,
            paused: false,
        }
    }

    /// Restricted agent entry point. The agent FunctionCall key must be scoped
    /// to this Gate account and only this method. The Gate, not the agent, calls
    /// the token contract's ft_transfer method with the required 1 yoctoⓃ.
    #[deny_unknown_arguments]
    pub fn execute_ft_payment(
        &mut self,
        token_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
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
        self.assert_agent();
        assert!(amount.0 > 0, "payment amount must be greater than zero");
        assert_eq!(nonce.0, self.next_nonce, "invalid or replayed nonce");
        let now = env::block_timestamp();
        assert!(expires_at_ns.0 > now, "payment authorization has expired");
        assert!(
            expires_at_ns.0 <= now.saturating_add(MAX_PERMIT_TTL_NS),
            "payment authorization expiry is too far in the future"
        );
        if let Some(text) = memo.as_ref() {
            assert!(text.len() <= MAX_MEMO_BYTES, "memo is too long");
        }

        let day = now / NANOS_PER_DAY;
        let policy = self
            .token_policies
            .iter_mut()
            .find(|p| p.token_id == token_id)
            .expect("FT token is not owner-approved");
        assert!(
            policy.allowed_receivers.contains(&receiver_id),
            "FT recipient is not owner-approved"
        );
        assert!(
            amount.0 <= policy.max_payment,
            "FT per-payment limit exceeded"
        );
        if policy.current_day != day {
            policy.current_day = day;
            policy.spent_today = 0;
        }
        let new_spend = policy
            .spent_today
            .checked_add(amount.0)
            .expect("FT daily spending arithmetic overflow");
        assert!(
            new_spend <= policy.daily_limit,
            "FT daily spending limit exceeded"
        );

        // Reserve spend and consume nonce before the asynchronous token call.
        policy.spent_today = new_spend;
        self.next_nonce = self.next_nonce.checked_add(1).expect("nonce exhausted");
        Self::emit_event(
            "ft_payment_authorized",
            near_sdk::serde_json::json!({
                "agent_id": self.agent_id,
                "token_id": token_id,
                "receiver_id": receiver_id,
                "amount": amount.0.to_string(),
                "nonce": nonce.0,
                "policy_version": self.policy_version,
                "day": day,
                "attached_yocto": 1
            }),
        );

        let callback_args = near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({
            "token_id": token_id,
            "amount": amount,
            "reservation_day": day,
            "nonce": nonce
        }))
        .expect("callback arguments must serialize");
        let callback = Promise::new(env::current_account_id()).function_call(
            "on_ft_transfer_complete".to_string(),
            callback_args,
            NearToken::from_yoctonear(0),
            Gas::from_tgas(CALLBACK_GAS_TGAS),
        );
        ext_fungible_token::ext(token_id)
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(Gas::from_tgas(FT_TRANSFER_GAS_TGAS))
            .ft_transfer(receiver_id, amount, memo)
            .then(callback)
    }

    /// Owner-managed token policy. Replaces the entire recipient list and both
    /// spending limits for one exact token contract; never enables arbitrary FT calls.
    #[deny_unknown_arguments]
    pub fn update_token_policy(
        &mut self,
        token_id: AccountId,
        allowed_receivers: Vec<AccountId>,
        max_payment: U128,
        daily_limit: U128,
    ) {
        self.assert_owner();
        Self::validate_token_policy(&allowed_receivers, max_payment.0, daily_limit.0);
        if let Some(policy) = self
            .token_policies
            .iter_mut()
            .find(|p| p.token_id == token_id)
        {
            policy.allowed_receivers = allowed_receivers;
            policy.max_payment = max_payment.0;
            policy.daily_limit = daily_limit.0;
        } else {
            assert!(
                self.token_policies.len() < MAX_TOKENS,
                "FT token policy capacity reached"
            );
            self.token_policies.push(TokenPolicy {
                token_id,
                allowed_receivers,
                max_payment: max_payment.0,
                daily_limit: daily_limit.0,
                spent_today: 0,
                current_day: env::block_timestamp() / NANOS_PER_DAY,
            });
        }
        self.policy_version = self
            .policy_version
            .checked_add(1)
            .expect("policy version exhausted");
        Self::emit_event(
            "ft_policy_updated",
            near_sdk::serde_json::json!({ "policy_version": self.policy_version }),
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

    pub fn get_status(&self) -> GateFtStatus {
        GateFtStatus {
            owner_id: self.owner_id.clone(),
            agent_id: self.agent_id.clone(),
            agent_public_key: self.agent_public_key.clone(),
            token_policies: self
                .token_policies
                .iter()
                .map(|p| TokenPolicyView {
                    token_id: p.token_id.clone(),
                    allowed_receivers: p.allowed_receivers.clone(),
                    max_payment: U128(p.max_payment),
                    daily_limit: U128(p.daily_limit),
                    spent_today: U128(p.spent_today),
                    current_day: U64(p.current_day),
                })
                .collect(),
            next_nonce: U64(self.next_nonce),
            policy_version: U64(self.policy_version),
            paused: self.paused,
        }
    }

    /// On token-call failure the reservation is released in the same daily
    /// bucket. The nonce remains consumed even when the token call fails.
    #[private]
    #[deny_unknown_arguments]
    pub fn on_ft_transfer_complete(
        &mut self,
        token_id: AccountId,
        amount: U128,
        reservation_day: u64,
        nonce: U64,
    ) -> bool {
        match env::promise_result_checked(0, 0) {
            Ok(_) => {
                Self::emit_event(
                    "ft_payment_settled",
                    near_sdk::serde_json::json!({ "token_id": token_id, "amount": amount.0.to_string(), "nonce": nonce.0 }),
                );
                true
            }
            Err(_) => {
                if let Some(policy) = self
                    .token_policies
                    .iter_mut()
                    .find(|p| p.token_id == token_id)
                {
                    if policy.current_day == reservation_day {
                        policy.spent_today = policy.spent_today.saturating_sub(amount.0);
                    }
                }
                Self::emit_event(
                    "ft_payment_failed",
                    near_sdk::serde_json::json!({ "token_id": token_id, "amount": amount.0.to_string(), "nonce": nonce.0 }),
                );
                false
            }
        }
    }
}

impl NearmarkFtGate {
    fn assert_owner(&self) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner_id,
            "only the owner may change Gate policy"
        );
    }
    fn assert_agent(&self) {
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
    }
    fn validate_agent_key(key: &str) {
        assert!(
            !key.trim().is_empty() && key.len() <= 128,
            "invalid agent public key"
        );
    }
    fn validate_token_policy(receivers: &[AccountId], max_payment: u128, daily_limit: u128) {
        assert!(
            !receivers.is_empty(),
            "at least one FT recipient is required"
        );
        assert!(
            receivers.len() <= MAX_RECEIVERS_PER_TOKEN,
            "too many FT recipients"
        );
        assert!(
            max_payment > 0,
            "FT per-payment limit must be greater than zero"
        );
        assert!(
            daily_limit >= max_payment,
            "FT daily limit must be at least the per-payment limit"
        );
        for (index, receiver) in receivers.iter().enumerate() {
            assert!(
                !receivers[..index].contains(receiver),
                "duplicate FT recipient"
            );
        }
    }
    fn emit_event(event: &str, data: near_sdk::serde_json::Value) {
        env::log_str(&format!(
            "EVENT_JSON:{}",
            near_sdk::serde_json::json!({
                "standard": "nearmark_gate", "version": "2.0.0", "event": event, "data": [data]
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

    fn account(s: &str) -> AccountId {
        AccountId::from_str(s).unwrap()
    }
    fn ctx(predecessor: &str, signer: &str, key: &str) {
        let mut b = VMContextBuilder::new();
        b.current_account_id(account("ft-gate.testnet"))
            .predecessor_account_id(account(predecessor))
            .signer_account_id(account(signer))
            .signer_account_pk(PublicKey::from_str(key).unwrap())
            .block_timestamp(NOW);
        testing_env!(b.build());
    }
    fn gate() -> NearmarkFtGate {
        ctx("owner.testnet", "owner.testnet", OWNER_KEY);
        NearmarkFtGate::new(
            account("owner.testnet"),
            account("agent.testnet"),
            AGENT_KEY.to_string(),
            vec![TokenPolicyInput {
                token_id: account("usdt.fakes.testnet"),
                allowed_receivers: vec![account("vendor.testnet")],
                max_payment: U128(100),
                daily_limit: U128(250),
            }],
        )
    }
    fn pay(g: &mut NearmarkFtGate, token: &str, receiver: &str, amount: u128, nonce: u64) {
        ctx("agent.testnet", "agent.testnet", AGENT_KEY);
        let _p = g.execute_ft_payment(
            account(token),
            account(receiver),
            U128(amount),
            U64(nonce),
            U64(NOW + 60_000_000_000),
            None,
        );
    }

    #[test]
    fn approved_ft_payment_reserves_budget_and_consumes_nonce() {
        let mut g = gate();
        pay(&mut g, "usdt.fakes.testnet", "vendor.testnet", 75, 0);
        let s = g.get_status();
        assert_eq!(s.next_nonce, U64(1));
        assert_eq!(s.token_policies[0].spent_today, U128(75));
    }
    #[test]
    #[should_panic(expected = "FT token is not owner-approved")]
    fn unapproved_token_is_blocked() {
        let mut g = gate();
        pay(&mut g, "evil-token.testnet", "vendor.testnet", 1, 0);
    }
    #[test]
    #[should_panic(expected = "FT recipient is not owner-approved")]
    fn prompt_injected_ft_recipient_is_blocked() {
        let mut g = gate();
        pay(&mut g, "usdt.fakes.testnet", "attacker.testnet", 1, 0);
    }
    #[test]
    #[should_panic(expected = "FT per-payment limit exceeded")]
    fn ft_per_payment_limit_is_enforced() {
        let mut g = gate();
        pay(&mut g, "usdt.fakes.testnet", "vendor.testnet", 101, 0);
    }
    #[test]
    #[should_panic(expected = "FT daily spending limit exceeded")]
    fn ft_daily_limit_is_enforced() {
        let mut g = gate();
        pay(&mut g, "usdt.fakes.testnet", "vendor.testnet", 100, 0);
        pay(&mut g, "usdt.fakes.testnet", "vendor.testnet", 100, 1);
        pay(&mut g, "usdt.fakes.testnet", "vendor.testnet", 100, 2);
    }
    #[test]
    #[should_panic(expected = "invalid or replayed nonce")]
    fn ft_nonce_replay_is_blocked() {
        let mut g = gate();
        pay(&mut g, "usdt.fakes.testnet", "vendor.testnet", 1, 0);
        pay(&mut g, "usdt.fakes.testnet", "vendor.testnet", 1, 0);
    }
    #[test]
    #[should_panic(expected = "unauthorized agent key")]
    fn alternate_agent_key_is_rejected() {
        let mut g = gate();
        ctx("agent.testnet", "agent.testnet", OTHER_KEY);
        let _p = g.execute_ft_payment(
            account("usdt.fakes.testnet"),
            account("vendor.testnet"),
            U128(1),
            U64(0),
            U64(NOW + 60_000_000_000),
            None,
        );
    }
    #[test]
    #[should_panic(expected = "Gate is paused")]
    fn emergency_pause_blocks_ft_payment() {
        let mut g = gate();
        ctx("owner.testnet", "owner.testnet", OWNER_KEY);
        g.set_paused(true);
        pay(&mut g, "usdt.fakes.testnet", "vendor.testnet", 1, 0);
    }
    #[test]
    fn owner_can_replace_ft_policy() {
        let mut g = gate();
        ctx("owner.testnet", "owner.testnet", OWNER_KEY);
        g.update_token_policy(
            account("usdt.fakes.testnet"),
            vec![account("vendor2.testnet")],
            U128(80),
            U128(200),
        );
        let s = g.get_status();
        assert_eq!(
            s.token_policies[0].allowed_receivers,
            vec![account("vendor2.testnet")]
        );
        assert_eq!(s.policy_version, U64(2));
    }
}
