param([ValidateSet('migrate','serve','seed')][string]$Action = 'migrate')
$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
Get-Content -LiteralPath (Join-Path $projectDir '.env') | ForEach-Object {
    if ($_ -match '^([A-Z_]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"'), 'Process')
    }
}
$env:DATABASE_URL = $env:DATABASE_URL.Replace('@postgres:5432/', '@127.0.0.1:5434/') -replace '/lingvo_admin$', '/lingvo_admin_stage2_qa'
if ($env:DATABASE_URL -notmatch '/lingvo_admin_stage2_qa$') { throw 'Expected dedicated QA database' }
$env:ADMIN_WEB_ORIGIN = 'http://localhost:3011'
$env:APPLICATION_STORAGE_PATH = Join-Path $projectDir '.qa-stage2-storage'
$pythonExe = Join-Path $projectDir '.venv-api/Scripts/python.exe'
Set-Location (Join-Path $projectDir 'apps/api')
if ($Action -eq 'migrate') {
    & $pythonExe -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) { throw 'Upgrade failed' }
    & $pythonExe -m alembic downgrade 0004_merge_stage_one
    if ($LASTEXITCODE -ne 0) { throw 'Downgrade failed' }
    & $pythonExe -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) { throw 'Re-upgrade failed' }
} elseif ($Action -eq 'seed') {
    & $pythonExe -m app.cli.stage2_qa
} else {
    & $pythonExe -m uvicorn app.main:app --host 127.0.0.1 --port 8012
}
