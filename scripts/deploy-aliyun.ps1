[CmdletBinding()]
param(
  [string]$ServerHost = "47.116.122.8",
  [int]$SshPort = 22,
  [string]$ServerUser = "root",
  [int]$ServicePort = 3000,
  [string]$RemoteDir = "/root/apps/tangproject",
  [string]$DeployEnvFile = ".env.deploy",
  [switch]$PromptForPassword,
  [string]$PasswordEnvVar = "ALIYUN_SSH_PASSWORD"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ("[STEP] {0}" -f $Message) -ForegroundColor Cyan
}

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command -Name $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command '$Name' on local machine."
  }
}

function Assert-FileExists {
  param(
    [string]$Path,
    [string]$Label
  )
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Missing required file for deployment: $Label ($Path)."
  }
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

function Invoke-ExternalCapture {
  param(
    [string]$Command,
    [string[]]$Arguments,
    [string]$Context
  )

  Write-Host ("> {0} {1}" -f $Command, ($Arguments -join " "))
  $output = & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Context failed with exit code $LASTEXITCODE."
  }
  return ($output -join [Environment]::NewLine)
}

function Test-SshKeyAuth {
  param(
    [string]$Remote,
    [int]$Port
  )

  $stdoutFile = [System.IO.Path]::GetTempFileName()
  $stderrFile = [System.IO.Path]::GetTempFileName()

  try {
    $proc = Start-Process -FilePath "ssh" -ArgumentList @(
      "-o", "BatchMode=yes",
      "-o", "ConnectTimeout=8",
      "-p", $Port.ToString(),
      $Remote,
      "echo KEY_AUTH_OK"
    ) -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
    return ($proc.ExitCode -eq 0)
  } finally {
    Remove-Item -LiteralPath $stdoutFile -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $stderrFile -ErrorAction SilentlyContinue
  }
}

function Resolve-SshPassword {
  param(
    [string]$EnvVarName,
    [string]$RemoteLabel,
    [switch]$Prompt
  )

  $value = [Environment]::GetEnvironmentVariable($EnvVarName, "Process")
  if (-not $value) {
    $value = [Environment]::GetEnvironmentVariable($EnvVarName, "User")
  }
  if (-not $value) {
    $value = [Environment]::GetEnvironmentVariable($EnvVarName, "Machine")
  }
  if (-not $value -and $Prompt) {
    $value = Read-Host -Prompt "Enter SSH password for $RemoteLabel"
  }

  return $value
}

function Invoke-RestJsonWithRetry {
  param(
    [string]$Uri,
    [int]$TimeoutSec = 30,
    [int]$Attempts = 12,
    [int]$SleepSeconds = 3,
    [string]$Context = "HTTP request"
  )

  $lastMessage = ""
  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    try {
      return Invoke-RestMethod -Method Get -Uri $Uri -TimeoutSec $TimeoutSec
    } catch {
      $lastMessage = $_.Exception.Message
      if ($attempt -lt $Attempts) {
        Start-Sleep -Seconds $SleepSeconds
      }
    }
  }

  throw "$Context failed after $Attempts attempts. Last error: $lastMessage"
}

function Get-DotEnvValue {
  param(
    [string]$Content,
    [string]$Name
  )

  $pattern = "^\s*" + [regex]::Escape($Name) + "\s*=\s*(.*)$"
  foreach ($rawLine in ($Content -split "`r?`n")) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith("#")) {
      continue
    }
    if ($line -notmatch $pattern) {
      continue
    }
    $value = $Matches[1].Trim()
    if ($value.Length -ge 2) {
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
    }
    return $value
  }

  return ""
}

function Escape-SingleQuotesForPosix {
  param([string]$Value)
  return $Value -replace "'", "'""'""'"
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Push-Location -LiteralPath $repoRoot

try {
  Write-Step "Validating local prerequisites"
  Require-Command -Name "powershell"
  Require-Command -Name "ssh"
  Require-Command -Name "python"
  Require-Command -Name "npm"

  $requiredRootFiles = @(
    ".dockerignore",
    "Dockerfile",
    "docker-compose.yml",
    "package.json",
    "package-lock.json",
    "server.js",
    "README.md"
  )
  $requiredPublicFiles = @(
    "public/index.html",
    "public/app.js",
    "public/styles.css"
  )
  $requiredDataFiles = @(
    "data/intake-schema.json",
    "data/followup-questions-schema.json",
    "data/seed-store.json"
  )

  foreach ($file in ($requiredRootFiles + $requiredPublicFiles + $requiredDataFiles)) {
    Assert-FileExists -Path $file -Label $file
  }

  Assert-FileExists -Path $DeployEnvFile -Label "Deploy env file"
  $deployEnvPath = (Resolve-Path -LiteralPath $DeployEnvFile).Path
  $deployEnvContent = Get-Content -LiteralPath $deployEnvPath -Raw -Encoding utf8

  $apiKey = Get-DotEnvValue -Content $deployEnvContent -Name "OPENAI_API_KEY"
  if (-not $apiKey) {
    throw "OPENAI_API_KEY is empty in deploy env file: $deployEnvPath."
  }

  $baseUrl = Get-DotEnvValue -Content $deployEnvContent -Name "RESPONSES_BASE_URL"
  if ($baseUrl -and $baseUrl -match "/responses/?$") {
    throw "RESPONSES_BASE_URL must be API root and must not end with /responses. Current value: $baseUrl"
  }

  Write-Step "Running local static checks"
  Invoke-External -Command "npm" -Arguments @("run", "check") -Context "Local syntax check"

  $remote = "$ServerUser@$ServerHost"
  $remoteDirEscaped = Escape-SingleQuotesForPosix -Value $RemoteDir
  $remoteDirQuoted = "'$remoteDirEscaped'"
  $internalHealthConfigured = $false

  $keyAuthReady = Test-SshKeyAuth -Remote $remote -Port $SshPort
  if ($keyAuthReady) {
    Write-Step "SSH key authentication is available; using ssh/scp transport"
    Require-Command -Name "scp"

    Write-Step "Checking remote prerequisites and preparing directories"
    $remotePrep = "set -euo pipefail; command -v docker >/dev/null 2>&1 || { echo 'ERROR: docker is required on remote host.' >&2; exit 31; }; docker compose version >/dev/null 2>&1 || { echo 'ERROR: docker compose plugin is required on remote host.' >&2; exit 32; }; command -v curl >/dev/null 2>&1 || { echo 'ERROR: curl is required on remote host.' >&2; exit 33; }; mkdir -p $remoteDirQuoted/public $remoteDirQuoted/data"
    Invoke-External -Command "ssh" -Arguments @("-p", $SshPort.ToString(), $remote, $remotePrep) -Context "Remote prerequisite check"

    Write-Step "Uploading project files"
    $rootUploadSources = $requiredRootFiles | ForEach-Object { (Resolve-Path -LiteralPath $_).Path }
    $publicUploadSources = $requiredPublicFiles | ForEach-Object { (Resolve-Path -LiteralPath $_).Path }
    $dataUploadSources = $requiredDataFiles | ForEach-Object { (Resolve-Path -LiteralPath $_).Path }

    Invoke-External -Command "scp" -Arguments (@("-P", $SshPort.ToString()) + $rootUploadSources + @("${remote}:$RemoteDir/")) -Context "Root file upload"
    Invoke-External -Command "scp" -Arguments (@("-P", $SshPort.ToString()) + $publicUploadSources + @("${remote}:$RemoteDir/public/")) -Context "Public file upload"
    Invoke-External -Command "scp" -Arguments (@("-P", $SshPort.ToString()) + $dataUploadSources + @("${remote}:$RemoteDir/data/")) -Context "Data file upload"
    Invoke-External -Command "scp" -Arguments @("-P", $SshPort.ToString(), $deployEnvPath, "${remote}:$RemoteDir/.env.deploy") -Context "Deploy env upload"

    Write-Step "Rebuilding and restarting remote container"
    $remoteDeploy = "set -euo pipefail; cd $remoteDirQuoted; cp .env.deploy .env.example; docker compose build --no-cache tang-project; docker compose up -d --force-recreate tang-project; docker compose ps tang-project"
    Invoke-External -Command "ssh" -Arguments @("-p", $SshPort.ToString(), $remote, $remoteDeploy) -Context "Remote deploy"

    Write-Step "Validating remote health from server side"
    $internalHealthRaw = Invoke-ExternalCapture -Command "ssh" -Arguments @("-p", $SshPort.ToString(), $remote, "set -euo pipefail; curl -fsS http://127.0.0.1:$ServicePort/api/health") -Context "Remote internal health check"
    $internalHealth = $internalHealthRaw | ConvertFrom-Json
    if (-not $internalHealth.configured) {
      throw "Remote internal health check failed: configured=false, authStatus=$($internalHealth.authStatus)"
    }
    $internalHealthConfigured = [bool]$internalHealth.configured
  } else {
    $sshPassword = Resolve-SshPassword -EnvVarName $PasswordEnvVar -RemoteLabel $remote -Prompt:$PromptForPassword
    if (-not $sshPassword) {
      throw "SSH key authentication is unavailable and no password was provided. Set $PasswordEnvVar or rerun with -PromptForPassword."
    }

    Write-Step "Running remote deploy via password authentication (Paramiko)"
    $paramikoScript = Join-Path $PSScriptRoot "deploy-aliyun-paramiko.py"
    Assert-FileExists -Path $paramikoScript -Label "Paramiko deploy script"

    $previousPassword = [Environment]::GetEnvironmentVariable($PasswordEnvVar, "Process")
    [Environment]::SetEnvironmentVariable($PasswordEnvVar, $sshPassword, "Process")
    try {
      Invoke-External -Command "python" -Arguments @(
        $paramikoScript,
        "--repo-root", $repoRoot,
        "--deploy-env-file", $deployEnvPath,
        "--server-host", $ServerHost,
        "--ssh-port", $SshPort.ToString(),
        "--server-user", $ServerUser,
        "--remote-dir", $RemoteDir,
        "--service-port", $ServicePort.ToString(),
        "--password-env-var", $PasswordEnvVar
      ) -Context "Remote deploy via Paramiko"
    } finally {
      [Environment]::SetEnvironmentVariable($PasswordEnvVar, $previousPassword, "Process")
    }
    $internalHealthConfigured = $true
  }

  Write-Step "Validating remote health from public endpoint"
  $publicHealth = Invoke-RestJsonWithRetry -Uri "http://${ServerHost}:$ServicePort/api/health" -Context "Public health check"
  if (-not $publicHealth.configured) {
    throw "Public health check failed: configured=false, authStatus=$($publicHealth.authStatus)"
  }

  Write-Step "Validating remote bootstrap payload"
  $bootstrapUri = "http://${ServerHost}:$ServicePort/api/bootstrap"
  $bootstrap = $null
  try {
    $bootstrap = Invoke-RestMethod -Method Get -Uri $bootstrapUri -TimeoutSec 20
  } catch {
    $response = $_.Exception.Response
    $statusCode = $null
    if ($response) {
      $statusCode = [int]$response.StatusCode
    }
    if ($statusCode -ne 401) {
      throw
    }

    Write-Step "Bootstrap is protected by auth, validating via login"
    $verifyAccount = "user-li-wei"
    $verifyPassword = "123456"
    $loginBody = @{ account = $verifyAccount; password = $verifyPassword } | ConvertTo-Json
    $loginResp = Invoke-RestMethod -Method Post -Uri "http://${ServerHost}:$ServicePort/api/auth/login" -ContentType "application/json" -Body $loginBody -TimeoutSec 20
    if (-not $loginResp.token) {
      throw "Public bootstrap auth verification failed: login did not return token."
    }
    $authHeaders = @{ Authorization = "Bearer $($loginResp.token)" }
    $bootstrap = Invoke-RestMethod -Method Get -Uri $bootstrapUri -Headers $authHeaders -TimeoutSec 20
  }
  if ($null -eq $bootstrap.projects -or $null -eq $bootstrap.tasks) {
    throw "Bootstrap payload missing required fields: projects/tasks."
  }
  $projectCount = @($bootstrap.projects).Count
  $taskCount = @($bootstrap.tasks).Count

  Write-Host ""
  Write-Host "Deployment and verification finished successfully." -ForegroundColor Green
  Write-Host ("Server: {0}@{1}:{2}" -f $ServerUser, $ServerHost, $ServicePort)
  Write-Host ("Internal configured: {0}" -f $internalHealthConfigured)
  Write-Host ("Public configured: {0}" -f $publicHealth.configured)
  Write-Host ("Bootstrap projectCount={0}, taskCount={1}" -f $projectCount, $taskCount)
  Write-Host ("Health URL: http://{0}:{1}/api/health" -f $ServerHost, $ServicePort)
} catch {
  Write-Error $_.Exception.Message
  exit 1
} finally {
  Pop-Location
}
