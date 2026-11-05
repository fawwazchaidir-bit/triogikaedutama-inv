# Lembar UAT (uji penerimaan pengguna) — uji paralel

Dipakai bersama [STAGING.md](STAGING.md) §8–§9. **P0** = wajib lulus untuk go-live; **P1** = harus lulus atau diterima tertulis oleh pemilik. Isi kolom *Hasil*
(✔ lulus / ✘ gagal + nomor temuan) beserta tanggal dan penguji. Satu skenario = satu pelaku; catat **bukti** (tangkapan layar/nomor invoice) untuk yang gagal.

## A. Akses & keamanan — P0

| ID | Pelaku | Skenario | Hasil yang diharapkan | Hasil |
|---|---|---|---|---|
| A1 | Admin | Login pertama dengan password sementara | Dipaksa ganti password, lalu diarahkan ke **Keamanan** (wajib 2FA) | |
| A2 | Admin | Aktifkan 2FA (QR di aplikasi autentikator) → simpan kode pemulihan | Aktif; kode pemulihan tampil sekali; "Selesai" terkunci sampai dicentang | |
| A3 | Admin | Logout → login: password + kode | Tanpa kode tidak bisa masuk; kode salah ditolak; kode benar masuk | |
| A4 | Admin | Login memakai **kode pemulihan** | Berhasil sekali; dipakai lagi ditolak; sisa kode berkurang | |
| A5 | Admin #1 | Reset 2FA Admin #2 (Pengaturan → Pengguna) | Sesi Admin #2 berakhir; ia mengaktifkan 2FA lagi saat login | |
| A6 | Finance | Coba **mematikan** 2FA | Ditolak (peran wajib 2FA) | |
| A7 | Staf | Coba buka Pengaturan → Pengguna / Integrasi / Audit Log | 404/tidak terlihat; API menolak (403) | |
| A8 | Staf | Coba menyetujui/terbitkan invoice, membalikkan pembayaran, menutup buku | Tombol tidak ada; tindakan lewat URL/API ditolak | |
| A9 | Siapa saja | 5× password salah | Akun diblokir sementara (pesan menit tunggu), tercatat di Audit Log | |
| A10 | Siapa saja | Tinggalkan sesi idle > 8 jam / buka dari perangkat lain setelah ganti password | Sesi berakhir; sesi lama tidak berlaku setelah ganti password | |

## B. Invoice — P0

| ID | Pelaku | Skenario | Hasil yang diharapkan | Hasil |
|---|---|---|---|---|
| B1 | Staf | Buat draft invoice lengkap (pelanggan, produk, diskon, DP) lalu **Ajukan** | Status "Menunggu verifikasi"; terkunci; nomor **belum** ada | |
| B2 | Finance | Tinjau → **Kembalikan** dengan catatan | Kembali ke staf berstatus draft + alasan terlihat | |
| B3 | Finance | Setujui & terbitkan | Nomor berikutnya sesuai konfirmasi (mis. 00435), cap & tanda tangan muncul; tidak ada lompatan/duplikat nomor | |
| B4 | Finance | Unduh PDF dan **cetak**; bandingkan dengan dokumen Word referensi | Tata letak, terbilang, Remark/Description, rekening sesuai; **disetujui pemilik** | |
| B5 | Finance | Dua tab menerbitkan draft yang sama bersamaan | Hanya satu berhasil; satu nomor terpakai | |
| B6 | Finance | Batalkan invoice terbit (alasan wajib) | Nomor tetap tercatat; PDF berwatermark DIBATALKAN; tidak masuk nilai invoice dashboard | |
| B7 | Staf | Duplikasi invoice | Draft baru tanpa nomor/pembayaran | |
| B8 | Finance | Invoice lunas → unduh PDF | Berjudul **KWITANSI** + LUNAS + tanggal pelunasan | |

## C. Pembayaran & piutang — P0

| ID | Pelaku | Skenario | Hasil yang diharapkan | Hasil |
|---|---|---|---|---|
| C1 | Staf | Catat pembayaran sebagian (Transfer, akun bank dipilih) | Saldo invoice turun; status "Sebagian"; masuk buku kas akun itu | |
| C2 | Staf | Catat pelunasan | Status Lunas; saldo 0; dashboard "Penerimaan Kas" naik tepat sekali (DP tidak terhitung ganda) | |
| C3 | Staf | Bayar melebihi sisa tagihan | Ditolak dengan pesan jelas | |
| C4 | Finance | Balikkan pembayaran (alasan) | Entri pembalik tercatat; status invoice kembali; kas/bank terkoreksi | |
| C5 | Finance | Invoice lewat jatuh tempo | Muncul "Jatuh tempo" di dashboard, lonceng, dan daftar; angka sama di ketiganya | |
| C6 | Finance | Dashboard: jumlah baris "Ringkasan Status" = seluruh invoice periode | Total baris = jumlah invoice (tanpa hitung ganda) | |

## D. Pengeluaran & kas — P0/P1

| ID | Pelaku | Skenario | Hasil yang diharapkan | Prioritas | Hasil |
|---|---|---|---|---|---|
| D1 | Staf | Catat pengeluaran ≤ Rp1 juta tanpa bukti | Tersimpan **menunggu persetujuan**; belum masuk saldo | P0 | |
| D2 | Staf | Pengeluaran > Rp1 juta tanpa bukti | Ditolak (bukti wajib) | P0 | |
| D3 | Finance | Setujui / tolak (alasan) | Berlaku → saldo & laba rugi berubah; ditolak → tidak | P0 | |
| D4 | Staf | Transfer antar akun kas/bank | Saldo satu akun turun, lainnya naik, total tetap | P1 | |
| D5 | Finance | Penerimaan non-operasional; jurnal manual seimbang | Tercatat; jurnal tak seimbang ditolak | P1 | |
| D6 | Finance | Balikkan entri kas yang sudah berlaku | Entri pembalik; saldo kembali | P0 | |

## E. Rekonsiliasi bank — P1

| ID | Pelaku | Skenario | Hasil yang diharapkan | Hasil |
|---|---|---|---|---|
| E1 | Staf | Impor rekening koran CSV bank sungguhan | Kolom terpetakan; format angka/tanggal Indonesia dikenali | |
| E2 | Staf | Pencocokan otomatis + manual; catat biaya/bunga dari mutasi | Selisih menuju 0 | |
| E3 | Finance | Finalisasi dengan selisih 0 | Terkunci; staf tidak bisa membuka | |

## F. Laporan & pajak — P1

| ID | Pelaku | Skenario | Hasil yang diharapkan | Hasil |
|---|---|---|---|---|
| F1 | Finance | Laba rugi, neraca, arus kas bulan uji; ekspor CSV/Excel/PDF | Angka identik di layar & ketiga ekspor; neraca seimbang; kas arus kas = kas neraca | |
| F2 | Finance | Banding dengan periode sebelumnya | Kolom periode ini/pembanding/selisih benar | |
| F3 | Finance + konsultan pajak | Pembayaran dengan PPh dipotong pelanggan → register & laporan pajak | Sesuai perhitungan konsultan; **non-PKP: tidak ada PPN** | |

## G. Tutup buku — P1

| ID | Pelaku | Skenario | Hasil yang diharapkan | Hasil |
|---|---|---|---|---|
| G1 | Finance | Tutup bulan uji lewat daftar periksa | Hanya bila syarat wajib terpenuhi; foto + hash tercatat | |
| G2 | Staf | Input transaksi bertanggal bulan tertutup | Ditolak | |
| G3 | Finance | Buka kembali bulan (alasan) | Tercatat di audit; setelah itu transaksi dapat diinput | |

## H. Penguji luar — mencoba memecahkan (P0)

| ID | Skenario | Hasil yang diharapkan | Hasil |
|---|---|---|---|
| H1 | Ubah ID di URL (`/invoices/<id lain>`, `/api/...`) tanpa hak akses | 404/403, tanpa data | |
| H2 | Kirim form dari halaman web lain (CSRF) | Ditolak 403 | |
| H3 | Masukkan `<script>`/`<img onerror>` di nama pelanggan, keterangan, pencarian | Tampil sebagai teks; tidak dieksekusi | |
| H4 | Unggah berkas bukan PDF/PNG/JPG (mis. `.exe`, SVG) sebagai bukti/logo | Ditolak | |
| H5 | Mulai ulang server (`docker compose restart app`) saat ada sesi | Data & sesi bertahan | |
| H6 | `nmap` dari luar: port 3000 dan 5432 | Tertutup | |
| H7 | Buka `http://` (tanpa TLS) | Dialihkan ke HTTPS | |

## I. Operasional — P0

| ID | Skenario | Hasil yang diharapkan | Hasil |
|---|---|---|---|
| I1 | `smoke.mjs` pada URL staging | SMOKE TEST LULUS | |
| I2 | Backup harian muncul di `./backups` **dan** tersalin keluar server | File `.dump` + `.sha256`, salinan luar ada | |
| I3 | Latihan restore ke database baru → `db:reconcile` | Bersih | |
| I4 | Simulasi ponsel hilang: pakai kode pemulihan; lalu Reset 2FA oleh Admin lain | Akses pulih; keduanya tercatat di audit | |
| I5 | `db:reconcile` harian | Kode keluar 0 setiap hari | |

## J. Lembar rekonsiliasi mingguan (paralel dengan proses lama)

Isi tiap akhir pekan; **selisih harus nol atau terjelaskan satu per satu**. Dua minggu berturut-turut tanpa selisih tak terjelaskan = syarat go-live.

| Pemeriksaan | Sistem baru | Proses lama / bank | Selisih | Penjelasan | Paraf |
|---|---:|---:|---:|---|---|
| Jumlah invoice terbit minggu ini | | | | | |
| Total nilai invoice terbit | | | | | |
| Total pembayaran masuk | | | | | |
| Saldo akhir tiap rekening bank (vs rekening koran) | | | | | |
| Saldo kas tunai (vs hitung fisik) | | | | | |
| Total piutang berjalan (vs daftar manual) | | | | | |
| Total pengeluaran disetujui | | | | | |
| Nomor invoice terakhir (berurutan, tanpa lompatan) | | | | | |
| `db:reconcile` | bersih / ✘ | — | | | |

## K. Buku temuan

| No | Tanggal | Skenario | Deskripsi & bukti | Tingkat (P0/P1/P2) | Pemilik perbaikan | Status | Ditutup |
|---|---|---|---|---|---|---|---|

**Keputusan go/no-go** (pemilik): ☐ GO  ☐ NO-GO  ☐ GO bersyarat: ______ · Tanggal: ______ · Tanda tangan: ______
