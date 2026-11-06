# Bab 2 — Dashboard Keuangan

> **Peran:** Finance Manager ✔ · Pelaksana ✘ (menu tidak tersedia)

Dashboard memberi gambaran cepat kondisi penagihan. Semua angka dihitung langsung dari database, bukan input manual, sehingga selalu sama dengan daftar dan laporan.

## 2.1 Membaca dashboard

{{fig:dash}}

**Cara memahami angka:**

- **Nilai Invoice Terbit** = total nilai invoice yang diterbitkan pada periode (penerbitan, *bukan* uang masuk).
- **Penerimaan Kas** = uang yang benar-benar diterima pada periode (menurut tanggal pembayaran, dikurangi pembalikan).
- **Piutang Belum Dibayar** = sisa tagihan invoice terbit per hari ini.
- Enam status invoice **saling lepas**: satu invoice hanya masuk ke satu status, sehingga jumlahnya cocok dengan Total.
- Angka Nilai Invoice dan Penerimaan Kas **tidak boleh dijumlahkan**.

## 2.2 Memilih periode

{{fig:dash-period}}

Tombol **Terapkan** nonaktif bila tanggal tidak valid (tanggal akhir tidak boleh di masa depan atau sebelum tanggal awal).

## 2.3 Grafik dalam bentuk tabel

{{fig:dash-table}}

## 2.4 Dashboard untuk satu pelanggan

{{fig:dash-customer}}

## Tips

- Klik kartu atau status untuk membuka daftar invoice yang terfilter sesuai definisi yang sama.
- Cek dashboard dan lonceng setiap pagi sebagai titik awal pekerjaan harian.
