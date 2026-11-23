# Install or update the fitness ledger on den-lore. Run from an elevated PowerShell as Lore's account:
#   powershell -ExecutionPolicy Bypass -File C:\Dev\lore-fitness-rpg\deploy\windows\install-ledger.ps1
# Safe to run again: it replaces the two tasks and the firewall rule, keeps the data, and restarts
# the service so an updated checkout takes effect.
. (Join-Path $PSScriptRoot 'common.ps1')
New-Item -ItemType Directory -Force $LfrData, $LfrBackupDir | Out-Null
$node = Get-LfrNode
"node: $node"

# The signed-in identity, not USERDOMAIN, which an SSH session does not set to the machine name.
$user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
$ps = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"

# The service: at boot, restarted by its own loop and, should the loop die, by the task.
$run = New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSScriptRoot\run-ledger.ps1`""
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Stop-ScheduledTask -TaskName 'lore-fitness-ledger' -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName 'lore-fitness-ledger' -Action $run -Trigger (New-ScheduledTaskTrigger -AtStartup) `
    -Principal $principal -Settings $settings -Description 'Lore fitness RPG ledger (lore-fitness-rpg/deploy/windows)' -Force | Out-Null

# The daily copy into Documents, before the nightly Den Windows Backup.
$backup = New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSScriptRoot\backup-ledger.ps1`""
$backupSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName 'lore-fitness-ledger-backup' -Action $backup -Trigger (New-ScheduledTaskTrigger -Daily -At '20:30') `
    -Principal $principal -Settings $backupSettings -Description 'Daily copy of the Lore fitness ledger into Documents' -Force | Out-Null

# The phone and watch reach the ledger over the home network only.
Remove-NetFirewallRule -DisplayName 'Lore fitness ledger' -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName 'Lore fitness ledger' -Direction Inbound -Protocol TCP -LocalPort $LfrPort `
    -Profile Private -RemoteAddress LocalSubnet -Action Allow | Out-Null

# Restart: end the running loop and its node, then start the task again.
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*run-ledger.ps1*' -or ($_.Name -eq 'node.exe' -and $_.CommandLine -like '*src\main.ts*--port*' + $LfrPort + '*') } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-ScheduledTask -TaskName 'lore-fitness-ledger'
foreach ($i in 1..30) {
    Start-Sleep -Seconds 1
    try { $health = Invoke-RestMethod "http://127.0.0.1:$LfrPort/healthz" -TimeoutSec 2; break } catch { }
}
if ($health) { "ledger up on port ${LfrPort}: $($health | ConvertTo-Json -Compress)" } else { "ledger did not answer on port $LfrPort; see $LfrData\logs\ledger.log" }
