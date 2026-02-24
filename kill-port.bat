@echo off
REM Batch script to kill processes on specific ports
REM Usage: kill-port.bat <port>

if "%~1"=="" (
    echo Usage: kill-port.bat ^<port^>
    echo Example: kill-port.bat 3000
    exit /b 1
)

set PORT=%~1
echo Checking for processes on port %PORT%...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr LISTENING') do (
    echo Found process with PID: %%a on port %PORT%
    taskkill /PID %%a /F >nul 2>&1
    if %errorlevel% equ 0 (
        echo Successfully killed process %%a on port %PORT%
    ) else (
        echo Failed to kill process %%a
    )
    goto :done
)

echo No process found on port %PORT%

:done