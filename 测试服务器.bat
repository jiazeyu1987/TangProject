@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%scripts\deploy-aliyun.ps1"
set "SERVER_HOST=39.106.23.28"
set "SERVER_USER=root"
set "REMOTE_DIR=/root/apps/tangproject"
set "SERVICE_PORT=3000"
set "ALIYUN_SSH_PASSWORD=Showgood1987!"

if not exist "%PS_SCRIPT%" (
  echo [ERROR] Missing script: "%PS_SCRIPT%"
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" ^
  -ServerHost "%SERVER_HOST%" ^
  -ServerUser "%SERVER_USER%" ^
  -RemoteDir "%REMOTE_DIR%" ^
  -ServicePort %SERVICE_PORT% ^
  -DeployMode code-sync ^
  %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [FAILED] Test deployment exited with code %EXIT_CODE%.
  pause
  exit /b %EXIT_CODE%
)

echo.
echo [OK] Test deployment finished.
pause
exit /b 0
