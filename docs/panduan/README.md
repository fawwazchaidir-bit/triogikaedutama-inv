# Panduan Pengguna FMS

Panduan bergambar untuk **Pelaksana (Staf Administrasi Keuangan)** dan **Finance Manager**: 131 tangkapan layar bernomor, 16 bab + 5 lampiran.

- `dist/Panduan-Pengguna-FMS.pdf` — versi cetak/bagikan
- `dist/Panduan-Pengguna-FMS-mandiri.html` — satu berkas HTML (gambar tertanam)
- `bab/*.md` — teks (sumber); `figures.json` + `img/` — gambar & legenda hasil otomatisasi

## Membangun ulang (setelah UI berubah)

```bash
# 1. Postgres hidup + server produksi uji di port 3100 (build produksi dengan TEST_DATABASE_URL)
bash scripts/docs/run-all.sh          # reset data demo + ambil ulang SEMUA gambar (±5 menit)
node scripts/docs/build-guide.mjs     # HTML + PDF (gagal bila ada gambar tak terpakai / id tak dikenal)
node scripts/docs/build-guide.mjs --embed --no-pdf
```

Skenario tiap bab: `scripts/docs/ch/*.mjs` (legenda ditulis di samping elemen yang ditandai, sehingga tidak bisa tidak sinkron). Bab yang diubah saja: `node scripts/docs/shots.mjs --only ch05` (data demo harus dalam keadaan yang sesuai; bila ragu, jalankan `run-all.sh`).
