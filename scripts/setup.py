#!/usr/bin/env python3
"""Penyiap awal: membuat berkas .env secara lengkap.

Jalankan sekali saja:

    python scripts/setup.py          (Linux / macOS)
    py scripts\\setup.py             (Windows)

Skrip ini menanyakan alamat Feeder dan kredensial, membuat hash kata sandi
aplikasi serta kunci sesi, lalu menulis .env yang siap pakai. Tidak perlu
menyalin .env.example atau menempel hash secara manual.

Kata sandi diminta tanpa ditampilkan di layar dan tidak pernah dicetak ulang.
"""

from __future__ import annotations

import getpass
import os
import secrets
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.feeder.diagnostics import find_endpoint, normalize_url  # noqa: E402
from app.security import hash_password  # noqa: E402

ENV_PATH = ROOT / ".env"
IS_WINDOWS = os.name == "nt"

LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}


def ask(prompt: str, default: str = "", *, required: bool = True) -> str:
    """Tanya satu nilai. Enter berarti memakai nilai bawaan."""
    suffix = f" [{default}]" if default else ""
    while True:
        value = input(f"{prompt}{suffix}: ").strip()
        if not value:
            value = default
        if value or not required:
            return value
        print("   Nilai ini wajib diisi.")


def ask_secret(prompt: str, *, min_length: int = 1, confirm: bool = False) -> str:
    while True:
        value = getpass.getpass(f"{prompt}: ")
        if len(value) < min_length:
            print(f"   Minimal {min_length} karakter.")
            continue
        if confirm:
            again = getpass.getpass("   Ulangi untuk memastikan: ")
            if value != again:
                print("   Tidak sama, coba lagi.")
                continue
        return value


def ask_yes_no(prompt: str, default: bool = False) -> bool:
    suffix = " [Y/t]" if default else " [y/T]"
    answer = input(f"{prompt}{suffix}: ").strip().lower()
    if not answer:
        return default
    return answer in {"y", "ya", "yes"}


def protect_file(path: Path) -> str:
    """Batasi akses berkas ke pemiliknya saja, sesuai sistem operasi."""
    if IS_WINDOWS:
        user = os.environ.get("USERNAME", "")
        if not user:
            return "lewati (nama pengguna tidak terbaca)"
        try:
            subprocess.run(
                ["icacls", str(path), "/inheritance:r", "/grant:r", f"{user}:F"],
                check=True,
                capture_output=True,
                timeout=30,
            )
            return f"dibatasi untuk pengguna {user} (icacls)"
        except (subprocess.SubprocessError, FileNotFoundError, OSError) as exc:
            return f"gagal dibatasi otomatis ({exc.__class__.__name__}); atur manual lewat Properties > Security"
    try:
        path.chmod(0o600)
        return "chmod 600"
    except OSError as exc:  # pragma: no cover
        return f"gagal chmod ({exc})"


def build_env(values: dict[str, str]) -> str:
    return f"""# Dibuat oleh scripts/setup.py. Jangan commit berkas ini ke git.

# ---------------------------------------------------------------------
# Web service Neo Feeder
# ---------------------------------------------------------------------
FEEDER_URL={values['FEEDER_URL']}
FEEDER_USERNAME={values['FEEDER_USERNAME']}
FEEDER_PASSWORD={values['FEEDER_PASSWORD']}

FEEDER_TIMEOUT=60
FEEDER_TIMEOUT_WRITE=120
FEEDER_MAX_RETRIES=3
FEEDER_RETRY_BASE_DELAY=1.0
FEEDER_THROTTLE_SECONDS=0.05
FEEDER_TOKEN_TTL_SECONDS=3000
FEEDER_VERIFY_TLS=true
FEEDER_ALLOW_INSECURE_HTTP={values['FEEDER_ALLOW_INSECURE_HTTP']}

# ---------------------------------------------------------------------
# Login aplikasi (bukan login Neo Feeder)
# ---------------------------------------------------------------------
APP_USERNAME={values['APP_USERNAME']}
APP_PASSWORD_HASH={values['APP_PASSWORD_HASH']}
SESSION_SECRET={values['SESSION_SECRET']}

SESSION_MAX_AGE_SECONDS=28800
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_SECONDS=300
COOKIE_SECURE=false

# ---------------------------------------------------------------------
# Sinkronisasi dan penyimpanan
# ---------------------------------------------------------------------
SYNC_BATCH_SIZE=100
DATA_DIR=./data
DB_PATH=./data/sync.db
LOG_PATH=./data/logs/sync.log
MASK_PERSONAL_DATA=true

# ---------------------------------------------------------------------
# Server web
# ---------------------------------------------------------------------
HOST=127.0.0.1
PORT={values['PORT']}
"""


def main() -> int:
    print()
    print("=" * 64)
    print("  Penyiapan SiFeeder")
    print("=" * 64)
    print()

    if ENV_PATH.exists():
        print(f"Berkas .env sudah ada di {ENV_PATH}")
        if not ask_yes_no("Timpa dengan konfigurasi baru?", default=False):
            print("Dibatalkan. Berkas .env yang lama tidak diubah.")
            return 0
        print()

    mode_test = "--test" in sys.argv
    if not mode_test:
        print("Mode penyiapan:")
        print("  1. Feeder sungguhan (produksi atau salinan uji)")
        print("  2. Server Feeder tiruan yang ikut dalam paket ini (untuk mencoba dulu)")
        mode_test = ask("Pilih 1 atau 2", "1") == "2"
        print()

    values: dict[str, str] = {"PORT": "8700", "FEEDER_ALLOW_INSECURE_HTTP": "false"}

    if mode_test:
        print("Mode uji coba dipilih. Kredensial diisi otomatis untuk server tiruan.")
        print("Jalankan server tiruan di jendela terminal terpisah:")
        print("    python tests/mock_feeder.py")
        print()
        values["FEEDER_URL"] = "http://127.0.0.1:3999/ws/live2.php"
        values["FEEDER_USERNAME"] = "kode_pt_test"
        values["FEEDER_PASSWORD"] = "rahasia-uji-2026"
    else:
        print("--- Alamat web service Neo Feeder ---")
        print("Yang dibutuhkan adalah endpoint ws/live2.php, BUKAN alamat halaman")
        print("aplikasi Neo Feeder. Contoh yang benar:")
        print("    http://127.0.0.1:3003/ws/live2.php")
        print("    https://neo.kampus.ac.id/ws/live2.php")
        print("Kalau Anda hanya tahu alamat halaman aplikasinya, tempel saja apa adanya.")
        print("Skrip ini akan membereskan dan mengujinya.")
        print()

        while True:
            raw_url = ask("Alamat Neo Feeder", "http://127.0.0.1:3003/ws/live2.php")
            url, notes = normalize_url(raw_url)
            parsed = urlparse(url)
            if parsed.scheme not in {"http", "https"} or not parsed.hostname:
                print("   Alamat tidak valid. Harus diawali http:// atau https://")
                continue
            for note in notes:
                print(f"   Catatan: {note}")
            if url != raw_url.strip():
                print(f"   Alamat yang dipakai: {url}")

            insecure = parsed.scheme == "http" and parsed.hostname.lower() not in LOCAL_HOSTS
            if insecure:
                print()
                print("   PERINGATAN: HTTP polos ke server lain berarti username, kata sandi,")
                print("   dan token terkirim tanpa enkripsi dan bisa disadap di jaringan.")
                if not ask_yes_no("   Tetap lanjutkan tanpa HTTPS?", default=False):
                    continue

            print()
            print("--- Kredensial Neo Feeder ---")
            print("Username biasanya kode perguruan tinggi, bukan email.")
            username = ask("Username Feeder")
            password = ask_secret("Kata sandi Feeder (tidak tampil saat diketik)")

            print()
            print("Menguji koneksi ke Neo Feeder ...")
            report = find_endpoint(url, username, password)

            if report.ok:
                print(f"   BERHASIL. {report.detail}")
                values["FEEDER_URL"] = report.url
                values["FEEDER_USERNAME"] = username
                values["FEEDER_PASSWORD"] = password
                values["FEEDER_ALLOW_INSECURE_HTTP"] = "true" if insecure else "false"
                break

            print(f"   GAGAL. {report.detail}")
            for hint in report.hints:
                print(f"   - {hint}")

            if report.suggested_url:
                print()
                if ask_yes_no(f"   Pakai alamat {report.suggested_url} sebagai gantinya?", default=True):
                    retry = find_endpoint(
                        report.suggested_url, username, password, try_other_ports=False
                    )
                    if retry.ok:
                        print(f"   BERHASIL. {retry.detail}")
                        suggested = urlparse(retry.url)
                        values["FEEDER_URL"] = retry.url
                        values["FEEDER_USERNAME"] = username
                        values["FEEDER_PASSWORD"] = password
                        values["FEEDER_ALLOW_INSECURE_HTTP"] = (
                            "true"
                            if suggested.scheme == "http"
                            and (suggested.hostname or "").lower() not in LOCAL_HOSTS
                            else "false"
                        )
                        break
                    print(f"   Masih gagal. {retry.detail}")

            print()
            print("   Pilihan:")
            print("     1. Ulangi pengisian alamat dan kredensial")
            print("     2. Simpan saja apa adanya, perbaiki nanti lewat .env")
            if ask("   Pilih 1 atau 2", "1") == "2":
                values["FEEDER_URL"] = url
                values["FEEDER_USERNAME"] = username
                values["FEEDER_PASSWORD"] = password
                values["FEEDER_ALLOW_INSECURE_HTTP"] = "true" if insecure else "false"
                print("   Disimpan tanpa pengujian berhasil.")
                break
            print()

    print()
    print("--- Login aplikasi ini ---")
    print("Ini akun terpisah untuk masuk ke dashboard, bukan akun Feeder.")
    values["APP_USERNAME"] = ask("Nama pengguna aplikasi", "admin")
    app_password = ask_secret(
        "Kata sandi aplikasi (minimal 12 karakter)", min_length=12, confirm=True
    )
    values["APP_PASSWORD_HASH"] = hash_password(app_password)
    values["SESSION_SECRET"] = secrets.token_urlsafe(48)

    print()
    port = ask("Port untuk dashboard", "8700")
    values["PORT"] = port if port.isdigit() else "8700"

    ENV_PATH.write_text(build_env(values), encoding="utf-8")
    permission_note = protect_file(ENV_PATH)

    print()
    print("=" * 64)
    print("  Selesai")
    print("=" * 64)
    print(f"Berkas .env dibuat di : {ENV_PATH}")
    print(f"Izin akses            : {permission_note}")
    print()
    print("Langkah berikutnya:")
    if mode_test:
        print("  1. Jendela terminal pertama : python tests/mock_feeder.py")
        print("  2. Jendela terminal kedua   : python run.py")
    else:
        print("  python run.py")
    print(f"  Lalu buka http://127.0.0.1:{values['PORT']}")
    print(f"  Masuk dengan pengguna '{values['APP_USERNAME']}' dan kata sandi yang baru dibuat.")
    print()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nDibatalkan.")
        raise SystemExit(1)
