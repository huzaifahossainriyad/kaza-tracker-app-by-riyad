@echo off
title Kaza Tracker App Launcher

echo.
echo ========================================
echo  Starting Kaza Tracker Application...
echo ========================================
echo.

REM Navigate to the project directory
cd /d "D:\RIYAD HOSSAIN HUZAIFA (D:)\Document\Royad Files\Github\Amar_Project"

REM Activate the virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Run the Python application
echo Starting Flask server...
echo You can close this window or press CTRL+C to stop the server.
echo.
python app.py

echo.
echo Server has been stopped.
pause
