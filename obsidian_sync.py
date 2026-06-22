"""Obsidian Sync — pulls daily AI trading report from Render backend
and writes it into the local Obsidian vault brain directory."""

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

REPORT_URL = "https://kefur-backend.onrender.com/api/admin/obsidian-report"
OBSIDIAN_VAULT_DIR = Path(r"C:\Users\reali\Downloads\kefurAnroid\brain\03-Gunluk-Loglar")


def ensure_requests():
    """Install requests if not already available."""
    try:
        import requests  # noqa: F401
    except ImportError:
        print("[obsidian_sync] 'requests' paketi eksik — kuruluyor...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
        print("[obsidian_sync] 'requests' kurulumu tamamlandi.")


def fetch_report() -> str | None:
    import requests
    print(f"[obsidian_sync] Render sunucusundan rapor cekiliyor: {REPORT_URL}")
    try:
        resp = requests.get(REPORT_URL, timeout=30)
        resp.raise_for_status()
        print(f"[obsidian_sync] Rapor alindi ({len(resp.text)} karakter).")
        return resp.text
    except requests.RequestException as exc:
        print(f"[obsidian_sync] HATA — rapor cekilemedi: {exc}")
        return None


def save_report(markdown: str) -> Path | None:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    filename = f"{today}-ajan-hafiza.md"
    OBSIDIAN_VAULT_DIR.mkdir(parents=True, exist_ok=True)
    filepath = OBSIDIAN_VAULT_DIR / filename
    filepath.write_text(markdown, encoding="utf-8")
    print(f"[obsidian_sync] Rapor kaydedildi: {filepath}")
    return filepath


def main():
    ensure_requests()
    md = fetch_report()
    if md is None:
        print("[obsidian_sync] Rapor alinamadi — islem iptal.")
        sys.exit(1)
    save_report(md)
    print("[obsidian_sync] Tamamlandi.")


if __name__ == "__main__":
    main()
