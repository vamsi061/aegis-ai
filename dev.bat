@echo off
rem Aegis AI launcher for Windows (bypasses execution policy for this script).
rem Starts PostgreSQL (if needed), the backend on :8000 and the console on :5173.
where pwsh >nul 2>nul
if %errorlevel%==0 (
  pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" %*
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" %*
)
