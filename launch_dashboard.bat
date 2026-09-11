@echo off
title Image Compressor Dashboard
cd /d "%~dp0"
echo ===================================================
echo   Launching Image Compressor Visual Dashboard...
echo ===================================================
echo Opening in your default web browser...
py server.py
pause
