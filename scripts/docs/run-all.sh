#!/usr/bin/env bash
# Reset data demo → jalankan semua bab tangkapan layar. Prasyarat: server aplikasi berjalan di GUIDE_URL (bawaan http://127.0.0.1:3100)
# memakai database yang sama dengan TEST_DATABASE_URL (lihat docs/panduan/README.md).
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; . ./.env; set +a
npx tsx scripts/docs/reset-demo.mts
rm -f docs/panduan/figures.json
node scripts/docs/shots.mjs "$@"
