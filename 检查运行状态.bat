@echo off
call "%~dp0status.bat" %*
set "tavern_result=%errorlevel%"
if not "%~1"=="--json" pause
exit /b %tavern_result%
