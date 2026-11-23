# Shared settings for the Lore fitness ledger on den-lore. Dot-sourced by the other scripts.
# Paths are the stage 6 defaults (docs/06-stabilization-and-release.md); change them here only.
$LfrCheckout = 'C:\Dev\lore-fitness-rpg'
$LfrData = 'C:\Dev\Lore-Fitness-RPG-Data'
$LfrPort = 7900
# Daily copies go under Documents so the existing "Den Windows Backup" task carries them off the machine.
$LfrBackupDir = Join-Path $env:USERPROFILE 'Documents\Lore Fitness RPG\ledger-backups'
$LfrKeepBackups = 30

# The newest Node 24+ that fnm has installed for this user; a scheduled task has no fnm shell.
function Get-LfrNode {
    $versions = Join-Path $env:APPDATA 'fnm\node-versions'
    $best = Get-ChildItem $versions -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^v(\d+)\.(\d+)\.(\d+)$' -and [int]$Matches[1] -ge 24 } |
        Sort-Object { [version]($_.Name.TrimStart('v')) } -Descending | Select-Object -First 1
    if (-not $best) { throw "No Node 24 or newer under $versions (install one with fnm)." }
    Join-Path $best.FullName 'installation\node.exe'
}
