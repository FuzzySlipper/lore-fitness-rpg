# Switch Lore's running Marinara (C:\Dev\Marinara-Engine) to a tested branch and restart it the way
# her desktop shortcut does. Run from an elevated PowerShell as Lore's account, after the branch has
# passed staging-smoke.ps1. See docs/06-stabilization-and-release.md (den-lore runbook).
#
#   powershell -ExecutionPolicy Bypass -File deploy\windows\switch-marinara.ps1 -Branch deploy/lore-desktop
#
# -DiscardTrackedChanges: the checkout's uncommitted edits to tracked files are already saved on a
# branch and may be reset. Without it, a checkout with such edits is left alone and nothing happens.
param([Parameter(Mandatory)][string]$Branch, [switch]$DiscardTrackedChanges)
. (Join-Path $PSScriptRoot 'common.ps1')
$engine = 'C:\Dev\Marinara-Engine'
$marinaraData = 'C:\Dev\Marinara-Data'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $LfrData "pre-deploy\$stamp"
$log = Join-Path $LfrData "logs\switch-marinara-$stamp.log"
New-Item -ItemType Directory -Force $backup, (Split-Path $log) | Out-Null
function Say($text) { $line = "{0} {1}" -f (Get-Date -Format o), $text; $line; Add-Content $log $line }
Set-Location $engine
$port = (Get-Content .env | Where-Object { $_ -match '^\s*PORT=(\d+)' } | ForEach-Object { $Matches[1] }) | Select-Object -First 1
if (-not $port) { $port = 7860 }

# 1. Preconditions, before anything stops.
$dirty = @(git diff --name-only HEAD)
if ($dirty.Count -and -not $DiscardTrackedChanges) { Say "tracked files have uncommitted changes; save them on a branch and pass -DiscardTrackedChanges"; $dirty | ForEach-Object { Say "  $_" }; exit 1 }
git merge-base --is-ancestor HEAD $Branch
if ($LASTEXITCODE -ne 0) { Say "$Branch does not contain the current HEAD; merge it first"; exit 1 }
$previous = git rev-parse HEAD
Say "switching $engine from $previous to $Branch ($(git rev-parse --short $Branch)) on port $port"

# 2. Stop the running Marinara: the process on the port and the launcher chain above it.
$listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
    $id = $listener.OwningProcess
    foreach ($i in 1..4) {
        $p = Get-CimInstance Win32_Process -Filter "ProcessId=$id"
        if (-not $p -or $p.Name -eq 'explorer.exe') { break }
        Say "stopping $($p.ProcessId) $($p.Name)"
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        $id = $p.ParentProcessId
    }
    Start-Sleep -Seconds 3
}

# 3. Back up the data (not Marinara's own backups, models or sidecar runtime) and .env.
robocopy $marinaraData (Join-Path $backup 'Marinara-Data') /E /XD (Join-Path $marinaraData 'backups') (Join-Path $marinaraData 'models') (Join-Path $marinaraData 'sidecar-runtime') /R:1 /W:1 /NP /NFL /NDL | Out-Null
if ($LASTEXITCODE -ge 8) { Say "data backup failed (robocopy $LASTEXITCODE); not switching"; exit 1 }
Copy-Item .env (Join-Path $backup 'Marinara-Engine.env')
Start-ScheduledTask -TaskName 'lore-fitness-ledger-backup' -ErrorAction SilentlyContinue
Say "backed up to $backup"

# 4. Move the branch and build with the repository's pinned pnpm under the .nvmrc Node.
if ($dirty.Count) { git checkout -- $dirty; Say "reset $($dirty.Count) tracked files (saved elsewhere)" }
git merge --ff-only $Branch 2>&1 | ForEach-Object { Add-Content $log $_ }
$fnm = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\fnm.exe'
$pnpmVersion = ((Get-Content package.json | ConvertFrom-Json).packageManager -replace '^pnpm@', '' -split '\+')[0]
function Pnpm([string]$what) {
    & $fnm exec --using "$engine\.nvmrc" cmd.exe /d /c "corepack pnpm@$pnpmVersion $what >> `"$log`" 2>&1 || npx --yes pnpm@$pnpmVersion $what >> `"$log`" 2>&1"
    $LASTEXITCODE
}
$ok = (Pnpm 'install --frozen-lockfile') -eq 0 -and (Pnpm 'build') -eq 0
if (-not $ok) {
    Say "build failed; returning to $previous"
    git reset --hard $previous 2>&1 | ForEach-Object { Add-Content $log $_ }
    Pnpm 'install --frozen-lockfile' | Out-Null; Pnpm 'build' | Out-Null
} else { Say "built $(git rev-parse --short HEAD)" }

# 5. Start it in Lore's desktop session, as the desktop shortcut does.
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $env:USERPROFILE 'Desktop\Marinara.lnk'))
$action = New-ScheduledTaskAction -Execute $shortcut.TargetPath -Argument $shortcut.Arguments -WorkingDirectory $shortcut.WorkingDirectory
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive
Register-ScheduledTask -TaskName 'lore-marinara-start-once' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'lore-marinara-start-once'
$up = $false
foreach ($i in 1..120) { Start-Sleep -Seconds 2; try { Invoke-WebRequest "http://127.0.0.1:$port/" -UseBasicParsing -TimeoutSec 3 | Out-Null; $up = $true; break } catch { } }
Unregister-ScheduledTask -TaskName 'lore-marinara-start-once' -Confirm:$false
if ($up) { Say "Marinara answering on port $port at $(git rev-parse --short HEAD)" } else { Say "Marinara did not answer on port $port; start it from the desktop shortcut and see $log" }
