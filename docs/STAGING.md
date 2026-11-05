# Runbook Staging → Produksi

Panduan langkah demi langkah menaikkan Financial Management System ke **staging** (server sungguhan, HTTPS, data uji/paralel), memverifikasinya,
menjalankan **uji paralel (UAT)**, lalu memutuskan **go-live**. Pelengkap [DEPLOYMENT.md](DEPLOYMENT.md) (referensi teknis) dan [UAT.md](UAT.md) (skenario uji).

> **Kejujuran status:** build produksi, mode *standalone* (isi image Docker), PDF/Excel pada build itu, skrip backup/restore/rekonsiliasi, dan `scripts/smoke.mjs`
> **telah dijalankan** di lingkungan pengembangan. **`docker build` / `docker compose up` belum pernah dijalankan** (tidak ada daemon Docker di sana) dan CI GitHub
> belum terlihat berjalan. Langkah 4 di bawah (build pertama di server) adalah pembuktian pertamanya — jalankan di staging, jangan langsung di produksi.

## 0. Keputusan sebelum mulai

| Keputusan | Rekomendasi |
|---|---|
| Server | 1 VPS Ubuntu 22.04/24.04, ≥ 2 vCPU, 4 GB RAM, 40 GB SSD (PDF memakai memori saat dibuat). Lokasi Indonesia/Singapura. |
| Domain | Subdomain khusus, mis. `fms-staging.trilogikaedutama.id` (staging) dan kelak `fms.trilogikaedutama.id` (produksi). |
| Status data staging | **Anggap data staging dapat dibuang.** Saat go-live, buat database produksi **baru** dan input saldo awal pada tanggal cut-over (lihat §8). |
| Akses | Batasi ke IP kantor/VPN selama staging (contoh di `deploy/Caddyfile` / `deploy/nginx.conf`). Staging berisi data keuangan nyata bila UAT memakai transaksi sungguhan. |
| Pelaku | **Pemilik** (Anda, Administrator #1), **Administrator #2** (cadangan — wajib), **Finance Manager**, **Staf Administrasi Keuangan**, dan satu **penguji dari luar tim keuangan** (mencoba memecahkan). |

## 1. Persiapan server (sekali)

```bash
# Docker Engine + plugin compose (ikuti https://docs.docker.com/engine/install/ubuntu/), lalu:
sudo usermod -aG docker $USER && newgrp docker
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable     # port 3000 & 5432 TIDAK dibuka
timedatectl set-ntp true                                                    # jam akurat: TOTP & tanda tangan API bergantung padanya
sudo apt install -y caddy                                                   # atau nginx + certbot (deploy/nginx.conf)
```

DNS: arahkan A/AAAA domain ke IP server **sebelum** menyalakan proxy (sertifikat Let's Encrypt perlu itu).

## 2. Ambil kode

```bash
git clone <URL-repo> /opt/fms && cd /opt/fms
git checkout <tag-rilis>        # mis. v1.0.0-rc1; jangan men-deploy cabang kerja yang bergerak
```

## 3. Konfigurasi rahasia

```bash
cp .env.staging.example .env && chmod 600 .env
bash scripts/gen-secrets.sh      # cetak nilai acak → tempel ke .env; SIMPAN juga di pengelola rahasia (1Password/Bitwarden)
nano .env                        # isi APP_URL (https://…), ADMIN_EMAIL, MFA_REQUIRED_ROLES=ADMIN,FINANCE
```

Aturan emas: **`DATA_ENCRYPTION_KEY` yang hilang = seluruh rahasia 2FA tak terbaca.** Simpan salinannya **terpisah** dari backup database.
`INTEGRATION_MASTER_KEY` biarkan **kosong** (integrasi website/Portal belum dimulai).

## 4. Build & jalankan

```bash
docker compose up -d --build      # db → migrate+seed (sekali) → app → backup harian
docker compose ps                 # migrate = Exited (0); db, app, backup = Up (healthy)
docker compose logs migrate | tail   # "Administrator dibuat: …" pada run pertama
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile && sudo nano /etc/caddy/Caddyfile   # ganti domain
sudo systemctl reload caddy
```

Bila `migrate` gagal: baca lognya (biasanya `ADMIN_PASSWORD` lemah/kosong pada run pertama, atau `POSTGRES_PASSWORD` berubah setelah volume dibuat — hapus volume **hanya** di staging: `docker compose down -v`).

## 5. Verifikasi otomatis (smoke test)

```bash
SMOKE_URL=https://fms-staging.trilogikaedutama.id node scripts/smoke.mjs
# lebih lengkap (menguji login, cookie Secure/HttpOnly/__Host-, logout) memakai akun uji:
SMOKE_URL=https://… SMOKE_EMAIL=admin@… SMOKE_PASSWORD='…' [SMOKE_TOTP_SECRET=…] node scripts/smoke.mjs
```

Harus berakhir **SMOKE TEST LULUS**. Yang diperiksa: kesehatan aplikasi+database, HTTPS & HSTS, header keamanan (CSP, nosniff, frame, referrer), halaman terlindungi
mengarahkan ke login, API menolak tanpa sesi (401), CSRF asal asing ditolak, login salah menjawab generik tanpa cookie, API integrasi tertutup, selisih jam server,
dan (bila akun diberikan) atribut cookie sesi + logout mencabut sesi. Peringatan `!` perlu dibaca; kegagalan `✘` = **hentikan**, perbaiki dulu.

## 6. Konfigurasi aplikasi (urutan penting)

1. Login Administrator → **ganti password sementara** (dipaksa) → peran wajib 2FA ⇒ diarahkan ke **Keamanan**: pindai QR, masukkan kode, **simpan 10 kode pemulihan di brankas** (bukan di komputer yang sama dengan ponsel).
2. Buat **Administrator #2** (Pengaturan → Pengguna) dan minta ia mengaktifkan 2FA; uji **Reset 2FA** satu kali (Admin #1 mereset Admin #2, lalu Admin #2 mengaktifkan lagi) agar prosedur pemulihan terbukti.
3. Buat **Finance Manager** dan **Staf Administrasi Keuangan**; Finance wajib 2FA. Ikuti [DEPLOYMENT.md §4](DEPLOYMENT.md) (identitas lembaga, penandatangan, cap, rekening, **penomoran** — periksa dulu bahwa 00434/00435 belum terpakai —, bagan akun, akun kas/bank + **saldo awal & tanggalnya**).
4. Pajak: lembaga **non-PKP → jangan menambahkan tarif PPN**. PPh dipotong pelanggan (mis. PPh 23) bila relevan — **tinjau dengan konsultan pajak**.
5. Jalankan `smoke.mjs` lagi dengan akun Finance (setelah 2FA aktif, sertakan `SMOKE_TOTP_SECRET`).

## 7. Backup & latihan pemulihan (WAJIB sebelum UAT dimulai)

Backup harian otomatis berjalan di kontainer `backup` → `./backups` (retensi 30 hari). **Salin ke luar server** (mis. `rclone`/`rsync` ke object storage atau komputer kantor terenkripsi) — jadwalkan di cron host:

```bash
30 3 * * *  rsync -a --delete-after /opt/fms/backups/ backup-user@host-lain:/backups/fms/ >> /var/log/fms-offsite.log 2>&1
```

Latihan pemulihan (ke database baru; **tidak menyentuh data berjalan**):

```bash
cd /opt/fms && set -a && . ./.env && set +a
docker compose exec db createdb -U trilogika trilogika_restore_check
LATEST=$(ls -t backups/trilogika_*.dump | head -1)
docker compose run --rm -v "$PWD/backups:/backups" \
  -e TARGET_URL="postgresql://trilogika:${POSTGRES_PASSWORD}@db:5432/trilogika_restore_check" \
  migrate npm run db:restore -- "/backups/$(basename $LATEST)"
docker compose run --rm -e DATABASE_URL="postgresql://trilogika:${POSTGRES_PASSWORD}@db:5432/trilogika_restore_check?schema=public" migrate npm run db:reconcile
docker compose exec db dropdb -U trilogika trilogika_restore_check
```

Lulus bila `db:reconcile` bersih. Catat tanggal & hasilnya di [UAT.md](UAT.md). Rekonsiliasi harian: `docker compose run --rm migrate npm run db:reconcile` (jadwalkan di cron host; alarm bila ≠ 0).

## 8. Uji paralel (UAT) — 2 sampai 4 minggu

Jalankan sistem baru **berdampingan** dengan proses lama (Word/Excel). Prinsip: **proses lama tetap dokumen resmi**, sistem baru dibuktikan angkanya sama.
Skenario uji, kriteria lulus, dan lembar rekonsiliasi mingguan ada di **[UAT.md](UAT.md)**. Ringkasnya:

| Minggu | Fokus |
|---|---|
| 0 | Smoke test, 2FA seluruh pengguna, latihan pemulihan, skenario P0 (UAT.md §A–§C) |
| 1 | Input transaksi nyata paralel; bandingkan PDF dengan Word; rekonsiliasi mingguan #1 |
| 2 | Pengeluaran, pembayaran sebagian/DP, rekonsiliasi bank, laporan; rekonsiliasi mingguan #2 |
| 3 | Tutup buku bulan uji, pajak, pembalikan/koreksi, serangan sederhana oleh penguji luar |
| 4 | Latihan insiden (ponsel hilang, restore), keputusan go/no-go |

## 9. Kriteria go-live (semua harus terpenuhi)

- [ ] Seluruh skenario **P0** di UAT.md lulus; temuan **P1** terselesaikan atau diterima tertulis oleh pemilik.
- [ ] **Dua minggu berturut-turut** rekonsiliasi mingguan tanpa selisih yang tak terjelaskan (invoice, pembayaran, saldo kas/bank, piutang).
- [ ] `db:reconcile` bersih setiap hari selama UAT; backup harian ada & **sudah tersalin keluar server**; **latihan restore berhasil** (§7).
- [ ] Semua Administrator & Finance Manager: **2FA aktif + kode pemulihan tersimpan**; ada ≥ 2 Administrator; prosedur Reset 2FA pernah dicoba.
- [ ] PDF invoice/kwitansi dicetak dan **disetujui pemilik** terhadap dokumen referensi; nomor invoice berikutnya dikonfirmasi.
- [ ] **Konsultan pajak** meninjau konfigurasi pajak & laporan pajak (aplikasi bukan SPT).
- [ ] `smoke.mjs` LULUS pada URL produksi; HTTPS+HSTS; port 3000/5432 tidak terbuka dari luar (`nmap` dari komputer lain).
- [ ] Rencana **cut-over** tertulis: tanggal, siapa input saldo awal, kapan proses lama dihentikan, siapa dihubungi saat masalah.

## 10. Cut-over ke produksi

1. Server/domain produksi disiapkan dengan langkah §1–§7 (rahasia **baru**, bukan salinan staging).
2. Database **baru**; seed Administrator; input **saldo awal akun kas/bank** (pada tanggal cut-over), saldo piutang berjalan sebagai invoice awal bila perlu, dan nomor invoice berikutnya.
3. Smoke test, 2FA seluruh pengguna, latihan restore singkat.
4. Hentikan proses lama pada tanggal yang disepakati; arsipkan berkasnya (read-only).
5. Dua minggu pertama: `db:reconcile` & pemeriksaan saldo bank tiap hari; pemilik meninjau Audit Log mingguan.

## 11. Operasional rutin & rollback

| Tindakan | Perintah |
|---|---|
| Lihat log | `docker compose logs -f app` (log berputar 10 MB × 5) |
| Upgrade | backup → `git fetch && git checkout <tag-baru>` → `docker compose up -d --build` (migrasi otomatis) → `smoke.mjs` → `db:reconcile` |
| **Rollback** | Migrasi bersifat maju: `docker compose down` → pulihkan backup sebelum upgrade (`CONFIRM_RESTORE=yes … db:restore`) → `git checkout <tag-lama>` → `docker compose up -d --build` |
| Pengguna terkunci 2FA | Administrator lain: Pengaturan → Pengguna → **Reset 2FA** |
| **Satu-satunya** Administrator terkunci | Darurat lewat server: `docker compose exec db psql -U trilogika trilogika_invoice -c "UPDATE users SET \"twoFactorEnabled\"=false, \"twoFactorSecretEnc\"=NULL, \"twoFactorEnabledAt\"=NULL, \"twoFactorLastStep\"=NULL WHERE email='…'; DELETE FROM two_factor_recovery_codes WHERE \"userId\"=(SELECT id FROM users WHERE email='…');"` — catat di buku insiden. Hindari dengan memiliki Admin #2. |
| Dugaan kebocoran | Cabut sesi (nonaktifkan lalu aktifkan pengguna), ganti password, Reset 2FA, periksa Audit Log; bila rahasia server bocor: ganti `POSTGRES_PASSWORD` (dan ubah di database), jangan ganti `DATA_ENCRYPTION_KEY` tanpa mereset 2FA seluruh pengguna |

## 12. Yang BELUM terbukti (jujur)

- `docker compose up -d --build` pertama di server (lihat catatan di atas) — kemungkinan masalah: izin folder `./backups`, nama proyek/volume, versi plugin compose.
- Perilaku di balik proxy sungguhan (IP asli, HSTS, redirect) — diverifikasi oleh `smoke.mjs` dan §9, bukan oleh tes otomatis.
- Beban nyata: dirancang untuk puluhan pengguna; belum diuji beban.
- Kecocokan tata letak PDF di mesin cetak/PDF-viewer Anda — nilai oleh pemilik.
