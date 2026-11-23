# Smoke-test a Marinara build with the fitness module on den-lore before it replaces Lore's running
# Marinara. Everything here is scratch: a ledger seeded from a synthetic persona, the scripted game
# master and the build under test, all on loopback ports, with data in a new folder under
# C:\Dev\Lore-Fitness-RPG-Data\staging. Lore's Marinara, its data and the real ledger are not touched.
#
#   powershell -ExecutionPolicy Bypass -File deploy\windows\staging-smoke.ps1 [-Marinara C:\Dev\Marinara-Fitness-Staging]
param([string]$Marinara = 'C:\Dev\Marinara-Fitness-Staging')
. (Join-Path $PSScriptRoot 'common.ps1')
$node = Get-LfrNode
$env:PATH = "$(Split-Path $node);$env:PATH"
$root = Join-Path $LfrData ("staging\" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force "$root\ledger", "$root\marinara" | Out-Null
$ledgerPort = 7901; $gmPort = 7872; $port = 7871
$base = "http://127.0.0.1:$port"
$harness = Join-Path $LfrCheckout 'harness'
$service = Join-Path $LfrCheckout 'service'
$procs = @()
function Wait-Http($url) { foreach ($i in 1..120) { try { Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2 | Out-Null; return $true } catch { Start-Sleep 1 } }; $false }
try {
    & $node "$service\src\cli.ts" seed --data "$root\ledger" --persona steady --seed 1 --noise --resolve-rolls > "$root\ledger-seed.json"
    $procs += Start-Process $node -ArgumentList "src\main.ts", "--data", "`"$root\ledger`"", "--host", "127.0.0.1", "--port", $ledgerPort -WorkingDirectory $service -PassThru -WindowStyle Hidden -RedirectStandardOutput "$root\ledger.log" -RedirectStandardError "$root\ledger.err"
    $procs += Start-Process $node -ArgumentList "`"$harness\mock-gm\server.mjs`"", "--host", "127.0.0.1", "--port", $gmPort, "--script", "`"$harness\mock-gm\combat-script.json`"", "--log", "`"$root\mock-gm-requests.jsonl`"" -PassThru -WindowStyle Hidden -RedirectStandardOutput "$root\mock-gm.log" -RedirectStandardError "$root\mock-gm.err"
    $env:HOST = '127.0.0.1'; $env:PORT = "$port"; $env:DATA_DIR = "$root\marinara"; $env:AUTO_UPDATE_ENABLED = 'false'
    $env:PROVIDER_LOCAL_URLS_ENABLED = 'true'; $env:FITNESS_LEDGER_URL = "http://127.0.0.1:$ledgerPort"
    $procs += Start-Process $node -ArgumentList "scripts\run-server.mjs", "packages\server\dist\index.js" -WorkingDirectory $Marinara -PassThru -WindowStyle Hidden -RedirectStandardOutput "$root\marinara.log" -RedirectStandardError "$root\marinara.err"
    foreach ($k in 'HOST','PORT','DATA_DIR','AUTO_UPDATE_ENABLED','PROVIDER_LOCAL_URLS_ENABLED','FITNESS_LEDGER_URL') { Remove-Item "env:$k" }
    if (-not (Wait-Http "http://127.0.0.1:$ledgerPort/healthz")) { throw 'scratch ledger did not start' }
    if (-not (Wait-Http "$base/")) { throw "staging Marinara did not start; see $root\marinara.log" }
    $connection = @{ name = 'Mock GM'; provider = 'custom'; baseUrl = "http://127.0.0.1:$gmPort/v1"; model = 'mock-gm'; isDefault = $true } | ConvertTo-Json
    Invoke-RestMethod "$base/api/connections" -Method Post -ContentType 'application/json' -Body $connection | Out-Null
    Push-Location $LfrCheckout
    & $node content\build.mjs | Select-Object -Last 1
    $install = & $node content\install.mjs --base $base --name 'Synthetic Tester' 2>&1
    $install | Select-Object -Last 3
    $chat = ($install | Select-String -Pattern 'game ready: chat (\S+)').Matches[0].Groups[1].Value
    "== combat-preparation"
    & $node harness\checks\combat-preparation.mjs --base $base --chat $chat --mock-log "$root\mock-gm-requests.jsonl" | Select-String -Pattern 'FAIL|checks passed'
    "== swipe-persistence"
    & $node harness\checks\swipe-persistence.mjs --base $base | Select-String -Pattern 'FAIL|passed'
    Pop-Location
} finally {
    foreach ($p in $procs) { if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } }
    # run-server.mjs starts the server as a child; end anything still listening on the staging ports.
    Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in $port, $gmPort, $ledgerPort } |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    "staging data: $root"
}
