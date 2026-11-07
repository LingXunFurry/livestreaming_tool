@echo off
cd /d "%~dp0"
call "%~dp0start.bat" %*
if not "%~1"=="--json" pause
