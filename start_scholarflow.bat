@echo off
title ScholarFlow Platform Starter
color 0B
echo =======================================================================
echo              ScholarFlow Scholarly Publishing Platform
echo                   Automated Full-Stack Launcher
echo =======================================================================
echo.

:: 1. Check MySQL
echo [1/4] Checking MySQL Database...
tasklist /FI "IMAGENAME eq mysqld.exe" 2>NUL | find /I /N "mysqld.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo     [OK] MySQL service is already active.
) else (
    echo     [*] Starting MySQL server...
    pushd "C:\xampp"
    start "" "C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini" --standalone
    popd
    timeout /t 2 /nobreak >NUL
    echo     [OK] MySQL server started.
)

:: 2. Check Apache Web Server (OJS)
echo [2/4] Checking Apache Web Server (OJS)...
tasklist /FI "IMAGENAME eq httpd.exe" 2>NUL | find /I /N "httpd.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo     [OK] Apache web server is already active.
) else (
    echo     [*] Starting Apache web server...
    pushd "C:\xampp\apache"
    start "" "C:\xampp\apache\bin\httpd.exe"
    popd
    timeout /t 2 /nobreak >NUL
    echo     [OK] Apache web server started.
)

:: 3. Check Ollama LLM Service
echo [3/4] Checking Ollama Local LLM Engine...
netstat -ano | findstr ":11434 " >NUL
if "%ERRORLEVEL%"=="0" (
    echo     [OK] Ollama service is listening on port 11434.
) else (
    echo     [*] Starting Ollama daemon...
    start "" "C:\Users\shivj\AppData\Local\Programs\Ollama\ollama.exe" serve
    timeout /t 3 /nobreak >NUL
    echo     [OK] Ollama daemon started.
)

:: 4. Start Python FastAPI AI Backend
echo [4/4] Checking ScholarFlow AI Backend (FastAPI)...
netstat -ano | findstr ":8000 " >NUL
if "%ERRORLEVEL%"=="0" (
    echo     [OK] ScholarFlow FastAPI backend is listening on port 8000.
) else (
    echo     [*] Launching ScholarFlow Python backend on port 8000...
    pushd "C:\xampp\scholarflow-backend"
    start "ScholarFlow Backend" "C:\xampp\scholarflow-backend\venv\Scripts\uvicorn.exe" main:app --host 127.0.0.1 --port 8000
    popd
    timeout /t 3 /nobreak >NUL
    echo     [OK] ScholarFlow Python backend launched.
)

echo.
echo =======================================================================
echo    ScholarFlow Platform is Ready!
echo.
echo    [1] Main OJS Portal:  http://localhost/ojs/index.php/test/dashboard/editorial?currentViewId=assigned-to-me
echo    [2] AI Backend Hub:   http://127.0.0.1:8000/
echo    [3] API Health:       http://127.0.0.1:8000/api/health
echo =======================================================================
echo.
echo Launching ScholarFlow in your default browser...
timeout /t 2 /nobreak >NUL
start http://localhost/ojs/index.php/test/dashboard/editorial?currentViewId=assigned-to-me

echo.
echo You can keep this window open or close it. Press any key to exit.
pause >NUL
