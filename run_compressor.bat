@echo off
title Image Compressor
cd /d "%~dp0"
echo Running Image Compressor...
py compress_images.py %*
pause
