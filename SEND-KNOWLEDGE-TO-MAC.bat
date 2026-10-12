@echo off
setlocal
cd /d "%~dp0"
title Agent HQ - knowledge pack for the Mac
rem Puts what the team knows (database, projects, drawings, rules, Atlas's journal and conversations) in AgentHQ-knowledge.zip
rem on the Desktop. No keys, no phone pairing, no videos. Nothing here is changed. Put the zip on your Drive for the Mac.

set "PY="
where py >nul 2>nul && set "PY=py"
if not defined PY set "PY=python"
%PY% launch.py --knowledge
echo.
pause
