# Bab 14 — Tutup Buku

> **Peran:** Pelaksana ✔ lihat · Finance Manager ✔ **tutup** dan **buka kembali**

Penutupan menyimpan **foto neraca saldo + hash** dan mengunci transaksi bertanggal sampai akhir bulan itu. Bulan ditutup **berurutan** dari yang paling awal.

## 14.1 Daftar periode

{{fig:close-staff}}

{{fig:close-fm}}

| Status | Artinya |
|---|---|
| Belum ditutup | Bulan sudah berlalu, belum ditutup |
| Berjalan | Bulan berjalan, belum boleh ditutup |
| Ditutup | Terkunci, ada foto & hash |
| Dibuka kembali | Pernah ditutup lalu dibuka (alasan tercatat) |

## 14.2 Menutup bulan

1. Pastikan transaksi bulan itu lengkap: invoice, pembayaran, pengeluaran **sudah disetujui**, rekonsiliasi bank selesai.
2. Klik **Tutup bulan** pada bulan yang berhak ditutup.
3. Baca **daftar periksa**: ✔ lolos, ✘ menghalangi (selesaikan dulu), ⚠ peringatan (boleh dilanjutkan bila **diakui**).
4. Isi **catatan penutupan** (min. 5 karakter) lalu klik **Tutup <bulan>**.

{{fig:close-checklist}}

{{fig:close-confirm}}

{{fig:close-done}}

**Foto cocok** berarti angka periode sama dengan perhitungan ulang buku besar. Bila muncul **Foto berubah!**, segera hubungi Administrator.

## 14.3 Membuka kembali

Hanya periode yang paling akhir ditutup. Alasan wajib dan tercatat di audit log.

{{fig:close-reopen}}

## Tips & Kesalahan Umum

- Tutup bulan setelah rekonsiliasi bank final dan tidak ada pengeluaran menunggu persetujuan.
- Setelah ditutup, koreksi dilakukan dengan pembalikan bertanggal hari ini (jatuh di bulan berjalan).
- Transaksi bertanggal pada bulan tertutup akan ditolak; ini disengaja.
