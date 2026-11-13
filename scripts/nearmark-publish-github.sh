#!/usr/bin/env bash
set -Eeuo pipefail
PROJECT="/home/grace/NEARMARK-COMPLETE-BUILD/nearmark"
STAGE="$HOME/NEARMARK-PUBLIC-STAGE"
cd "$PROJECT"

if ! command -v git >/dev/null 2>&1; then sudo apt-get update && sudo apt-get install -y git; fi
if ! command -v gh >/dev/null 2>&1; then sudo apt-get update && sudo apt-get install -y gh; fi
if ! gh auth status >/dev/null 2>&1; then gh auth login --hostname github.com --git-protocol https --web; fi

GH_USER=$(gh api user --jq '.login')
GH_NAME=$(gh api user --jq '.name // .login')
GH_EMAIL=$(gh api user --jq 'if .email then .email else "\(.id)+\(.login)@users.noreply.github.com" end')
REPO=""
EXISTS=false
for slug in nearmark-hackathon-2026 nearmark-near-agent-security; do
  candidate="$GH_USER/$slug"
  if gh repo view "$candidate" >/dev/null 2>&1; then
    PRIVATE=$(gh repo view "$candidate" --json isPrivate --jq '.isPrivate')
    [[ "$PRIVATE" == "false" ]] || { echo "STOP: $candidate exists but is private. Make it public or choose another name."; exit 1; }
    REPO="$candidate"; EXISTS=true; break
  elif [[ -z "$REPO" ]]; then
    REPO="$candidate"
  fi
done
[[ -n "$REPO" ]] || { echo "STOP: no GitHub repository name available."; exit 1; }

rm -rf "$STAGE"
if [[ "$EXISTS" == true ]]; then
  echo "Updating existing public repository: $REPO"
  if ! gh repo clone "$REPO" "$STAGE"; then
    mkdir -p "$STAGE"
    git -C "$STAGE" init -b main
    git -C "$STAGE" remote add origin "https://github.com/$REPO.git"
  fi
else
  mkdir -p "$STAGE"
  git -C "$STAGE" init -b main
fi

# Refuse to push an existing repository if its history contains credential paths.
if git -C "$STAGE" rev-parse --verify HEAD >/dev/null 2>&1; then
  if git -C "$STAGE" log --all --format= --name-only | python3 -c 'import sys; bad=[];
for x in sys.stdin:
 p=x.strip().lower(); b=p.rsplit("/",1)[-1];
 if b==".env" or (b.startswith(".env.") and b!=".env.example") or b in {".npmrc",".dev.vars"} or ".near-credentials/" in p or ".nearmark-secrets/" in p: bad.append(x.strip())
print("\n".join(sorted(set(bad)))) if bad else None; sys.exit(1 if bad else 0)' ; then
    :
  else
    echo "STOP: Existing Git history contains credential/config paths. Do not push over it; rotate exposed secrets and publish to a clean repository."
    exit 1
  fi
fi

# Replace staging files from the project, preserving only the .git directory.
python3 - "$PROJECT" "$STAGE" <<'PY_COPY'
from pathlib import Path
import shutil, sys
src, dst = Path(sys.argv[1]), Path(sys.argv[2])
blocked_dirs={'.git','.near-credentials','.nearmark','.nearmark-secrets','.tools','.venv','venv','node_modules','target','dist','verification-logs','__pycache__','release-binaries'}
blocked_suffixes={'.pem','.p12','.pfx','.key','.secret','.seed'}
for child in list(dst.iterdir()):
    if child.name == '.git': continue
    if child.is_dir(): shutil.rmtree(child)
    else: child.unlink()
def copy_tree(a,b):
    b.mkdir(parents=True,exist_ok=True)
    for child in a.iterdir():
        rel=child.relative_to(src).as_posix()
        if child.is_dir():
            if child.name in blocked_dirs: continue
            copy_tree(child,b/child.name)
        else:
            if child.name in {'.env','.npmrc','.dev.vars'} or child.name.startswith('.dev.vars.') or (child.name.startswith('.env.') and child.name != '.env.example'): continue
            if child.suffix.lower() in blocked_suffixes: continue
            if child.name.endswith('.wasm') and 'target' in child.parts: continue
            if rel in {'server/data/runs.json','server/data/reports.json'}: continue
            shutil.copy2(child,b/child.name)
copy_tree(src,dst)
ignore="""\n# NEARMARK public-release exclusions\n.env\n.env.*\n!.env.example\n.npmrc\n.dev.vars\n.dev.vars.*\n.near-credentials/\n.nearmark/\n.nearmark-secrets/\n.tools/\n*.pem\n*.p12\n*.pfx\n*.key\n*.secret\n*.seed\nnode_modules/\n**/node_modules/\n**/target/\ndist/\nverification-logs/\nserver/data/runs.json\nserver/data/reports.json\nrelease-binaries/\n"""
with (dst/'.gitignore').open('a',encoding='utf-8') as f: f.write(ignore)
print('Clean public source tree staged.')
PY_COPY

python3 - "$STAGE" <<'PY_SCAN'
from pathlib import Path
import re, sys
root=Path(sys.argv[1])
for p in root.rglob('*'):
    if not p.is_file(): continue
    low=p.name.lower()
    if low in {'.env','.npmrc','.dev.vars'} or (low.startswith('.dev.vars.') or low.startswith('.env.') and low!='.env.example') or low.endswith(('.pem','.p12','.pfx','.key','.secret','.seed')):
        raise SystemExit(f'STOP: sensitive path in public source: {p.relative_to(root)}')
patterns=[
 (re.compile(r'-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----'),'private key'),
 (re.compile(r'\bsk-[A-Za-z0-9_-]{24,}\b'),'API token'),
 (re.compile(r'\bapi_[A-Za-z0-9_-]{24,}\b'),'API token'),
 (re.compile(r'(?im)^[ \t]*(?:NEAR_AI_API_KEY|OUTLAYER_API_KEY|NEAR_BUILDERS_API_KEY)[ \t]*[:=][ \t]*[\'"]?(?!your_|replace|example|<)[A-Za-z0-9_-]{16,}[\'"]?[ \t]*$'),'provider credential'),
]
for p in root.rglob('*'):
    if not p.is_file(): continue
    try: text=p.read_text(encoding='utf8')
    except (UnicodeDecodeError,OSError): continue
    for rx,label in patterns:
        if rx.search(text): raise SystemExit(f'STOP: possible {label} found in {p.relative_to(root)}')
print('PASS: public-source secret scan.')
PY_SCAN

cd "$STAGE"
git config user.name "$GH_NAME"
git config user.email "$GH_EMAIL"
git branch -M main
git add -A
git diff --cached --check
if ! git diff --cached --quiet; then git commit -m "Publish NEARMARK security platform release"; fi
if [[ "$EXISTS" == true ]]; then
  git push -u origin main
else
  gh repo create "$REPO" --public --source "$STAGE" --remote origin --push
fi
URL=$(gh repo view "$REPO" --json url,isPrivate --jq '.url')
PRIVATE=$(gh repo view "$REPO" --json isPrivate --jq '.isPrivate')
[[ "$PRIVATE" == "false" ]] || { echo "STOP: GitHub repository is not public."; exit 1; }
COMMIT=$(git rev-parse HEAD)
mkdir -p "$PROJECT/artifacts"
printf '%s\n' "$REPO" > "$PROJECT/artifacts/nearmark-public-repo.txt"
printf '%s\n' "$URL" > "$PROJECT/artifacts/nearmark-public-repo-url.txt"
printf '%s\n' "$COMMIT" > "$PROJECT/artifacts/nearmark-public-source-commit.txt"
printf '\nPUBLIC REPOSITORY: %s\nSOURCE COMMIT: %s\nPASS: GitHub public source is pushed.\n' "$URL" "$COMMIT"
