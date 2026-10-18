@echo off
title SnipMD v0.1.0 - Windows 11 Release Packager
echo Launching SnipMD Windows 11 Release Packager...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-win11-release.ps1"
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [!] Release build encountered an error. Review the output above.
  pause
)
