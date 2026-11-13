import os
import re
import json
import hashlib
import subprocess
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path.cwd()
REPORTS = ROOT / "reports"
LOGS = ROOT / "logs" / "final-audit"

REPORTS.mkdir(exist_ok=True)
LOGS.mkdir(parents=True, exist_ok=True)

EXCLUDED = {
    ".git", "node_modules", ".venv", "venv",
    "dist", "build", "coverage", ".next",
    ".cache", ".turbo", "target", "reports",
    "logs", "__pycache__"
}

CODE_EXTENSIONS = {
    ".js", ".mjs", ".cjs", ".ts", ".tsx",
    ".jsx", ".rs", ".sol", ".py", ".go"
}

TEXT_EXTENSIONS = CODE_EXTENSIONS | {
    ".md", ".json", ".yaml", ".yml", ".toml"
}

def log(message):
    print("[NEARMARK] " + message, flush=True)

def utc_now():
    return datetime.now(timezone.utc).isoformat()

def run_command(command, timeout=180):
    try:
        result = subprocess.run(
            command,
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            errors="replace",
            timeout=timeout
        )

        return result.returncode, result.stdout, None

    except subprocess.TimeoutExpired as exc:
        output = exc.stdout or ""
        if isinstance(output, bytes):
            output = output.decode(errors="replace")

        return None, output, "TIMEOUT"

    except Exception as exc:
        return None, str(exc), "ERROR"

# ------------------------------------------------
# A. INVENTORY ACTUAL PROJECT FILES
# ------------------------------------------------

log("Scanning project files.")

files = {}

for base, directories, filenames in os.walk(ROOT):
    directories[:] = [
        d for d in directories
        if d not in EXCLUDED
    ]

    for filename in filenames:
        path = Path(base) / filename

        if filename.startswith(".env"):
            continue

        if filename.endswith(".lock"):
            continue

        if path.suffix.lower() not in TEXT_EXTENSIONS:
            continue

        try:
            if path.stat().st_size > 1_500_000:
                continue

            relative = path.relative_to(ROOT).as_posix()

            content = path.read_text(
                encoding="utf-8",
                errors="replace"
            )

            files[relative] = content

        except (OSError, ValueError):
            continue

source_files = {
    p: c for p, c in files.items()
    if Path(p).suffix.lower() in CODE_EXTENSIONS
}

test_files = {
    p: c for p, c in source_files.items()
    if re.search(
        r"(^|/)(test|tests|__tests__)(/|$)|"
        r"\.(test|spec)\.",
        p,
        re.I
    )
}

application_files = {
    p: c for p, c in source_files.items()
    if p not in test_files
}

log(f"Source files discovered: {len(source_files)}")
log(f"Test files discovered: {len(test_files)}")

# ------------------------------------------------
# B. FEATURE AUDIT
# ------------------------------------------------

FEATURES = [

{
"id": "native_gate",
"label": "Native NEAR Gate contract",
"priority": "CRITICAL",
"signals": [
    ("NEAR contract SDK", r"near-sdk|near-contract-standards"),
    ("Contract implementation", r"near_bindgen|#\[near\]"),
    ("Payment or mandate enforcement", r"transfer|spend.?limit|allowlist|mandate")
],
"tests": r"gate|contract|payment|transfer"
},

{
"id": "restricted_key",
"label": "Restricted FunctionCall access key",
"priority": "CRITICAL",
"signals": [
    ("FunctionCall permissions", r"FunctionCall|function_call"),
    ("Restricted receiver or methods", r"receiver_id|receiverId|method_names|methodNames"),
    ("Access-key inspection", r"access.?key|AccessKeyPermission")
],
"tests": r"access.?key|function.?call|permission"
},

{
"id": "authority",
"label": "Authority Intelligence",
"priority": "CRITICAL",
"signals": [
    ("Access-key inspection", r"view_access_keys|view_access_key|AccessKeyPermission"),
    ("Permission classification", r"FullAccess|FunctionCall"),
    ("Authority analysis", r"authority|permission|effective.?authority")
],
"tests": r"authority|permission|access.?key"
},

{
"id": "counterparty",
"label": "Counterparty Intelligence",
"priority": "CRITICAL",
"signals": [
    ("Counterparty assessment", r"counterparty|recipient.?risk"),
    ("Decision states", r"ALLOW|WARN|BLOCK"),
    ("Evidence and reasons", r"reason|evidence|risk.?score")
],
"tests": r"counterparty|recipient|allow|block"
},

{
"id": "runtime_guard",
"label": "Agent-side runtime security guard",
"priority": "CRITICAL",
"signals": [
    ("Transaction signing integration", r"signAndSendTransaction|signTransaction|sign_transaction"),
    ("Decision enforcement", r"BLOCK|refuse|deny"),
    ("Human approval", r"approval|human.?review|require.?approval")
],
"tests": r"runtime|guard|sign|block"
},

{
"id": "attack_lab",
"label": "Prompt-injection Attack Laboratory",
"priority": "CRITICAL",
"signals": [
    ("Prompt-injection scenario", r"prompt.?inject"),
    ("Malicious payment or recipient", r"malicious|known.?bad|redirected.?payment|unauthorized.?recipient"),
    ("Attack execution evidence", r"attack.?result|state.?change|attack.?success")
],
"tests": r"attack|inject|malicious|recipient"
},

{
"id": "sandbox",
"label": "Real NEAR Sandbox execution",
"priority": "CRITICAL",
"signals": [
    ("Sandbox dependency", r"near-workspaces|near-sandbox"),
    ("Sandbox execution", r"dev.?deploy|sandbox|fast.?forward"),
    ("State verification", r"getAccount|viewAccount|balance|transaction.?result")
],
"tests": r"sandbox|contract|workspace"
},

{
"id": "nasb",
"label": "NASB-1 reproducible security benchmark",
"priority": "CRITICAL",
"signals": [
    ("Benchmark specification", r"NASB-1|NEAR Agent Security Benchmark"),
    ("Versioned test suite", r"suiteVersion|testSuiteVersion|benchmarkVersion"),
    ("Evidence and reproducibility", r"sha256|receipt|configurationHash|reproducib")
],
"tests": r"benchmark|nasb|scenario"
},

{
"id": "sdk",
"label": "Public TypeScript SDK",
"priority": "HIGH",
"signals": [
    ("SDK implementation", r"NearmarkClient|class Nearmark|@nearmark/sdk"),
    ("Wallet inspection API", r"inspectWallet"),
    ("Counterparty API", r"checkCounterparty")
],
"tests": r"sdk|client|inspect"
},

{
"id": "rest_api",
"label": "Nearmark REST API",
"priority": "HIGH",
"signals": [
    ("Wallet inspection endpoint", r"/v1/inspect"),
    ("Counterparty endpoint", r"/v1/counterparty/check"),
    ("Benchmark or passport endpoint", r"/v1/benchmark|/v1/passports")
],
"tests": r"api|route|endpoint"
},

{
"id": "cli",
"label": "Developer CLI",
"priority": "MEDIUM",
"signals": [
    ("CLI framework", r"commander|yargs|cac"),
    ("CLI commands", r"inspect|benchmark|scan")
],
"tests": r"cli|command"
},

{
"id": "mcp",
"label": "Restricted MCP server",
"priority": "MEDIUM",
"signals": [
    ("MCP implementation", r"@modelcontextprotocol/sdk|McpServer"),
    ("Tool registration", r"registerTool|server\.tool|tools\.register")
],
"tests": r"mcp|tool"
},

{
"id": "outlayer_custody",
"label": "OutLayer Agent Custody",
"priority": "HIGH",
"signals": [
    ("OutLayer integration", r"outlayer"),
    ("Policy and audit inspection", r"wallet/v1/policy|wallet/v1/audit"),
    ("Custody controls", r"whitelist|spending.?limit|freeze|multisig")
],
"tests": r"outlayer|custody|policy"
},

{
"id": "outlayer_tee",
"label": "OutLayer TEE benchmark receipts",
"priority": "HIGH",
"signals": [
    ("OutLayer integration", r"outlayer"),
    ("TEE or WASI worker", r"WASI|wasm|TEE"),
    ("Receipt or signing verification", r"attestation|signing.?keys|signature")
],
"tests": r"outlayer|tee|receipt"
},

{
"id": "near_ai",
"label": "NEAR AI TEE verification",
"priority": "HIGH",
"signals": [
    ("Official NEAR AI SDK", r"@nearai/inference-sdk"),
    ("Model verification", r"verifyModelAttestation|fetchModelAttestations"),
    ("Gateway verification", r"verifyGatewayAttestation|fetchGatewayAttestation")
],
"tests": r"near.?ai|attestation|tee"
},

{
"id": "near_ai_red",
"label": "NEAR AI RED adversarial testing",
"priority": "MEDIUM",
"signals": [
    ("RED or cybersecurity model integration", r"NEAR AI RED|nearai.*cybersecurity|cybersecurity.*model"),
    ("Adversarial generation", r"adversarial|attack.?generation")
],
"tests": r"red|cybersecurity|adversarial"
},

{
"id": "passports",
"label": "Evidence-backed security passports",
"priority": "HIGH",
"signals": [
    ("Security passport implementation", r"security.?passport|passport"),
    ("Evidence integrity", r"sha256|evidenceHash|policyHash"),
    ("Verification or signature", r"signature|verify|receipt")
],
"tests": r"passport|evidence|report"
}

]

def search_files(collection, pattern):
    rx = re.compile(pattern, re.I | re.M)

    return [
        name for name, content in collection.items()
        if rx.search(content)
    ]

inventory = []

for feature in FEATURES:
    signals = []

    for label, pattern in feature["signals"]:
        matches = search_files(application_files, pattern)

        signals.append({
            "signal": label,
            "found": bool(matches),
            "files": matches[:8]
        })

    matched_count = sum(
        1 for signal in signals if signal["found"]
    )

    tests = search_files(test_files, feature["tests"])

    if matched_count == len(signals) and tests:
        status = "SOURCE_AND_TEST_REFERENCES_FOUND_RUNTIME_UNVERIFIED"

    elif matched_count == len(signals):
        status = "SOURCE_REFERENCES_FOUND_TESTS_NOT_FOUND"

    elif matched_count > 0:
        status = "PARTIAL_SOURCE_REFERENCES"

    else:
        status = "NO_SOURCE_REFERENCES_FOUND"

    inventory.append({
        "id": feature["id"],
        "name": feature["label"],
        "priority": feature["priority"],
        "status": status,
        "signalsFound": matched_count,
        "signalsRequired": len(signals),
        "signals": signals,
        "testFiles": tests[:10],
        "runtimeAcceptance": "NOT_VERIFIED_BY_STATIC_AUDIT"
    })

# ------------------------------------------------
# C. FRONTEND AND DOCUMENTATION
# ------------------------------------------------

frontend_files = [
    p for p in source_files
    if Path(p).suffix.lower() in {".tsx", ".jsx"}
]

documentation_files = [
    p for p in files
    if Path(p).suffix.lower() == ".md"
]

package_path = ROOT / "package.json"

if not package_path.exists():
    raise SystemExit("FATAL: package.json missing.")

package = json.loads(package_path.read_text())

package_scripts = package.get("scripts", {})

# ------------------------------------------------
# D. ACTUAL AUTOMATED PROJECT CHECKS
# ------------------------------------------------

checks = []

for name in ["check", "test", "build"]:

    if name not in package_scripts:
        checks.append({
            "name": name,
            "status": "NOT_CONFIGURED",
            "command": f"npm run {name}"
        })

        continue

    log(f"Running npm run {name}.")

    code, output, error = run_command(
        ["npm", "run", name],
        timeout=180
    )

    logfile = LOGS / f"{name}.log"
    logfile.write_text(output)

    if error == "TIMEOUT":
        status = "TIMEOUT"
    elif error:
        status = "EXECUTION_ERROR"
    elif code == 0:
        status = "PASS"
    else:
        status = "FAIL"

    checks.append({
        "name": name,
        "status": status,
        "exitCode": code,
        "log": logfile.relative_to(ROOT).as_posix(),
        "lastOutput": output.splitlines()[-15:]
    })

    log(f"npm run {name}: {status}")

# ------------------------------------------------
# E. SECURITY AND SUBMISSION AUDIT
# ------------------------------------------------

def git(command):
    code, output, error = run_command(
        ["git"] + command,
        timeout=20
    )

    return output.strip() if code == 0 else None

git_present = git(["rev-parse", "--is-inside-work-tree"])

remote = git(["remote", "get-url", "origin"])

tracked_env = git([
    "ls-files",
    "--error-unmatch",
    ".env"
])

ignore_result = subprocess.run(
    ["git", "check-ignore", "-q", ".env"],
    cwd=ROOT
)

readme_path = ROOT / "README.md"

readme = (
    readme_path.read_text(errors="replace")
    if readme_path.exists()
    else ""
)

gitignore_path = ROOT / ".gitignore"

gitignore = (
    gitignore_path.read_text(errors="replace")
    if gitignore_path.exists()
    else ""
)

deployment_files = [
    p for p in files
    if re.search(
        r"wrangler\.toml|vercel\.json|render\.yaml|"
        r"Dockerfile|docker-compose|fly\.toml",
        p,
        re.I
    )
]

submission = {
    "gitRepository": bool(git_present),
    "remoteConfigured": bool(remote),
    "remoteVisibility": "MUST_BE_CONFIRMED_PUBLIC",
    "readmeExists": readme_path.exists(),
    "readmeInstallInstructions": bool(
        re.search(r"npm (install|ci)|pnpm install", readme, re.I)
    ),
    "readmeRunInstructions": bool(
        re.search(r"npm run|node scripts|cargo run", readme, re.I)
    ),
    "readmeDemoInstructions": bool(
        re.search(r"demo|screenshots|video", readme, re.I)
    ),
    "envFileTrackedByGit": bool(tracked_env),
    "envIgnoredByGit": ignore_result.returncode == 0,
    "envPatternInGitignore": bool(
        re.search(r"(^|\n)\.env", gitignore)
    ),
    "deploymentConfigurationFound": deployment_files,
    "xDemoPost": "MANUAL_CONFIRMATION_REQUIRED",
    "mainnetPayoutAccount": "MANUAL_CONFIRMATION_REQUIRED",
    "allRelevantTracksSelected": "MANUAL_CONFIRMATION_REQUIRED",
    "gitHistorySecretScan": "NOT_PERFORMED"
}

# ------------------------------------------------
# F. DETERMINE WHAT IS STILL REMAINING
# ------------------------------------------------

core_ids = {
    "native_gate",
    "restricted_key",
    "authority",
    "counterparty",
    "runtime_guard",
    "attack_lab",
    "sandbox",
    "nasb",
    "sdk",
    "rest_api"
}

core = [
    item for item in inventory
    if item["id"] in core_ids
]

missing_source = [
    item["name"] for item in core
    if item["status"] == "NO_SOURCE_REFERENCES_FOUND"
]

partial_source = [
    item["name"] for item in core
    if item["status"] == "PARTIAL_SOURCE_REFERENCES"
]

without_tests = [
    item["name"] for item in core
    if not item["testFiles"]
]

failed_checks = [
    item["name"] for item in checks
    if item["status"] in {
        "FAIL", "TIMEOUT", "EXECUTION_ERROR"
    }
]

not_configured = [
    item["name"] for item in checks
    if item["status"] == "NOT_CONFIGURED"
]

remaining = []

for name in missing_source:
    remaining.append({
        "priority": "CRITICAL",
        "task": f"Implement {name}: no relevant source signals found."
    })

for name in partial_source:
    remaining.append({
        "priority": "HIGH",
        "task": f"Complete and inspect partial implementation: {name}."
    })

for name in without_tests:
    remaining.append({
        "priority": "HIGH",
        "task": f"Add targeted automated tests for {name}."
    })

for name in failed_checks:
    remaining.append({
        "priority": "CRITICAL",
        "task": f"Fix failing automated check: {name}."
    })

for name in not_configured:
    remaining.append({
        "priority": "HIGH",
        "task": f"Configure and run project check: {name}."
    })

remaining.extend([
    {
        "priority": "CRITICAL",
        "task": "Demonstrate a real FunctionCall key restricted to one Gate contract."
    },
    {
        "priority": "CRITICAL",
        "task": "Run the prompt-injection attack and record proof that the forbidden transfer did not occur."
    },
    {
        "priority": "HIGH",
        "task": "Reproduce NASB-1 results from a clean environment."
    },
    {
        "priority": "HIGH",
        "task": "Verify OutLayer custody and TEE claims against actual API/attestation evidence."
    },
    {
        "priority": "HIGH",
        "task": "Complete NEAR AI cryptographic verification and response-signature testing."
    },
    {
        "priority": "HIGH",
        "task": "Verify public GitHub repository, secret-free Git history and reproducible README instructions."
    },
    {
        "priority": "HIGH",
        "task": "Confirm the live demo video/screenshots, X post, selected tracks and payout account."
    }
])

audit = {
    "schemaVersion": "1.0",
    "generatedAt": utc_now(),
    "project": "NEARMARK",
    "product": "Independent NEAR Agent Security Benchmark and Runtime Protection",
    "sourceFileCount": len(source_files),
    "testFileCount": len(test_files),
    "frontendFiles": frontend_files,
    "documentationFiles": documentation_files,
    "features": inventory,
    "automatedChecks": checks,
    "submissionReadiness": submission,
    "completion": {
        "certifiedComplete": False,
        "reason": (
            "Static source discovery is not proof of runtime behavior. "
            "Critical contract, attack, sandbox and integration acceptance "
            "tests must be demonstrated."
        ),
        "coreFeatureCount": len(core),
        "coreWithoutSourceSignals": missing_source,
        "coreWithPartialSourceSignals": partial_source,
        "coreWithoutTargetedTests": without_tests,
        "failedAutomatedChecks": failed_checks,
        "remainingTasks": remaining
    },
    "tee": {
        "status": (
            "EVIDENCE_RETRIEVAL_OBSERVED_CRYPTOGRAPHIC_INTEGRATION_REQUIRES_FINAL_VALIDATION"
        ),
        "note": (
            "The previous terminal output showed raw Gateway and model evidence "
            "retrieval. This audit does not misrepresent that as a completed "
            "cryptographic verification or a verified deployment policy."
        )
    }
}

# ------------------------------------------------
# G. WRITE AUDIT REPORTS
# ------------------------------------------------

json_without_hash = json.dumps(
    audit,
    indent=2,
    sort_keys=True
)

digest = hashlib.sha256(
    json_without_hash.encode("utf-8")
).hexdigest()

audit["sha256"] = digest

json_path = REPORTS / "NEARMARK_COMPLETION_AUDIT.json"

json_path.write_text(
    json.dumps(audit, indent=2)
)

md = [
    "# NEARMARK — Complete Project Audit",
    "",
    f"Generated: {audit['generatedAt']}",
    "",
    "## Executive decision",
    "",
    "**PROJECT COMPLETION: NOT YET CERTIFIED.**",
    "",
    audit["completion"]["reason"],
    "",
    f"- Source files: {len(source_files)}",
    f"- Test files: {len(test_files)}",
    f"- Core features audited: {len(core)}",
    f"- Missing core source signals: {len(missing_source)}",
    f"- Partial core source signals: {len(partial_source)}",
    f"- Core features without targeted tests: {len(without_tests)}",
    "",
    "## Feature-by-feature status",
    ""
]

for item in inventory:
    md.extend([
        f"### {item['name']}",
        "",
        f"**Priority:** {item['priority']}",
        f"**Status:** `{item['status']}`",
        f"**Signals:** {item['signalsFound']}/{item['signalsRequired']}",
        ""
    ])

    for signal in item["signals"]:
        mark = "FOUND" if signal["found"] else "NOT FOUND"

        md.append(f"- {signal['signal']}: {mark}")

        for file in signal["files"][:4]:
            md.append(f"  - `{file}`")

    if item["testFiles"]:
        md.append("Test references:")

        for file in item["testFiles"]:
            md.append(f"- `{file}`")

    else:
        md.append("- No targeted test-file reference found.")

    md.append("- Runtime behavior: NOT CERTIFIED BY STATIC AUDIT.")
    md.append("")

md.extend([
    "## Automated execution results",
    ""
])

for check in checks:
    md.append(f"- **{check['name']}**: `{check['status']}`")

    if check.get("log"):
        md.append(f"  - Log: `{check['log']}`")

md.extend([
    "",
    "## TEE verification",
    "",
    f"- Status: `{audit['tee']['status']}`",
    "- Raw evidence retrieval is not equivalent to cryptographic verification.",
    "- Deployment measurement allowlisting still requires a real policy.",
    "- Model response signature verification must be separately demonstrated.",
    "",
    "## Submission readiness",
    ""
])

for key, value in submission.items():
    md.append(f"- **{key}:** {json.dumps(value)}")

md.extend([
    "",
    "## Remaining work — prioritized",
    ""
])

for index, task in enumerate(remaining, 1):
    md.append(
        f"{index}. **{task['priority']}** — {task['task']}"
    )

md.extend([
    "",
    "## Security acceptance criteria",
    "",
    "1. A FunctionCall access key is restricted to the Gate contract.",
    "2. FullAccess is not given to the autonomous agent.",
    "3. Counterparty checks return ALLOW, WARN or BLOCK with evidence.",
    "4. BLOCK prevents transaction signing.",
    "5. WARN requires human approval.",
    "6. Prompt injection cannot redirect protected funds.",
    "7. The test verifies actual sandbox state and transaction receipts.",
    "8. NASB-1 results can be independently reproduced.",
    "9. Secrets are absent from the public repository and Git history.",
    "",
    "Static source matches are discovery clues, not proof of feature completion.",
    "",
    f"Audit SHA-256: `{digest}`",
    ""
])

md_path = REPORTS / "NEARMARK_COMPLETION_AUDIT.md"

md_path.write_text("\n".join(md), encoding="utf-8")

(REPORTS / "NEARMARK_COMPLETION_AUDIT.sha256").write_text(
    digest + "  NEARMARK_COMPLETION_AUDIT.json\n"
)

log("Audit reports successfully generated.")

print("")
print("================================================")
print(" NEARMARK PROJECT COMPLETION SUMMARY")
print("================================================")

print("Source files:", len(source_files))
print("Test files:", len(test_files))
print("Core features:", len(core))
print("Missing source signals:", len(missing_source))
print("Partial source signals:", len(partial_source))
print("Core features without targeted tests:", len(without_tests))
print("Failed automated checks:", len(failed_checks))

print("")
print("REMAINING PRIORITIES:")

for task in remaining[:15]:
    print(f"[{task['priority']}] {task['task']}")

print("")
print("FULL REPORT:")
print(md_path)

print("")
print("JSON REPORT:")
print(json_path)

print("")
print("AUDIT SHA-256:")
print(digest)

print("")
print("Audit completed. Product completion has NOT been assumed.")
