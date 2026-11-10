@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or is not available on PATH.
  echo Install Node.js, then double-click this file again.
  pause
  exit /b 1
)

if not exist "node_modules\next" (
  echo Project dependencies are missing. Installing them now...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

node scripts\start-mytv.cjs
echo.
echo myTV has stopped. Press any key to close this window.
pause >nul
