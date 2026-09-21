#!/usr/bin/env python3
"""Titik masuk aplikasi.

Jalankan:

    python run.py

Secara bawaan server hanya mendengarkan di 127.0.0.1 sehingga tidak terbuka
ke jaringan. Ubah lewat HOST/PORT bila memang perlu, dan pasang HTTPS
(misalnya lewat Nginx) sebelum membukanya ke luar.
"""

from __future__ import annotations

import os
import sys

import uvicorn

from app import __app_name__, __version__
from app.config import ConfigError, load_settings
from app.main import create_app


def main() -> int:
    try:
        settings = load_settings()
    except ConfigError as exc:
        print(f"[KONFIGURASI] {exc}", file=sys.stderr)
        return 2

    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8700"))

    if host not in {"127.0.0.1", "localhost"} and not settings.cookie_secure:
        print(
            "[PERINGATAN] Server dibuka di luar localhost tanpa COOKIE_SECURE. "
            "Pasang HTTPS lalu set COOKIE_SECURE=true.",
            file=sys.stderr,
        )

    app = create_app(settings)
    print(f"{__app_name__} v{__version__} berjalan di http://{host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info", access_log=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
