@echo off
cd /d "%~dp0"
echo.
echo =======================================
echo   PORTFOLIO STUDIO - LOCAL START
 echo =======================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js 20 or newer from https://nodejs.org/
  pause
  exit /b 1
)
echo Public site: http://localhost:3000
 echo Admin:       http://localhost:3000/admin
 echo.
node server.mjs
pause
