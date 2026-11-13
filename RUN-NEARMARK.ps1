$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$Runner = Join-Path $Root 'scripts/ONE-COMMAND-WSL.sh'
if (-not (Test-Path $Runner)) { throw "Missing WSL runner: $Runner" }
$WslRoot = (& wsl.exe -e wslpath -a -u $Root | Select-Object -First 1).Trim()
if (-not $WslRoot.StartsWith('/')) { throw 'Could not map the project folder into WSL.' }
$Escaped = $WslRoot.Replace("'", "'\''")
& wsl.exe bash -lc "cd '$Escaped' && bash scripts/ONE-COMMAND-WSL.sh"
if ($LASTEXITCODE -ne 0) { throw "NEARMARK pipeline failed with exit code $LASTEXITCODE." }
