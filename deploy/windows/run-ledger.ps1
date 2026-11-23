# The "lore-fitness-ledger" scheduled task: serve the fitness ledger and restart it if it exits.
# The service takes its own backup into the data folder at every start and keeps the last ten.
. (Join-Path $PSScriptRoot 'common.ps1')
$logs = Join-Path $LfrData 'logs'
New-Item -ItemType Directory -Force $logs | Out-Null
$log = Join-Path $logs 'ledger.log'
$service = Join-Path $LfrCheckout 'service'
while ($true) {
    if ((Test-Path $log) -and (Get-Item $log).Length -gt 10MB) { Move-Item -Force $log "$log.1" }
    try {
        $node = Get-LfrNode
        Push-Location $service
        cmd.exe /d /c "`"$node`" src\main.ts --data `"$LfrData`" --host 0.0.0.0 --port $LfrPort >> `"$log`" 2>&1"
        $code = $LASTEXITCODE
        Pop-Location
        Add-Content $log ("{0} ledger exited with {1}" -f (Get-Date -Format o), $code)
    } catch {
        Add-Content $log ("{0} ledger could not start: {1}" -f (Get-Date -Format o), $_)
    }
    Start-Sleep -Seconds 5
}
