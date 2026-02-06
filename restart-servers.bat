@echo off
echo Stopping all Node processes...
taskkill /F /IM node.exe 2>nul

timeout /t 2 /nobreak >nul

echo.
echo Starting backend server (port 3001)...
cd /d "%~dp0server"
start "Backend" cmd /k "npm run dev"

timeout /t 5 /nobreak >nul

echo.
echo Starting frontend server (port 3000)...
cd /d "%~dp0client"
start "Frontend" cmd /k "npm run dev"

echo.
echo Done! Servers are starting...
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
pause
