#!/usr/bin/env python3
"""Periksa koneksi ke Neo Feeder dan laporkan penyebabnya bila gagal.

    python scripts/cek_koneksi.py                 pakai nilai dari .env
    python scripts/cek_koneksi.py <url> <user>    uji alamat lain

Skrip ini juga mendaftar act yang benar-benar dilayani server Anda dan
membandingkannya dengan entitas yang dikenali aplikasi, sehingga terlihat
mana yang bisa dipakai tanpa harus menebak.
"""

from __future__ import annotations

import getpass
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.config import load_dotenv  # noqa: E402
from app.feeder.diagnostics import find_endpoint, normalize_url, probe  # noqa: E402
from app.feeder.registry import list_entities  # noqa: E402

import requests  # noqa: E402


def check_acts(url: str, username: str, password: str) -> None:
    """Coba setiap act baca dan laporkan mana yang dilayani server."""
    try:
        token_response = requests.post(
            url,
            json={"act": "GetToken", "username": username, "password": password},
            timeout=15,
        ).json()
        token = (token_response.get("data") or {}).get("token")
    except (requests.RequestException, ValueError, AttributeError):
        print("  Tidak dapat mengambil token untuk memeriksa daftar act.")
        return
    if not token:
        return

    print()
    print("Entitas yang dikenali aplikasi dan hasil ujinya di server Anda:")
    print()
    print(f"  {'ENTITAS':<32} {'ACT':<36} HASIL")
    print(f"  {'-' * 32} {'-' * 36} {'-' * 28}")

    for entity in list_entities():
        try:
            body = requests.post(
                url,
                json={
                    "act": entity.get_act,
                    "token": token,
                    "filter": "",
                    "order": "",
                    "limit": 1,
                    "offset": 0,
                },
                timeout=20,
            ).json()
        except (requests.RequestException, ValueError):
            status = "gagal dihubungi"
        else:
            code = int(body.get("error_code") or 0)
            if code == 0:
                data = body.get("data")
                count = len(data) if isinstance(data, list) else (1 if data else 0)
                status = f"OK ({count} baris contoh)"
            else:
                status = f"ditolak: {(body.get('error_desc') or code)}"[:28]
        print(f"  {entity.label:<32} {entity.get_act:<36} {status}")

    print()
    print("Entitas berstatus 'ditolak' berarti act itu tidak ada di versi Feeder Anda.")
    print("Sunting app/feeder/registry.py untuk menyesuaikan nama act-nya.")


def main() -> int:
    load_dotenv(ROOT / ".env")

    if len(sys.argv) >= 3:
        raw_url, username = sys.argv[1], sys.argv[2]
        password = getpass.getpass("Kata sandi Feeder: ")
    else:
        raw_url = os.environ.get("FEEDER_URL", "")
        username = os.environ.get("FEEDER_USERNAME", "")
        password = os.environ.get("FEEDER_PASSWORD", "")
        if not raw_url or not username:
            print("Berkas .env belum lengkap. Jalankan setup.bat atau scripts/setup.py lebih dulu,")
            print("atau panggil skrip ini dengan alamat dan username:")
            print("    python scripts/cek_koneksi.py http://127.0.0.1:3003/ws/live2.php KODE_PT")
            return 2

    url, notes = normalize_url(raw_url)
    print()
    print("=" * 70)
    print("  Pemeriksaan koneksi Neo Feeder")
    print("=" * 70)
    print(f"  Alamat di .env : {raw_url}")
    if url != raw_url.strip():
        print(f"  Alamat dipakai : {url}")
    for note in notes:
        print(f"  Catatan        : {note}")
    print(f"  Username       : {username}")
    print()

    verify_tls = os.environ.get("FEEDER_VERIFY_TLS", "true").lower() not in {"0", "false", "no"}
    report = find_endpoint(url, username, password, verify_tls=verify_tls)

    if report.ok:
        print(f"  HASIL: BERHASIL. {report.detail}")
        if report.profile:
            for key in ("kode_perguruan_tinggi", "nama_perguruan_tinggi"):
                if report.profile.get(key):
                    print(f"    {key}: {report.profile[key]}")
        check_acts(report.url, username, password)
        print()
        if report.url != (raw_url or "").strip():
            print(f"  Perbarui FEEDER_URL di .env menjadi: {report.url}")
        return 0

    print(f"  HASIL: GAGAL. {report.detail}")
    print()
    for hint in report.hints:
        print(f"    - {hint}")
    if report.suggested_url:
        print()
        print(f"  Coba ganti FEEDER_URL di .env menjadi: {report.suggested_url}")
        trial = probe(report.suggested_url, username, password, verify_tls=verify_tls)
        print(f"  Hasil uji alamat itu: {trial.detail}")
    print()
    return 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nDibatalkan.")
        raise SystemExit(1)
