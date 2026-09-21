@echo off
REM Memeriksa koneksi ke Neo Feeder dan melaporkan penyebab bila gagal.

setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo [GAGAL] Jalankan setup.bat lebih dulu.
    pause
    exit /b 1
)

".venv\Scripts\python.exe" scripts\cek_koneksi.py %*
echo.
pause
