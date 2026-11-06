# Bab 8 — Kas & Bank

> **Peran:** Pelaksana ✔ transfer, penerimaan lain (diajukan) · Finance Manager ✔ + penerimaan/non-operasional langsung berlaku, balikkan transfer

Saldo = saldo awal (diinput Administrator) + seluruh mutasi **berlaku** sejak tanggal saldo awal.

## 8.1 Tampilan utama

{{fig:cash-overview-staff}}

- Kartu akun menampilkan saldo dan saldo awal. Klik kartu untuk melihat buku kas akun itu.
- Pemberitahuan di atas halaman: **saldo negatif** (merah; periksa penerimaan yang belum dicatat atau salah input), **pembayaran invoice belum dialokasikan ke akun** (kuning), dan **entri menunggu persetujuan** (biru; belum dihitung dalam saldo).

## 8.2 Transfer antar akun

Memindahkan dana antar kas/bank (mis. isi kas kecil). Total kas tidak berubah dan laba rugi tidak terpengaruh. Transfer **langsung berlaku** tanpa persetujuan.

{{fig:cash-transfer}}

## 8.3 Penerimaan lain

Untuk uang masuk yang **bukan** pembayaran invoice (bunga, jasa giro, hibah).

- **Pelaksana:** kategori terbatas pada akun pendapatan; arah otomatis *Masuk*; entri **menunggu persetujuan**.
- **Finance Manager:** dapat memilih kategori non-operasional (modal, prive, pinjaman, aset); entri **langsung berlaku**.

{{fig:cash-receipt-staff}}

{{fig:cash-after-staff}}

### Finance Manager menyetujui penerimaan lain

Penerimaan yang diajukan Pelaksana tampil di menu **Pengeluaran** (status Menunggu persetujuan) dan disetujui seperti pengeluaran.

{{fig:cash-receipt-pending-fm}}

## 8.4 Tampilan Finance Manager

{{fig:cash-overview-fm}}

{{fig:cash-other-fm}}

## 8.5 Buku kas per akun

Setiap mutasi (pembayaran invoice, pengeluaran, penerimaan, transfer) tampil dengan saldo berjalan.

{{fig:cash-ledger}}

## 8.6 Membalikkan transfer (Finance Manager)

{{fig:cash-transfer-reverse}}

{{fig:cash-transfer-reversed}}

## Tips & Kesalahan Umum

- Transfer salah akun → minta Finance Manager membalikkan, lalu catat ulang.
- Saldo negatif hampir selalu berarti ada penerimaan yang belum dicatat.
- Jangan mencatat penerimaan invoice di sini; catat sebagai **pembayaran** pada invoice (Bab 6).
