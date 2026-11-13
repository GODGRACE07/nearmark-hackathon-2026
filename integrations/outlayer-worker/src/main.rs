use outlayer::{env, signing_keys};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(target_arch = "wasm32")]
#[used]
#[link_section = "outlayer.manifest"]
static OUTLAYER_MANIFEST: [u8; include_bytes!("../manifest.json").len()] =
    *include_bytes!("../manifest.json");

const DOMAIN: &str = "NEARMARK:NASB-0.1:OUTLAYER-RECEIPT-SIGNING:V1\n";

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Input {
    suite_version: String,
    source_commit: String,
    config_sha256: String,
    contract_wasm_sha256: String,
    evidence_manifest_sha256: String,
    block_height: u64,
    scenario_count: u16,
}

#[derive(Debug, Serialize)]
struct Receipt {
    schema: &'static str,
    suite_version: String,
    source_commit: String,
    config_sha256: String,
    contract_wasm_sha256: String,
    evidence_manifest_sha256: String,
    block_height: u64,
    scenario_count: u16,
    signer_account_id: String,
    outlayer_request_id: String,
    near_transaction_hash: Option<String>,
    issued_at_unix_seconds: u64,
    execution_scope: &'static str,
    semantic_claims_verified: bool,
}

// OutLayer's NEAR callback output is limited to 900 bytes. Keep the
// signed canonical Receipt verbose and stable, but use short aliases in the
// transport result. The local verifier expands these aliases before checking.
#[derive(Debug, Serialize)]
struct CompactReceipt {
    #[serde(rename = "v")]
    schema: &'static str,
    #[serde(rename = "sv")]
    suite_version: String,
    #[serde(rename = "c")]
    source_commit: String,
    #[serde(rename = "cf")]
    config_sha256: String,
    #[serde(rename = "cw")]
    contract_wasm_sha256: String,
    #[serde(rename = "em")]
    evidence_manifest_sha256: String,
    #[serde(rename = "bh")]
    block_height: u64,
    #[serde(rename = "sc")]
    scenario_count: u16,
    #[serde(rename = "a")]
    signer_account_id: String,
    #[serde(rename = "id")]
    outlayer_request_id: String,
    #[serde(rename = "tx")]
    near_transaction_hash: Option<String>,
    #[serde(rename = "ts")]
    issued_at_unix_seconds: u64,
    #[serde(rename = "x")]
    execution_scope: &'static str,
    #[serde(rename = "m")]
    semantic_claims_verified: bool,
}

#[derive(Debug, Serialize)]
struct Output {
    #[serde(rename = "s")]
    status: &'static str,
    #[serde(rename = "r")]
    receipt: CompactReceipt,
    #[serde(rename = "h")]
    receipt_sha256: String,
    #[serde(rename = "p")]
    signer_public_key_hex: String,
    #[serde(rename = "g")]
    signature_hex: String,
    #[serde(rename = "al")]
    signature_algorithm: &'static str,
}

fn is_hex(value: &str, len: usize) -> bool {
    value.len() == len && value.bytes().all(|c| c.is_ascii_hexdigit())
}

fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

fn run() -> Result<Output, String> {
    let input: Input = env::input_json::<Input>()
        .map_err(|e| format!("invalid worker JSON: {e}"))?
        .ok_or_else(|| "worker input is required".to_string())?;

    if input.suite_version != "NASB-0.1" {
        return Err("suite_version must be NASB-0.1 (the implemented local harness)".into());
    }
    if !is_hex(&input.source_commit, 40) {
        return Err("source_commit must be a 40-character Git commit SHA".into());
    }
    for (label, value) in [
        ("config_sha256", &input.config_sha256),
        ("contract_wasm_sha256", &input.contract_wasm_sha256),
        ("evidence_manifest_sha256", &input.evidence_manifest_sha256),
    ] {
        if !is_hex(value, 64) {
            return Err(format!("{label} must be a 64-character SHA-256 hex digest"));
        }
    }
    if input.block_height == 0 {
        return Err("block_height must be greater than zero".into());
    }
    if input.scenario_count == 0 || input.scenario_count > 100 {
        return Err("scenario_count must be between 1 and 100".into());
    }

    let signer = env::signer_account_id()
        .ok_or_else(|| "OutLayer signer account is unavailable".to_string())?;
    let request_id =
        env::request_id().ok_or_else(|| "OutLayer request ID is unavailable".to_string())?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let receipt = Receipt {
        schema: "nearmark.nasb0_1.receipt-signing.v1",
        suite_version: input.suite_version,
        source_commit: input.source_commit,
        config_sha256: input.config_sha256,
        contract_wasm_sha256: input.contract_wasm_sha256,
        evidence_manifest_sha256: input.evidence_manifest_sha256,
        block_height: input.block_height,
        scenario_count: input.scenario_count,
        signer_account_id: signer,
        outlayer_request_id: request_id,
        near_transaction_hash: env::transaction_hash(),
        issued_at_unix_seconds: timestamp,
        execution_scope: "TEE_EXECUTED_CANONICAL_RECEIPT_SIGNING_ONLY",
        semantic_claims_verified: false,
    };

    // The worker builds a fixed, domain-separated message from strictly parsed
    // fields. It never signs caller-provided byte arrays or arbitrary digests.
    // The receipt explicitly disclaims semantic verification of the evidence.
    let canonical_json = serde_json::to_vec(&receipt).map_err(|e| e.to_string())?;
    let mut signed_message = DOMAIN.as_bytes().to_vec();
    signed_message.extend_from_slice(&canonical_json);
    let public_key = signing_keys::public_key("nasb_receipts", None).map_err(|e| e.to_string())?;
    let signature =
        signing_keys::sign("nasb_receipts", None, &signed_message).map_err(|e| e.to_string())?;

    let receipt_hash = sha256_hex(&canonical_json);
    let compact_receipt = CompactReceipt {
        schema: receipt.schema,
        suite_version: receipt.suite_version.clone(),
        source_commit: receipt.source_commit.clone(),
        config_sha256: receipt.config_sha256.clone(),
        contract_wasm_sha256: receipt.contract_wasm_sha256.clone(),
        evidence_manifest_sha256: receipt.evidence_manifest_sha256.clone(),
        block_height: receipt.block_height,
        scenario_count: receipt.scenario_count,
        signer_account_id: receipt.signer_account_id.clone(),
        outlayer_request_id: receipt.outlayer_request_id.clone(),
        near_transaction_hash: receipt.near_transaction_hash.clone(),
        issued_at_unix_seconds: receipt.issued_at_unix_seconds,
        execution_scope: receipt.execution_scope,
        semantic_claims_verified: receipt.semantic_claims_verified,
    };

    Ok(Output {
        status: "tee_execution_signature_created",
        receipt: compact_receipt,
        receipt_sha256: receipt_hash,
        signer_public_key_hex: hex::encode(public_key),
        signature_hex: hex::encode(signature),
        signature_algorithm: "ed25519",
    })
}

fn main() {
    let output = match run() {
        Ok(value) => serde_json::to_value(value).unwrap_or_else(|serialization_error| {
            serde_json::json!({ "s": "rejected", "e": serialization_error.to_string() })
        }),
        Err(error) => serde_json::json!({ "s": "rejected", "e": error }),
    };

    // Fail closed instead of returning a truncated result if the actual
    // request ID or payload ever pushes the response over OutLayer's limit.
    let encoded = serde_json::to_vec(&output).expect("serialize worker output");
    let bounded_output = if encoded.len() <= 900 {
        output
    } else {
        serde_json::json!({
            "s": "rejected",
            "e": "compact receipt exceeds the 900-byte OutLayer output limit"
        })
    };

    env::output_json(&bounded_output).expect("write worker output JSON");
    use std::io::Write as _;
    std::io::stdout().flush().expect("flush worker output JSON");
}
