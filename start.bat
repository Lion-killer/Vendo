@echo off
echo ==============================================
echo        Starting Vendo Application
echo ==============================================
echo.

echo [1/2] Starting Backend API Server (Port 3000)...
start "Vendo Backend" cmd /k "cd backend && npm start"

timeout /t 2 /nobreak > nul

echo [2/2] Starting Frontend Vite Server...
start "Vendo Frontend" cmd /k "cd frontend && npm run dev -- --host"

echo.
echo All servers are starting up! 
echo.
echo The backend is available at:  http://localhost:3000
echo The frontend is available at: http://localhost:5173 
echo.
echo You can close this window. The servers will run in the newly opened windows.
pause
