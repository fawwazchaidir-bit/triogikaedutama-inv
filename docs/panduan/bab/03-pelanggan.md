# Bab 3 — Pelanggan

> **Peran:** Pelaksana ✔ · Finance Manager ✔ (lihat, tambah, ubah, arsipkan)

## 3.1 Daftar pelanggan

{{fig:cust-list}}

**Piutang** per pelanggan = nilai invoice terbit dikurangi pembayaran yang tercatat.

## 3.2 Menambah pelanggan

1. Klik **Tambah pelanggan**.
2. Isi **Nama** (wajib) persis seperti yang akan tercetak di invoice. Lengkapi kontak, kota, email, dan NPWP bila ada.
3. Klik **Simpan**.

{{fig:cust-new}}

{{fig:cust-saved}}

### Pencegahan duplikat

Sistem mencegah pelanggan ganda karena salah ketik.

- **Nama dan kota sama persis** → penyimpanan **ditolak** dan pelanggan yang cocok ditampilkan. Pakai yang sudah ada.

{{fig:cust-dup-exact}}

- **Nama sama, kota berbeda** → diminta **konfirmasi**. Pilih lanjut hanya bila memang entitas berbeda (misalnya cabang lain).

{{fig:cust-dup}}

## 3.3 Detail pelanggan

Klik nama pelanggan untuk melihat data kontak, ringkasan piutang, dan seluruh riwayat invoice.

{{fig:cust-detail}}

## 3.4 Mengubah pelanggan

Perubahan data pelanggan **tidak** mengubah invoice yang sudah terbit (nama pada invoice terbit adalah salinan beku).

{{fig:cust-edit}}

## 3.5 Mengarsipkan pelanggan

Pelanggan yang tidak aktif **diarsipkan**, bukan dihapus: riwayatnya tetap utuh dan pelanggan tidak muncul di pilihan invoice baru. Untuk mengaktifkan kembali, filter **Status → Diarsipkan** lalu aktifkan.

{{fig:cust-archive}}

## Tips & Kesalahan Umum

- Cari dulu sebelum menambah; hindari duplikat.
- Tulis nama lembaga lengkap dan konsisten (mis. “PT Nusantara Boga”, bukan “Nusantara”).
- Ejaan nama menentukan tampilan di PDF invoice; periksa sebelum menyimpan.
