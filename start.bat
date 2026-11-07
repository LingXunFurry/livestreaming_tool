@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.12+ is required. Please install Node.js and retry.
  exit /b 1
)
node "%~dp0scripts\runtime.mjs" start %*
exit /b %errorlevel%
