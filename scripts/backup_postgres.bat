@echo off
REM ==============================================================================
REM Windows Automated PostgreSQL Database Backup Script
REM ==============================================================================
setlocal enabledelayedexpansion

set BACKUP_DIR=%~dp0backups
set TIMESTAMP=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP_FILE=%BACKUP_DIR%\real_estate_db_%TIMESTAMP%.sql

echo [%date% %time%] Initiating PostgreSQL database backup...
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

docker exec -t real_estate_postgres pg_dump -U postgres -d real_estate_db --clean --if-exists --no-owner > "%BACKUP_FILE%"

echo [%date% %time%] Database backup completed successfully: %BACKUP_FILE%
