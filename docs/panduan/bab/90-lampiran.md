# Lampiran A — Alur Kerja End-to-End

Contoh satu siklus lengkap. **P** = Pelaksana, **FM** = Finance Manager.

| # | Langkah | Siapa | Bab |
|---|---|---|---|
| 1 | Pelanggan baru? Cari dulu, tambah bila belum ada | P | 3 |
| 2 | Buat invoice → simpan draft → periksa PDF draft | P | 5.3–5.4 |
| 3 | Ajukan untuk verifikasi | P | 5.4 |
| 4 | Periksa; setujui & terbitkan **atau** kembalikan dengan catatan | FM | 5.5 |
| 5 | (Bila dikembalikan) perbaiki dan ajukan ulang | P | 5.5 |
| 6 | Kirim PDF invoice terbit ke pelanggan | P/FM | 5.6 |
| 7 | Uang masuk → catat pembayaran (DP/termin/pelunasan), isi referensi dan PPh dipotong bila ada | P | 6 |
| 8 | Invoice lunas → unduh kwitansi | P/FM | 6.4 |
| 9 | Pengeluaran operasional: catat + lampirkan bukti | P | 7 |
| 10 | Setujui atau tolak pengeluaran | FM | 7.4 |
| 11 | Isi kas kecil / pindah dana antar akun | P | 8.2 |
| 12 | Bunga bank, jasa giro: catat penerimaan lain | P (diajukan) / FM | 8.3 |
| 13 | Akhir bulan: impor rekening koran, cocokkan, catat biaya admin/bunga | P | 10 |
| 14 | Finalisasi rekonsiliasi | FM | 10.5 |
| 15 | Isi nomor bukti potong PPh yang masuk | P | 13.3 |
| 16 | Jurnal penyesuaian (mis. penyusutan) | FM | 9.2 |
| 17 | Setoran pajak bila ada | FM | 13.5 |
| 18 | Periksa laporan keuangan & arus kas = neraca | FM (P melihat) | 12 |
| 19 | Tutup buku bulan itu | FM | 14 |

## Skenario koreksi

| Kesalahan | Penanganan |
|---|---|
| Invoice draft salah | Pelaksana ubah (atau hapus) draft |
| Invoice diajukan, salah | Pelaksana **tarik kembali**, perbaiki, ajukan ulang |
| Invoice terbit, salah | FM **batalkan** (balikkan pembayaran dulu bila ada) → duplikasi → ajukan baru |
| Pembayaran salah catat | FM **balikkan** → P catat ulang yang benar |
| Pengeluaran salah, belum disetujui | P **batalkan** pengajuan, catat ulang |
| Pengeluaran salah, sudah berlaku | FM **balikkan** → P catat ulang |
| Transfer salah | FM **balikkan** → P catat ulang |
| Jurnal manual salah | FM **balikkan** → catat ulang |
| Rekonsiliasi final tapi ada koreksi | FM **buka kembali** (periode terakhir) |
| Bulan sudah ditutup | FM **buka kembali** periode terakhir, atau koreksi bertanggal hari ini |

---

# Lampiran B — Rutinitas Kerja

## Pelaksana

| Kapan | Kegiatan |
|---|---|
| **Harian** | Cek lonceng (invoice dikembalikan, jatuh tempo). Input invoice baru & ajukan. Catat pembayaran yang masuk (isi referensi). Catat pengeluaran dengan bukti. Tindak lanjuti draft yang dikembalikan. |
| **Mingguan** | Tinjau *Daftar Piutang* dan *Invoice Jatuh Tempo*; tagih pelanggan. Pastikan tidak ada pengajuan menggantung. Rapikan pelanggan duplikat/arsip. |
| **Bulanan** | Impor rekening koran tiap akun bank; cocokkan otomatis lalu manual; catat biaya admin/bunga. Lengkapi nomor bukti potong PPh. Siapkan bahan penutupan bulan bagi Finance Manager. |

## Finance Manager

| Kapan | Kegiatan |
|---|---|
| **Harian** | Lonceng & Dashboard. Verifikasi/terbitkan atau kembalikan invoice. Setujui/tolak pengeluaran & penerimaan lain. |
| **Mingguan** | Tinjau piutang & jatuh tempo; evaluasi arus kas; cek pengajuan yang tertunda. |
| **Bulanan** | Finalisasi rekonsiliasi. Jurnal penyesuaian. Setoran pajak. Periksa Laba Rugi, Arus Kas, Neraca (arus kas = neraca). **Tutup buku**. |
| **Tahunan** | Masukan tahun PPh badan bersama akuntan; cetak laporan tahunan (PDF/Excel). |

---

# Lampiran C — Matriks Hak Akses

✔ = boleh · ✘ = tidak ada tombol/ditolak sistem · (A) = hanya Administrator.

| Fitur | Pelaksana | Finance Manager |
|---|:-:|:-:|
| Dashboard | ✘ | ✔ |
| Lihat daftar & detail invoice | ✔ | ✔ |
| Buat / ubah / hapus draft | ✔ (milik sendiri) | ✔ |
| Harga satuan, baris bebas, diskon | ✔ | ✔ |
| Ajukan / tarik kembali pengajuan | ✔ (milik sendiri) | — |
| Setujui & terbitkan, kembalikan | ✘ | ✔ |
| Batalkan invoice terbit | ✘ | ✔ |
| Duplikasi invoice | ✔ | ✔ |
| PDF draft / PDF invoice terbit / riwayat | ✔ | ✔ |
| Catat pembayaran | ✔ | ✔ |
| Balikkan pembayaran | ✘ | ✔ |
| Pelanggan: lihat, tambah, ubah, arsipkan | ✔ | ✔ |
| Produk: lihat | ✔ | ✔ |
| Produk: kelola | (A) | (A) |
| Catat pengeluaran (diajukan) | ✔ | ✔ (langsung berlaku) |
| Lihat pengeluaran | milik sendiri | semua |
| Setujui / tolak pengeluaran | ✘ | ✔ |
| Balikkan pengeluaran, transfer, jurnal | ✘ | ✔ |
| Kas & Bank: lihat saldo & buku kas | ✔ | ✔ |
| Transfer antar akun | ✔ | ✔ |
| Penerimaan lain | ✔ (diajukan) | ✔ (langsung berlaku) |
| Penerimaan non-operasional (modal, prive, pinjaman, aset) | ✘ | ✔ |
| Jurnal: lihat | ✔ | ✔ |
| Jurnal manual | ✘ | ✔ |
| Rekonsiliasi: impor, cocokkan, hapus draft | ✔ | ✔ |
| Rekonsiliasi: catat dari mutasi | ✔ (diajukan) | ✔ (langsung) |
| Rekonsiliasi: finalisasi / buka kembali | ✘ | ✔ |
| Laporan operasional | ✔ | ✔ |
| Laporan keuangan (lihat & ekspor) | ✔ | ✔ |
| Pajak: lihat; isi nomor bukti potong | ✔ | ✔ |
| Pajak: setoran, masukan tahun, jurnal PPh | ✘ | ✔ |
| Pajak: profil | (A) | (A) |
| Tutup buku / buka kembali | ✘ | ✔ |
| Pengaturan: lihat | ✔ | ✔ |
| Pengaturan: ubah, pengguna, integrasi, penomoran, bagan akun, akun kas | (A) | (A) |
| Audit log | (A) | (A) |
| 2FA | sukarela | **wajib** |

> Sumber kebenaran: matriks ini mengikuti `src/lib/permissions.ts`. Bila ada perbedaan antara panduan dan layar, layar (pengaturan terbaru) yang benar; laporkan agar panduan diperbarui.

---

# Lampiran D — Pesan Galat, Penyebab, dan Solusi

| Pesan / gejala | Penyebab | Solusi |
|---|---|---|
| Akun terkunci setelah salah password | 5 kali salah berturut-turut | Tunggu 15 menit, atau minta Administrator |
| “Password tidak boleh memuat nama Anda” | Password mengandung nama/email | Pilih password lain ≥ 12 karakter |
| Kode 2FA selalu salah | Jam ponsel tidak akurat | Aktifkan waktu otomatis; atau pakai kode pemulihan |
| “Pelanggan … sudah ada” | Nama & kota sama persis | Pakai pelanggan yang sudah ada |
| “Ada pelanggan dengan identitas mirip” | Nama sama, kota beda | Konfirmasi bila memang berbeda; batal bila sama |
| Tombol **Simpan jurnal** nonaktif | Debit ≠ kredit | Samakan total debit dan kredit |
| “Anda tidak berwenang memberi diskon / mengubah harga” | Izin peran | Hubungi Finance Manager |
| “Invoice sedang menunggu verifikasi dan terkunci” | Sudah diajukan | **Tarik kembali** pengajuan bila perlu mengubah |
| “Draft ini baru saja diubah oleh pengguna/tab lain” | Dua tab membuka draft yang sama | Muat ulang halaman |
| “Hanya draft yang dapat dihapus. Invoice terbit harus dibatalkan.” | Invoice sudah bernomor | Finance Manager membatalkan |
| “Invoice ini memiliki pembayaran tercatat. Balikkan seluruh pembayaran …” | Membatalkan invoice yang sudah dibayar | Balikkan pembayaran dulu |
| “Invoice ini sudah lunas” | Tidak ada sisa tagihan | Periksa pembayaran ganda; balikkan bila salah |
| Pembayaran ditolak: melebihi sisa | Nominal > sisa tagihan | Isi sesuai sisa yang tertera |
| Bukti wajib | Pengeluaran > Rp 1.000.000 | Lampirkan nota |
| “Anda tidak dapat menyetujui entri yang Anda catat sendiri” | Pemisahan tugas | Minta Finance Manager lain |
| “Hanya entri yang sudah berlaku yang dapat dibalikkan” | Entri masih menunggu atau ditolak | Batalkan pengajuan / catat ulang |
| “Entri ini sudah pernah dibalikkan” | Pembalikan ganda | Tidak perlu tindakan |
| “Akun asal dan tujuan harus berbeda” | Transfer ke akun yang sama | Pilih akun lain |
| “Berkas CSV bermasalah” | Format tanggal/angka tidak cocok | Ubah **Format tanggal/angka**, **Terapkan pemetaan** |
| Impor nonaktif, “saldo awal + mutasi tidak sama” | CSV tidak lengkap atau saldo salah | Periksa periode, saldo awal/akhir, dan berkas |
| “baris bertanggal di luar periode …” | Mutasi di luar rentang yang dipilih | Perbaiki periode atau CSV |
| Finalisasi nonaktif, “Belum dapat difinalisasi” | Selisih ≠ 0 atau masih ada baris belum cocok | Selesaikan sesuai daftar masalah |
| “Buku sudah ditutup sampai …” | Transaksi bertanggal bulan tertutup | Finance Manager buka kembali periode, atau koreksi bertanggal hari ini |
| “Belum dapat ditutup: …” | Cek HARD gagal | Selesaikan butir bertanda ✘ |
| “Akui peringatan berikut sebelum menutup” | Butir ⚠ belum dicentang | Centang pengakuan bila memang wajar |
| “Foto berubah!” | Angka periode tertutup berubah di luar prosedur | Hubungi Administrator segera |
| “KAS TIDAK COCOK” | Arus kas ≠ neraca | Hubungi Administrator |
| Menu tidak muncul | Bukan wewenang peran Anda | Normal; lihat Lampiran C |
| Saldo kas negatif (banner merah) | Penerimaan belum dicatat / salah input | Periksa buku kas akun tersebut |
| “Belum ada akun kas/bank” | Administrator belum mengatur | Minta Administrator (Pengaturan → Keuangan) |

## FAQ

**Mengapa pengeluaran saya belum mengurangi saldo?** Masih *Menunggu persetujuan*. Saldo berubah setelah Finance Manager menyetujui.

**Bolehkah mengedit pembayaran yang salah?** Tidak. Finance Manager membalikkannya, lalu Anda mencatat ulang.

**Kenapa nomor invoice meloncat?** Nomor dialokasikan saat diterbitkan, tidak pernah dipakai ulang; invoice batal tetap memakai nomornya.

**Apakah dashboard dan laporan boleh dijumlahkan (invoice + kas)?** Tidak. Penerbitan dan penerimaan kas adalah dua ukuran berbeda.

**Mengapa laporan keuangan tidak memasukkan piutang?** Sistem berbasis kas: pendapatan diakui saat uang masuk.

**Bagaimana jika pelanggan membayar dua kali?** Catat sesuai kenyataan hanya sampai sisa tagihan; kelebihan tidak dapat dicatat pada invoice. Bahas pengembalian dengan Finance Manager.

**Bisakah saya menghapus pelanggan?** Tidak; arsipkan. Riwayat tetap utuh.

**Apakah gambar di panduan sama persis dengan layar saya?** Tata letak sama; data pada gambar adalah data contoh, dan menu/tombol mengikuti peran Anda.

---

# Lampiran E — Glosarium

| Istilah | Arti |
|---|---|
| **Basis kas** | Pendapatan diakui saat uang diterima, beban saat dibayar |
| **Draft** | Invoice belum bernomor yang masih dapat diubah |
| **Nett Total** | Total akhir invoice setelah diskon, biaya, dan pajak |
| **DP** | Uang muka; dicatat sebagai pembayaran pertama saat invoice terbit |
| **Piutang** | Sisa tagihan invoice terbit yang belum dibayar |
| **Jatuh tempo** | Tanggal batas pembayaran (tanggal invoice + jangka waktu) |
| **Kwitansi** | PDF invoice yang sudah lunas, bertanda LUNAS |
| **Pembalikan** | Baris koreksi bernilai berlawanan; transaksi asli tetap tampil |
| **Berlaku** | Entri yang sudah disetujui dan dihitung dalam saldo/laporan |
| **Menunggu persetujuan** | Entri diajukan, belum memengaruhi saldo |
| **Transfer** | Pemindahan dana antar kas/bank; tidak memengaruhi laba rugi |
| **Jurnal manual** | Jurnal penyesuaian yang dicatat Finance Manager |
| **Rekonsiliasi** | Pencocokan rekening koran dengan buku; target selisih 0 |
| **Transaksi beredar** | Ada di buku tetapi belum muncul di rekening koran |
| **Finalisasi** | Mengunci hasil rekonsiliasi periode |
| **PPh 23 dipotong** | Pajak yang dipotong pelanggan; menjadi kredit pajak lembaga |
| **Bukti potong** | Dokumen pelanggan atas PPh yang dipotong |
| **NTPN** | Nomor Transaksi Penerimaan Negara (bukti setor pajak) |
| **PKP** | Pengusaha Kena Pajak |
| **Tutup buku** | Mengunci transaksi sampai akhir bulan dan menyimpan foto + hash |
| **Hash / foto** | Sidik jari digital neraca saldo penutupan untuk mendeteksi perubahan |
| **2FA / TOTP** | Autentikasi dua langkah dengan kode 6 digit berganti tiap 30 detik |
| **Kode pemulihan** | Kode sekali pakai untuk masuk bila ponsel hilang |
| **Audit log** | Catatan seluruh aksi penting (siapa, kapan, apa) |
