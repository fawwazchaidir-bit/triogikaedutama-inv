# Bab 10 — Rekonsiliasi Bank

> **Peran:** Pelaksana ✔ impor, cocokkan, catat dari mutasi (diajukan), hapus draft · Finance Manager ✔ + **finalisasi** dan **buka kembali**

Rekonsiliasi mencocokkan **rekening koran bank** dengan **buku**. Targetnya: **Selisih = 0**.

```
Saldo akhir bank + transaksi buku yang masih beredar = Saldo bank disesuaikan  ═  Saldo buku
```

## 10.1 Alur kerja

1. Unduh CSV mutasi dari internet banking.
2. **Impor** rekening koran (Pelaksana).
3. **Pencocokan otomatis**, lalu cocokkan sisanya secara **manual**.
4. Mutasi yang hanya ada di bank (biaya admin, bunga): **Catat dari mutasi**.
5. Selisih 0 → **Finalisasi** (Finance Manager).

## 10.2 Halaman awal

{{fig:rec-list-empty}}

## 10.3 Mengimpor rekening koran

Siapkan: periode (awal periode harus bersambung dengan periode sebelumnya), **saldo awal** dan **saldo akhir menurut rekening koran**, dan berkas CSV.

{{fig:rec-import-form}}

Klik **Pratinjau**. Sistem mendeteksi kolom, format tanggal, dan format angka. Ubah bila keliru lalu **Terapkan pemetaan**. Tombol **Impor** hanya aktif jika berkas tanpa error dan **saldo awal + mutasi = saldo akhir**.

{{fig:rec-import-preview}}

**Memetakan kolom:** kolom *Jumlah (bertanda)* dipakai bila bank memberi satu kolom positif/negatif; bila bank memisahkan *Debit (keluar)* dan *Kredit (masuk)*, pilih keduanya. Format angka Indonesia `1.234.567,00`; format Inggris `1,234,567.00`.

## 10.4 Ruang kerja rekonsiliasi

{{fig:rec-workspace}}

### Pencocokan otomatis

Menyamakan nominal yang persis sama dengan transaksi buku dalam jendela tanggal (± 0–14 hari; bawaan 5).

{{fig:rec-automatch}}

### Pencocokan manual

Untuk baris yang tidak cocok otomatis (mis. tanggal bergeser jauh atau satu setoran untuk beberapa transaksi). Pilih transaksi yang **totalnya persis sama** dengan sisa baris mutasi.

{{fig:rec-match-dialog}}

Tombol **Lepas** membatalkan pencocokan sebuah baris selama masih draft.

### Catat dari mutasi

Untuk mutasi yang belum ada di buku (biaya admin, bunga bank).

- **Pelaksana:** entri tercatat **menunggu persetujuan** Finance Manager; setelah disetujui, cocokkan barisnya.
- **Finance Manager:** entri langsung berlaku dan otomatis dicocokkan.
- Uang keluar di atas Rp 1.000.000 wajib melampirkan bukti.

{{fig:rec-entry-staff}}

{{fig:rec-entry-fm}}

## 10.5 Finalisasi (Finance Manager)

Setelah selisih 0, tombol **Finalisasi** aktif.

{{fig:rec-ready}}

{{fig:rec-finalize-dialog}}

{{fig:rec-final}}

### Membuka kembali

Hanya rekening koran **terakhir** yang final pada akun tersebut. Alasan wajib dan tercatat di audit.

{{fig:rec-reopen-dialog}}

{{fig:rec-list-after}}

## Tips & Kesalahan Umum

- Selisih tidak nol? Periksa: pembayaran/pengeluaran belum dicatat di buku, nominal salah, atau pencocokan keliru.
- “Transaksi buku yang beredar” normal untuk setoran atau cek dalam perjalanan; ia akan cocok di periode berikutnya.
- Salah impor? **Hapus draft** lalu impor ulang; transaksi buku tidak terpengaruh.
- Impor per bulan secara rutin; jangan menumpuk berbulan-bulan.
