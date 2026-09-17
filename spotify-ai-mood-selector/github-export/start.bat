@echo off
cd /d "%~dp0"
echo Starting Music Picker...
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
start "" cmd /c "node server.js"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:3000"
exit
