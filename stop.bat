@echo off
setlocal
cd /d "%~dp0"
node "%~dp0scripts\runtime.mjs" stop %*
exit /b %errorlevel%
