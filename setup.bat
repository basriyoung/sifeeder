@echo off
REM Penyiapan SiFeeder untuk Windows.
REM Klik dua kali berkas ini, atau jalankan dari PowerShell: .\setup.bat

setlocal
cd /d "%~dp0"

echo ================================================================
echo   Penyiapan SiFeeder
echo ================================================================
echo.

where py >nul 2>nul
if errorlevel 1 (
    where python >nul 2>nul
    if errorlevel 1 (
        echo [GAGAL] Python tidak ditemukan.
        echo Pasang Python 3.10 atau lebih baru dari https://www.python.org/downloads/
        echo Saat memasang, centang "Add Python to PATH".
        pause
        exit /b 1
    )
    set "PYCMD=python"
) else (
    set "PYCMD=py"
)

if not exist ".venv\Scripts\python.exe" (
    echo [1/3] Membuat lingkungan virtual .venv ...
    %PYCMD% -m venv .venv
    if errorlevel 1 (
        echo [GAGAL] Tidak dapat membuat .venv
        pause
        exit /b 1
    )
) else (
    echo [1/3] Lingkungan virtual .venv sudah ada, dilewati.
)

echo [2/3] Memasang dependensi ...
".venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
".venv\Scripts\python.exe" -m pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [GAGAL] Pemasangan dependensi tidak berhasil.
    pause
    exit /b 1
)

echo [3/3] Mengisi konfigurasi ...
echo.
".venv\Scripts\python.exe" scripts\setup.py
if errorlevel 1 (
    pause
    exit /b 1
)

echo.
echo Penyiapan selesai. Jalankan aplikasi dengan: jalankan.bat
echo.
pause
