#!/usr/bin/env python3
"""Buat nilai APP_PASSWORD_HASH untuk berkas .env.

    python scripts/hash_password.py

Kata sandi diminta tanpa ditampilkan di layar dan tidak pernah ditulis ke
berkas mana pun oleh skrip ini. Salin hasilnya ke .env.
"""

from __future__ import annotations

import getpass
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.security import hash_password  # noqa: E402


def main() -> int:
    password = getpass.getpass("Kata sandi aplikasi (minimal 12 karakter): ")
    confirm = getpass.getpass("Ulangi kata sandi: ")
    if password != confirm:
        print("Kata sandi tidak sama.", file=sys.stderr)
        return 1
    try:
        encoded = hash_password(password)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print("\nSalin dua baris berikut ke berkas .env Anda:\n")
    print(f"APP_PASSWORD_HASH={encoded}")
    print(f"SESSION_SECRET={secrets.token_urlsafe(48)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
