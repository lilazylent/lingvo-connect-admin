param(
    [switch]$Execute,
    [string]$KeepAdminEmail = ""
)

$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
Set-Location $projectDir

$argsList = @('compose', 'exec', 'backend', 'python', '-m', 'app.cli.pre_release_cleanup')
if ($KeepAdminEmail) {
    $argsList += @('--keep-admin-email', $KeepAdminEmail)
}
if ($Execute) {
    $argsList += '--execute'
}

Write-Host "Running pre-release cleanup against the current Docker database..."
if (-not $Execute) {
    Write-Host "DRY RUN: nothing will be deleted. Re-run with -Execute after checking the preserved ADMIN."
}
& docker @argsList
if ($LASTEXITCODE -ne 0) { throw 'Pre-release cleanup failed.' }
