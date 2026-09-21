@echo off
REM Menjalankan server Neo Feeder tiruan untuk uji coba.
REM Biarkan jendela ini terbuka, lalu jalankan jalankan.bat di jendela lain.

setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo [GAGAL] Jalankan setup.bat lebih dulu.
    pause
    exit /b 1
)

echo Server Neo Feeder tiruan berjalan di http://127.0.0.1:3999/ws/live2.php
echo Tekan Ctrl+C untuk berhenti.
echo.
".venv\Scripts\python.exe" tests\mock_feeder.py
pause
