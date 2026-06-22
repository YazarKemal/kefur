"""Obsidian Sync — pulls daily AI trading report from Render backend
and writes it into the local Obsidian vault brain directory.

Runs continuously — refreshes every 10 minutes.
"""

import os
import sys
import time
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


def run_once():
    """Fetch and save a single report. Returns True on success."""
    md = fetch_report()
    if md is None:
        return False
    save_report(md)
    return True


def run_forever():
    """Continuous loop: fetch report every 10 minutes, overwrite same file."""
    ensure_requests()
    print("[obsidian_sync] Surekli mod baslatildi — her 10 dakikada bir tazeleme yapilacak.")
    while True:
        ok = run_once()
        if ok:
            print("[obsidian_sync] Baglanti tazelendi, yeni veriler kilitlendi.")
        else:
            print("[obsidian_sync] Rapor cekilemedi — 10 dakika sonra tekrar denenecek.")
        time.sleep(600)


if __name__ == "__main__":
    run_forever()
