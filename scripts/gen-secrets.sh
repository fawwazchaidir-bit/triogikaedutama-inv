#!/usr/bin/env bash
# Mencetak nilai acak kuat untuk .env (TIDAK menulis file apa pun — Anda yang menyalinnya).
#   bash scripts/gen-secrets.sh
# Simpan hasilnya di pengelola rahasia (mis. 1Password/Bitwarden) SEBELUM dipakai: DATA_ENCRYPTION_KEY yang hilang = rahasia 2FA tak terbaca.
set -euo pipefail
command -v openssl >/dev/null || { echo "openssl diperlukan" >&2; exit 1; }
pw() { openssl rand -base64 48 | tr -d '/+=\n' | head -c "$1"; }
cat <<OUT
# ── dibuat $(date -u +%Y-%m-%dT%H:%M:%SZ) — salin ke .env ──
POSTGRES_PASSWORD=$(pw 32)
DATA_ENCRYPTION_KEY=$(openssl rand -hex 32)
ADMIN_PASSWORD=$(pw 20)
# Hanya saat tahap integrasi dimulai:
# INTEGRATION_MASTER_KEY=$(openssl rand -hex 32)
OUT
echo "# ↑ simpan di pengelola rahasia; jangan kirim lewat chat/email." >&2
