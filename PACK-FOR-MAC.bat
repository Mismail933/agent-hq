@echo off
setlocal
cd /d "%~dp0"
title Agent HQ - pack for the Mac
rem Puts the company's data (database, keys, briefs, plans, content, Atlas-HQ, the phone pairing) in one zip on the Desktop.
rem Nothing here is changed or deleted. On the Mac, START-HERE.command brings it in.

set "PY="
where py >nul 2>nul && set "PY=py"
if not defined PY set "PY=python"
%PY% launch.py --pack
echo.
pause
