[CmdletBinding()]
param(
  [string]$ServerHost = "39.106.23.28",
  [int]$SshPort = 22,
  [string]$ServerUser = "root",
  [string]$RemoteDir = "/root/apps/tangproject",
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [int]$DayCount = 7,
  [switch]$RollbackOnSuccess,
  [switch]$NoRollbackOnFailure,
  [string]$PasswordEnvVar = "ALIYUN_SSH_PASSWORD",
  [switch]$SkipUpload,
  [switch]$SkipInstallDeps,
  [switch]$NoChromiumInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ("[STEP] {0}" -f $Message) -ForegroundColor Cyan
}

function Invoke-External {
  param(
    [string]$Command,
    [string[]]$Arguments,
    [string]$Context
  )

  Write-Host ("> {0} {1}" -f $Command, ($Arguments -join " "))
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Context failed with exit code $LASTEXITCODE."
  }
}

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command -Name $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command '$Name' on local machine."
  }
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Push-Location -LiteralPath $repoRoot

try {
  Write-Step "Validating local prerequisites"
  Require-Command -Name "python"
  Require-Command -Name "node"
  Require-Command -Name "npm"

  $requiredFiles = @(
    "scripts/seed-realistic-test-server.mjs",
    "scripts/run-realistic-seed-remote-paramiko.py",
    "package.json",
    "package-lock.json"
  )
  foreach ($file in $requiredFiles) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
      throw "Missing required file: $file"
    }
  }

  $password = [Environment]::GetEnvironmentVariable($PasswordEnvVar, "Process")
  if (-not $password) {
    $password = [Environment]::GetEnvironmentVariable($PasswordEnvVar, "User")
  }
  if (-not $password) {
    $password = [Environment]::GetEnvironmentVariable($PasswordEnvVar, "Machine")
  }
  if (-not $password) {
    throw "Missing SSH password environment variable: $PasswordEnvVar"
  }

  Write-Step "Running local syntax checks"
  Invoke-External -Command "node" -Arguments @("--check", "scripts/seed-realistic-test-server.mjs") -Context "Node syntax check"
  Invoke-External -Command "python" -Arguments @("-m", "py_compile", "scripts/run-realistic-seed-remote-paramiko.py") -Context "Python syntax check"

  Write-Step "Checking public test-server health"
  $healthRaw = Invoke-RestMethod -Method Get -Uri ("http://{0}:3000/api/health" -f $ServerHost) -TimeoutSec 20
  if (-not $healthRaw.ok) {
    throw "Public test server health failed: ok=false"
  }
  if (-not $healthRaw.configured) {
    throw "Public test server health failed: configured=false, authStatus=$($healthRaw.authStatus)"
  }
  if ($healthRaw.PSObject.Properties.Name -contains "simulation" -and $healthRaw.simulation.enabled) {
    throw "Public test server is already running in simulation mode."
  }

  Write-Step "Running realistic seed workflow on test server"
  $pythonScript = Join-Path $PSScriptRoot "run-realistic-seed-remote-paramiko.py"
  $pythonArgs = @(
    $pythonScript,
    "--repo-root", $repoRoot,
    "--server-host", $ServerHost,
    "--ssh-port", $SshPort.ToString(),
    "--server-user", $ServerUser,
    "--remote-dir", $RemoteDir,
    "--base-url", $BaseUrl,
    "--password-env-var", $PasswordEnvVar,
    "--day-count", $DayCount.ToString()
  )
  if ($RollbackOnSuccess) {
    $pythonArgs += "--rollback-on-success"
  }
  if ($NoRollbackOnFailure) {
    $pythonArgs += "--no-rollback-on-failure"
  }
  if ($SkipUpload) {
    $pythonArgs += "--skip-upload"
  }
  if ($SkipInstallDeps) {
    $pythonArgs += "--skip-install-deps"
  }
  if ($NoChromiumInstall) {
    $pythonArgs += "--no-chromium-install"
  }

  $previousPassword = [Environment]::GetEnvironmentVariable($PasswordEnvVar, "Process")
  [Environment]::SetEnvironmentVariable($PasswordEnvVar, $password, "Process")
  try {
    Invoke-External -Command "python" -Arguments $pythonArgs -Context "Remote realistic seed run"
  } finally {
    [Environment]::SetEnvironmentVariable($PasswordEnvVar, $previousPassword, "Process")
  }
} catch {
  Write-Error $_.Exception.Message
  exit 1
} finally {
  Pop-Location
}
