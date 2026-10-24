@echo off
title SnipMD release build
echo Building the SnipMD release...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-win11-release.ps1"
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [!] Release build encountered an error. Review the output above.
  pause
)
