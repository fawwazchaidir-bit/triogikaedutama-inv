# Bab 11 — Laporan Operasional

> **Peran:** Pelaksana ✔ · Finance Manager ✔ (lihat & ekspor CSV/Excel)

Laporan operasional penagihan. **Bukan** laporan akuntansi: nilai invoice (penerbitan) dan penerimaan kas dilaporkan terpisah dan tidak boleh dijumlahkan.

| Kelompok | Laporan | Fungsi |
|---|---|---|
| Penerbitan invoice | Daftar Invoice | Seluruh invoice terbit & batal menurut tanggal invoice |
| | Rekap per Pelanggan | Nilai invoice, jumlah dibayar, dan sisanya per pelanggan |
| | Rekap per Produk / Skema | Nilai bersih baris per produk |
| | Invoice Lunas | Invoice terbit yang sudah lunas |
| | Invoice Dibatalkan | Beserta alasan dan pelakunya |
| Penerimaan kas | Rekap Pembayaran Masuk | Menurut tanggal pembayaran, termasuk pembalikan |
| | Rekap Bulanan & Tahunan | Invoice terbit vs penerimaan kas per bulan |
| Piutang | Daftar Piutang | Sisa tagihan > 0 per hari ini beserta umur piutang |
| | Invoice Jatuh Tempo | Melewati jatuh tempo, belum lunas |

{{fig:rpt-invoices}}

{{fig:rpt-receivables}}

{{fig:rpt-monthly}}

{{fig:rpt-payments}}

## Cara memakai

1. Pilih jenis laporan.
2. Atur **periode** dan **pelanggan** (laporan piutang selalu *per hari ini*, tanpa filter tanggal).
3. Klik **Terapkan**, lalu **CSV** atau **Excel** untuk mengunduh. Ekspor mengikuti filter yang tampil.

## Tips

- Gunakan *Daftar Piutang* untuk menyusun penagihan mingguan.
- Gunakan *Rekap Bulanan* untuk membandingkan penerbitan vs kas.
