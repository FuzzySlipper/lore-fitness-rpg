# The "lore-fitness-ledger-backup" scheduled task: a consistent copy of the ledger (VACUUM INTO, safe
# while the service runs) into Documents, where the nightly Den Windows Backup picks it up.
. (Join-Path $PSScriptRoot 'common.ps1')
New-Item -ItemType Directory -Force $LfrBackupDir | Out-Null
$out = Join-Path $LfrBackupDir ("ledger-{0}.sqlite" -f (Get-Date -Format 'yyyyMMdd-HHmm'))
$node = Get-LfrNode
Push-Location (Join-Path $LfrCheckout 'service')
& $node src\cli.ts backup --data $LfrData --out $out
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { throw "backup failed with $code" }
Get-ChildItem $LfrBackupDir -Filter 'ledger-*.sqlite' | Sort-Object Name -Descending |
    Select-Object -Skip $LfrKeepBackups | Remove-Item -Force
