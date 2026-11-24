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
$copyLog = Join-Path $backup 'robocopy.log'
robocopy $marinaraData (Join-Path $backup 'Marinara-Data') /E /XD (Join-Path $marinaraData 'backups') (Join-Path $marinaraData 'models') (Join-Path $marinaraData 'sidecar-runtime') /R:1 /W:1 /NP /NFL /NDL /LOG:$copyLog | Out-Null
# Some folders refuse their attributes (robocopy counts them as failed directories); only a file
# that did not copy means the backup is incomplete.
$files = Select-String -Path $copyLog -Pattern '^\s*Files :\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)' | Select-Object -Last 1
if (-not $files -or [int]$files.Matches[0].Groups[5].Value -gt 0) { Say "data backup incomplete (see $copyLog); not switching"; exit 1 }
Copy-Item .env (Join-Path $backup 'Marinara-Engine.env')
Start-ScheduledTask -TaskName 'lore-fitness-ledger-backup' -ErrorAction SilentlyContinue
Say "backed up to $backup"

# 4. Move the branch and build with the repository's pinned pnpm under the .nvmrc Node.
if ($dirty.Count) { git checkout -- $dirty; Say "reset $($dirty.Count) tracked files (saved elsewhere)" }
git merge --ff-only $Branch 2>&1 | ForEach-Object { Add-Content $log $_ }
# The Node the checkout pins in .nvmrc (a major version, such as 25), from fnm's installs; Node 25
# has no Corepack, so the pinned pnpm comes through npx.
$major = (Get-Content .nvmrc).Trim().TrimStart('v').Split('.')[0]
$nodeDir = Get-ChildItem (Join-Path $env:APPDATA 'fnm\node-versions') -Directory |
    Where-Object { $_.Name -like "v$major.*" } | Sort-Object { [version]($_.Name.TrimStart('v')) } -Descending |
    Select-Object -First 1 | ForEach-Object { Join-Path $_.FullName 'installation' }
if (-not $nodeDir) { Say "no Node $major under fnm; not building"; exit 1 }
$env:PATH = "$nodeDir;$env:PATH"
$pnpmVersion = ((Get-Content package.json | ConvertFrom-Json).packageManager -replace '^pnpm@', '' -split '\+')[0]
function Pnpm([string]$what) {
    cmd.exe /d /c "npx --yes pnpm@$pnpmVersion $what >> `"$log`" 2>&1"
    return $LASTEXITCODE
}
$installed = Pnpm 'install --frozen-lockfile'
$built = if ($installed -eq 0) { Pnpm 'build' } else { $installed }
if ($built -ne 0) {
    Say "install or build failed ($installed/$built); returning to $previous"
    git reset --hard $previous 2>&1 | ForEach-Object { Add-Content $log $_ }
    Pnpm 'install --frozen-lockfile' | Out-Null; Pnpm 'build' | Out-Null
} else { Say "built $(git rev-parse --short HEAD) with Node $major and pnpm $pnpmVersion" }

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
