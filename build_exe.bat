@echo off
title Smart Image Compressor - Build Executable (.exe)
echo ================================================================
echo   Smart Image Compressor - Standalone Windows .exe Builder
echo ================================================================
echo.
echo Checking Python environment...
py --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python launcher 'py' not found!
    echo Please install Python 3.9+ and add it to your PATH.
    pause
    exit /b 1
)

echo.
echo Running build script...
py build_exe.py

echo.
pause
