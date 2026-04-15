[CmdletBinding()]
param(
  [string]$Scenario = "default-month",
  [string]$ServerHost = "39.106.23.28",
  [int]$SshPort = 22,
  [string]$ServerUser = "root",
  [string]$RemoteDir = "/root/apps/tangproject",
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

if ($Scenario -notmatch "^[A-Za-z0-9._-]+$") {
  throw "Scenario name is invalid. Allowed chars: A-Z, a-z, 0-9, dot, underscore, hyphen."
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Push-Location -LiteralPath $repoRoot

try {
  Write-Step "Validating local prerequisites"
  if (-not (Get-Command -Name "python" -ErrorAction SilentlyContinue)) {
    throw "Missing required command 'python' on local machine."
  }
  if (-not (Get-Command -Name "npm" -ErrorAction SilentlyContinue)) {
    throw "Missing required command 'npm' on local machine."
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

  Write-Step "Running local simulation static checks"
  Invoke-External -Command "npm" -Arguments @("run", "check:sim") -Context "Local simulation check"

  Write-Step ("Running simulation on test server with scenario '{0}'" -f $Scenario)
  $pythonScript = Join-Path $PSScriptRoot "run-simulation-remote-paramiko.py"
  if (-not (Test-Path -LiteralPath $pythonScript -PathType Leaf)) {
    throw "Missing required script: $pythonScript"
  }

  $pythonArgs = @(
    $pythonScript,
    "--repo-root", $repoRoot,
    "--server-host", $ServerHost,
    "--ssh-port", $SshPort.ToString(),
    "--server-user", $ServerUser,
    "--remote-dir", $RemoteDir,
    "--scenario", $Scenario,
    "--password-env-var", $PasswordEnvVar
  )
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
    Invoke-External -Command "python" -Arguments $pythonArgs -Context "Remote simulation run via Paramiko"
  } finally {
    [Environment]::SetEnvironmentVariable($PasswordEnvVar, $previousPassword, "Process")
  }
} catch {
  Write-Error $_.Exception.Message
  exit 1
} finally {
  Pop-Location
}
