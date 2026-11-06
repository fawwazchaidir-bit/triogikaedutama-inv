# Tentang Panduan Ini

Panduan ini menjelaskan **setiap menu dan fitur** Trilogika Financial Management System (FMS) lengkap dengan tangkapan layar bernomor. Ditulis untuk dua peran pengguna harian:

| Peran | Nama di aplikasi | Gambaran tugas |
|---|---|---|
| **Pelaksana** | Staf Administrasi Keuangan | Menginput data: pelanggan, invoice (lalu mengajukannya), pembayaran, pengeluaran dan penerimaan lain (diajukan), transfer kas, impor & pencocokan rekening koran. Melihat seluruh laporan, tanpa dapat mengubahnya. |
| **Finance Manager** | Finance Manager | Penyetuju dan pemegang otoritas koreksi: memverifikasi & menerbitkan invoice, menyetujui pengeluaran, membalikkan transaksi, jurnal manual, finalisasi rekonsiliasi, setoran pajak, tutup buku, dan melihat dashboard. |

Administrator (pemilik sistem) mengelola pengguna, pengaturan, penomoran, pajak, dan integrasi. Menu Administrator tidak dibahas rinci di sini; hanya tampilan yang perlu diketahui kedua peran di atas.

## Cara membaca panduan

- **Kotak peran** di awal tiap bab menunjukkan siapa yang dapat melakukan apa. Bila Anda Pelaksana dan fitur hanya untuk Finance Manager, tombolnya memang **tidak muncul** di layar Anda; itu normal, bukan galat.
- **Penanda angka merah** pada gambar (①, ②, …) menunjuk elemen yang dijelaskan pada daftar bernomor di bawah gambar.
- Data pada gambar adalah **data contoh** (pelanggan, nominal, dan nomor invoice fiktif).
- Setiap bab diakhiri **Tips & Kesalahan Umum**. Daftar lengkap pesan galat ada di Lampiran D.

## Prinsip kerja sistem (wajib dipahami)

1. **Draft → Diajukan → Diterbitkan.** Pelaksana menyusun dan mengajukan; Finance Manager menerbitkan. Invoice terbit bernomor, bertanda tangan, dan **dibekukan**.
2. **Tidak ada hapus/ubah diam-diam.** Transaksi yang sudah berlaku (pembayaran, pengeluaran, transfer, jurnal) tidak dapat diedit atau dihapus. Koreksi dilakukan dengan **pembalikan** oleh Finance Manager; transaksi asli tetap tampil sehingga jejaknya utuh.
3. **Dua tahap untuk uang keluar.** Pengeluaran yang dicatat Pelaksana berstatus *Menunggu persetujuan* dan **belum** memengaruhi saldo/laporan sampai Finance Manager menyetujui. Pencatat tidak dapat menyetujui entrinya sendiri.
4. **Basis kas.** Laporan keuangan mengakui pendapatan saat uang diterima dan beban saat dibayar. Nilai *invoice terbit* dan *penerimaan kas* dilaporkan terpisah dan tidak boleh dijumlahkan.
5. **Buku dikunci per bulan.** Setelah bulan ditutup, transaksi bertanggal pada bulan itu ditolak. Koreksi dilakukan lewat pembalikan bertanggal hari ini.
6. **Semua tercatat.** Siapa melakukan apa dan kapan terekam di riwayat invoice dan audit log.

## Peta menu

| Menu | Pelaksana | Finance Manager | Bab |
|---|---|---|---|
| Dashboard | — (tidak tersedia) | ✔ | 2 |
| Invoice | Buat, ubah draft, ajukan, tarik kembali, duplikasi, hapus draft, PDF | + Terbitkan, kembalikan, batalkan | 5 |
| Pembayaran | Catat | + Balikkan | 6 |
| Pelanggan | Lihat, tambah, ubah, arsipkan | sama | 3 |
| Produk & Layanan | Lihat | Lihat | 4 |
| Pengeluaran | Ajukan, batalkan pengajuan sendiri | + Setujui, tolak, balikkan | 7 |
| Kas & Bank | Transfer, penerimaan lain (diajukan) | + Penerimaan/non-operasional langsung berlaku, balikkan transfer | 8 |
| Jurnal | Lihat | + Jurnal manual, balikkan | 9 |
| Rekonsiliasi | Impor, cocokkan, catat dari mutasi (diajukan), hapus draft | + Finalisasi, buka kembali | 10 |
| Laporan | Lihat & ekspor | sama | 11 |
| Laporan Keuangan | Lihat & ekspor | sama | 12 |
| Pajak | Lihat; isi nomor bukti potong | + Setoran pajak, masukan tahun | 13 |
| Tutup Buku | Lihat | + Tutup, buka kembali | 14 |
| Pengaturan | Lihat (sebagian tab) | Lihat | 15 |
| Audit Log | — | — | Administrator |

> Rincian lengkap hak akses ada di **Lampiran C**.
