@echo off
REM Menjalankan SiFeeder.

setlocal
cd /d "%~dp0"

if not exist ".env" (
    echo [GAGAL] Berkas .env belum ada.
    echo Jalankan setup.bat lebih dulu.
    pause
    exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    echo [GAGAL] Lingkungan virtual .venv belum ada.
    echo Jalankan setup.bat lebih dulu.
    pause
    exit /b 1
)

echo Menjalankan SiFeeder. Tekan Ctrl+C untuk berhenti.
echo.
".venv\Scripts\python.exe" run.py
pause
