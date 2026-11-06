# Bab 6 — Pembayaran

> **Peran:** Pelaksana ✔ catat pembayaran · Finance Manager ✔ catat + **balikkan**

Pembayaran hanya dapat dicatat untuk **invoice terbit** dengan sisa tagihan.

## 6.1 Mencatat pembayaran dari halaman invoice

1. Buka invoice terbit → **Catat pembayaran**.
2. Isi tanggal uang diterima, jumlah, metode, akun penerima, referensi, dan (opsional) bukti.
3. **Simpan**.

{{fig:pay-dialog}}

Setelah dicatat, status pembayaran berubah otomatis dan uang masuk ke buku kas akun yang dipilih.

{{fig:pay-recorded}}

## 6.2 Pembayaran dengan PPh dipotong pelanggan

Bila pelanggan (mis. instansi) memotong PPh 23, uang yang masuk lebih kecil dari tagihan. Isi **nominal uang yang diterima** dan **PPh yang dipotong**; keduanya mengurangi sisa tagihan. Nomor bukti potong dapat diisi kemudian di menu Pajak (Bab 13).

{{fig:pay-pph}}

## 6.3 Pembayaran melebihi sisa tagihan

{{fig:pay-over}}

## 6.4 Invoice lunas dan kwitansi

Sisa nol → status **Lunas**. PDF otomatis berjudul **KWITANSI** dengan tanda LUNAS dan tanggal pelunasan.

{{fig:pay-paid}}

{{fig:inv-pdf-kwitansi}}

## 6.5 Menu Pembayaran

Seluruh pembayaran dan pembalikan, berguna untuk mencocokkan dengan rekening koran.

{{fig:pay-list}}

Mencatat dari menu ini: klik **Catat pembayaran**, cari invoice, lalu isi formulir yang sama.

{{fig:pay-pick}}

## 6.6 Membalikkan pembayaran (Finance Manager)

Pembayaran **tidak dapat diedit atau dihapus**. Kesalahan (salah nominal, salah akun, uang tidak jadi masuk) dikoreksi dengan pembalikan.

{{fig:pay-reverse-dialog}}

{{fig:pay-reversed}}

> Pelaksana yang menemukan kesalahan pembayaran: laporkan ke Finance Manager dengan nomor invoice dan alasannya, lalu catat ulang pembayaran yang benar setelah dibalikkan.

## Tips & Kesalahan Umum

- Isi **tanggal uang diterima**, bukan tanggal Anda mengetik.
- Isi **referensi transfer**; itu memudahkan pencocokan rekening koran otomatis.
- Pastikan **akun penerima** benar. Pilihan “Otomatis” memakai bank default (Transfer/QRIS/VA) atau kas (Tunai).
- PPh dipotong: jangan memasukkan nominal tagihan penuh sebagai uang diterima.
