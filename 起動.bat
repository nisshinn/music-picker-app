@echo off

cd /d "%~dp0"

start "" cmd /c "node server.js"

timeout /t 2 /nobreak >nul

start "" "http://127.0.0.1:3000"

exit