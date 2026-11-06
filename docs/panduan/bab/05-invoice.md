# Bab 5 — Invoice

> **Peran:** Pelaksana ✔ buat, ubah draft, ajukan, tarik kembali, duplikasi, hapus draft, lihat PDF · Finance Manager ✔ + terbitkan, kembalikan, batalkan

## 5.1 Alur hidup sebuah invoice

```
Draft ──(Pelaksana ajukan)──► Menunggu Verifikasi ──(Finance Manager setujui)──► Diterbitkan ──► (dibayar bertahap) ──► Lunas
  ▲                                   │                                               │
  └──(Finance Manager kembalikan)─────┘                                               └──(Finance Manager batalkan)──► Dibatalkan
```

| Status | Artinya | Bisa diubah? |
|---|---|---|
| **Draft** | Belum bernomor, berwatermark DRAFT | Ya, oleh pembuatnya |
| **Menunggu Verifikasi** | Diajukan, menunggu Finance Manager | Tidak (terkunci); dapat ditarik kembali |
| **Diterbitkan** | Bernomor resmi, bertanda tangan & cap | Tidak (dibekukan) |
| **Dibatalkan** | Dibatalkan beserta alasan; nomor tidak dipakai ulang | Tidak |

Status **pembayaran** terpisah dari status dokumen: *Belum Dibayar → Dibayar Sebagian → Lunas*, dan *Jatuh Tempo* bila melewati tanggal jatuh tempo dengan sisa tagihan.

## 5.2 Daftar invoice

{{fig:inv-list}}

{{fig:inv-list-filtered}}

{{fig:inv-row-menu}}

## 5.3 Membuat invoice (Pelaksana)

Klik **Buat invoice**. Formulir terdiri dari tiga bagian.

### a. Informasi utama

{{fig:inv-new-top}}

### b. Rincian transaksi

{{fig:inv-new-lines}}

### c. Ringkasan biaya

{{fig:inv-new-summary}}

### Validasi

Isian wajib yang kosong ditandai merah dengan pesan. Perbaiki lalu simpan lagi.

{{fig:inv-new-error}}

### Tiga cara menyimpan

| Tombol | Hasil |
|---|---|
| **Simpan sebagai draft** | Draft tersimpan, dapat dilanjutkan nanti |
| **Simpan & lihat PDF draft** | Draft tersimpan, lalu pratinjau PDF berwatermark dibuka |
| **Simpan & ajukan verifikasi** | Draft tersimpan dan langsung dikirim ke Finance Manager |

## 5.4 Draft, pratinjau PDF, dan pengajuan

{{fig:inv-draft}}

{{fig:inv-pdf-draft}}

### Mengajukan untuk verifikasi

Setelah diajukan, isi invoice **terkunci**. Finance Manager menerima pemberitahuan di lonceng.

{{fig:inv-submit-dialog}}

{{fig:inv-submitted}}

### Menarik kembali pengajuan

Dipakai bila Anda menyadari kesalahan **sebelum** Finance Manager memeriksa. Invoice kembali menjadi draft yang bisa diedit.

{{fig:inv-withdraw-dialog}}

## 5.5 Verifikasi dan penerbitan (Finance Manager)

Buka invoice dari lonceng atau filter *Menunggu verifikasi*. Periksa pelanggan, rincian, nominal, dan PDF.

{{fig:inv-review}}

### Opsi 1 — Kembalikan ke Pelaksana

Tulis catatan perbaikan yang **spesifik**; catatan terlihat oleh Pelaksana.

{{fig:inv-return-dialog}}

### Pelaksana memperbaiki

{{fig:inv-returned}}

{{fig:inv-edit}}

### Opsi 2 — Setujui & terbitkan

Nomor dialokasikan (urut, tidak dipakai ulang), tanda tangan dan cap muncul, isi dibekukan. Bila ada DP yang diisi, DP dicatat sebagai pembayaran pertama.

{{fig:inv-approve-dialog}}

## 5.6 Invoice terbit

{{fig:inv-issued}}

{{fig:inv-pdf-issued}}

## 5.7 Membatalkan invoice terbit (Finance Manager)

{{fig:inv-menu-detail}}

Alasan wajib. **Bila sudah ada pembayaran, balikkan pembayaran lebih dulu** (Bab 6). Invoice tetap tersimpan dengan status Dibatalkan.

{{fig:inv-cancel-dialog}}

{{fig:inv-cancelled}}

## 5.8 Menduplikasi invoice

Berguna untuk pelanggan berulang. Rincian disalin, tetapi **tanpa nomor, tanpa DP, dan tanpa pembayaran**. Sesuaikan tanggal dan jumlah, lalu simpan atau ajukan.

{{fig:inv-duplicated}}

## 5.9 Menghapus draft

Hanya draft (belum bernomor) yang dapat dihapus; penghapusan tercatat di audit log. Invoice yang sudah bernomor tidak dihapus, tetapi dibatalkan.

{{fig:inv-delete-dialog}}

## Tips & Kesalahan Umum

- **Periksa tanggal dan jatuh tempo** sebelum mengajukan; invoice terbit tidak dapat diubah.
- Gunakan kolom deskripsi baris untuk detail (nama peserta, periode); “Remark” program mengikuti produk.
- Bila salah setelah terbit: batalkan (Finance Manager) lalu duplikasi menjadi draft baru.
- Pelaksana hanya dapat mengedit/mengajukan/menghapus draft **miliknya sendiri**.
- DP tidak mengurangi nilai invoice; ia dicatat sebagai pembayaran pertama.
