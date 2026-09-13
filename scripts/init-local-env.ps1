$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repositoryRoot ".env"

if (Test-Path -LiteralPath $envPath) {
    Write-Host ".env already exists. Nothing changed."
    exit 0
}

function New-RandomUrlSafe([int]$bytes) {
    $buffer = New-Object byte[] $bytes
    [Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
    return [Convert]::ToBase64String($buffer).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$postgresPassword = New-RandomUrlSafe 24
$sessionSecret = New-RandomUrlSafe 48
$fernetBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($fernetBytes)
$fernetKey = [Convert]::ToBase64String($fernetBytes).Replace('+', '-').Replace('/', '_')

$content = @"
POSTGRES_DB=lingvo_admin
POSTGRES_USER=lingvo_admin
POSTGRES_PASSWORD=$postgresPassword
POSTGRES_PORT=5434
API_PORT=8002
ADMIN_WEB_PORT=3003
DATABASE_URL=postgresql+psycopg://lingvo_admin:$postgresPassword@postgres:5432/lingvo_admin
SESSION_SECRET=$sessionSecret
TOTP_ENCRYPTION_KEY=$fernetKey
COOKIE_SECURE=false
ADMIN_WEB_ORIGIN=http://localhost:3003
NEXT_PUBLIC_API_URL=http://localhost:8002
"@

[IO.File]::WriteAllText($envPath, $content, [Text.UTF8Encoding]::new($false))
Write-Host "Created local .env with generated secrets. The file is ignored by Git."
