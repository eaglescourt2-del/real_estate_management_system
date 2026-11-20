@echo off
echo ========================================================
echo Starting Ghanaian Real Estate Sales & Management System
echo ========================================================
echo.
echo [1/3] Starting Embedded PostgreSQL Database on port 15432...
start "Database Engine (Port 15432)" /min cmd /c "cd /d %~dp0backend && node scripts/start-db.js"
timeout /t 3 >nul

echo [2/3] Starting Backend API Server on port 5000...
start "Backend API (Port 5000)" /min cmd /c "cd /d %~dp0backend && node dist/src/main.js"
timeout /t 3 >nul

echo [3/3] Starting Staff Web Portal on port 3200...
start "Staff Web Portal (Port 3200)" /min cmd /c "cd /d %~dp0frontend && npx next start -p 3200 -H 127.0.0.1"
timeout /t 4 >nul

echo.
echo ========================================================
echo All services launched!
echo - Staff Portal:        http://localhost:3200
echo - Swagger OpenAPI:     http://localhost:5000/api/docs
echo ========================================================
start http://localhost:3200

