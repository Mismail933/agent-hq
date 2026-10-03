@echo off
setlocal
cd /d "%~dp0"
title Agent HQ
rem This file stays the same forever. All the real work is in launch.py, which updates itself.

set "PY="
where py >nul 2>nul && set "PY=py"
if not defined PY (where python >nul 2>nul && python --version >nul 2>nul && set "PY=python")
if not defined PY (
  echo.
  echo  Python is not installed. It is needed to run the agents.
  choice /c YN /m " Install Python 3.12 now"
  if errorlevel 2 (
    echo  Get it from https://www.python.org/downloads/ ^(tick "Add python.exe to PATH"^), then run this file again.
    pause
    exit /b 1
  )
  winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
  echo.
  echo  Python installed. Close this window and double-click START-HERE again.
  pause
  exit /b 0
)

%PY% launch.py %*
echo.
pause
