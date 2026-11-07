@echo off
call "%~dp0stop.bat" %*
set "tavern_result=%errorlevel%"
if not "%~1"=="--json" pause
exit /b %tavern_result%
