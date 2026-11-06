# Bab 13 — Pajak

> **Peran:** Pelaksana ✔ lihat, **isi nomor bukti potong** · Finance Manager ✔ + **catat setoran pajak** dan masukan tahunan · Profil pajak: Administrator

Rekap PPN, PPh yang dipotong pelanggan, estimasi PPh badan, dan setoran pajak. Ini **estimasi manajemen** dari pembukuan basis kas, **bukan SPT**. Sistem tidak mengasumsikan tarif.

## 13.1 Ringkasan

{{fig:tax-summary-staff}}

## 13.2 PPN

Lembaga non-PKP umumnya bernilai nol. Tabel membandingkan PPN menurut invoice (acuan faktur pajak) dengan PPN yang diterima kas.

{{fig:tax-ppn}}

## 13.3 PPh dipotong pelanggan

Register seluruh pembayaran yang dipotong PPh. Lencana **Belum ada** berarti nomor bukti potong belum diisi.

{{fig:tax-pph23}}

### Mengisi nomor bukti potong

Dapat diisi **satu kali**. Untuk koreksi, minta Finance Manager membalikkan pembayaran lalu catat ulang dengan nomor yang benar.

{{fig:tax-pph23-ref}}

## 13.4 Estimasi PPh badan

{{fig:tax-corp}}

Bila rezim dan tarif sudah diaktifkan Administrator, halaman menampilkan perhitungan dan **jurnal penyesuaian yang disarankan**, yang dapat dicatat Finance Manager. Untuk tarif umum, Finance Manager menginput **masukan tahun** (koreksi fiskal, kompensasi kerugian, pengurang) dari akuntan.

## 13.5 Setoran pajak (Finance Manager)

Kas keluar yang mengurangi utang PPN atau utang PPh badan (**bukan beban**). NTPN/ID billing wajib sebagai bukti.

{{fig:tax-payments-fm}}

{{fig:tax-payment-new}}

## 13.6 Profil pajak (Administrator)

{{fig:tax-profile-admin}}

## Tips

- Setiap bulan, tindak lanjuti baris **Belum ada** pada register PPh agar kredit pajak punya bukti.
- Konsultasikan tarif dan rezim dengan konsultan pajak sebelum mengaturnya.
