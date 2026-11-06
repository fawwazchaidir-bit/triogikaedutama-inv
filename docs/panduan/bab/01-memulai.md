# Bab 1 — Memulai: Masuk, Keamanan, dan Mengenal Tampilan

> **Peran:** Pelaksana ✔ · Finance Manager ✔ (Finance Manager **wajib** mengaktifkan 2FA)

## 1.1 Masuk ke aplikasi

1. Buka alamat aplikasi di Chrome, Edge, atau Safari.
2. Isi **Email** dan **Password** yang diberikan Administrator, lalu klik **Masuk**.
3. Bila salah 5 kali berturut-turut, akun dikunci sementara 15 menit. Tunggu atau minta bantuan Administrator.

{{fig:login}}

## 1.2 Mengganti password pertama kali

Akun baru memakai **password sementara**. Aplikasi memaksa Anda menggantinya sebelum dapat dipakai.

**Aturan password baru:** minimal 12 karakter, bukan password umum, dan tidak memuat nama atau email Anda. Setelah disimpan, sesi Anda di perangkat lain otomatis berakhir.

{{fig:pw-forced}}

Anda dapat mengganti password kapan saja lewat menu pengguna (pojok kanan atas).

## 1.3 Mengenal kerangka aplikasi

Semua halaman memiliki kerangka yang sama. **Menu yang tampil mengikuti peran Anda**; menu yang tidak ada berarti bukan wewenang peran Anda.

{{fig:shell}}

### Lonceng notifikasi

Berisi antrean pekerjaan sesuai peran, misalnya *invoice menunggu verifikasi* (Finance Manager) atau *invoice dikembalikan* dan *invoice jatuh tempo*. Klik butirnya untuk langsung membuka daftar yang sudah terfilter. **Titik merah** artinya ada yang perlu ditindak.

{{fig:shell-bell}}

### Menu pengguna

{{fig:shell-usermenu}}

### Pencarian global

Ketik minimal 2 karakter lalu tekan Enter. Hasil dikelompokkan per jenis dan hanya memuat data yang boleh Anda lihat.

{{fig:search}}

### Tema terang/gelap

{{fig:theme-dark}}

### Di ponsel

Aplikasi menyesuaikan layar kecil. Menu utama dibuka dari tombol tiga garis.

{{fig:mobile-list}}

{{fig:mobile-menu}}

## 1.4 Autentikasi dua langkah (2FA)

2FA menambah lapisan keamanan: selain password, Anda memasukkan kode 6 digit dari aplikasi autentikator di ponsel (Google Authenticator, Microsoft Authenticator, Aegis, dsb.). **Finance Manager dan Administrator wajib mengaktifkannya**; mereka diarahkan ke halaman ini saat pertama masuk. Pelaksana boleh mengaktifkan secara sukarela.

### Mengaktifkan 2FA

1. Menu pengguna → **Keamanan (2FA)**, klik **Mulai mengaktifkan**.
2. Masukkan password Anda.
3. Pindai kode QR dengan aplikasi autentikator (atau ketik kunci manual), lalu masukkan 6 digit yang tampil.
4. Simpan **10 kode pemulihan**. Kode hanya ditampilkan **sekali**.

{{fig:sec-idle}}

{{fig:sec-password}}

{{fig:sec-qr}}

{{fig:sec-recovery}}

{{fig:sec-active}}

### Masuk dengan 2FA

Setelah password benar, masukkan kode 6 digit dari autentikator **atau** salah satu kode pemulihan (format `XXXXX-XXXXX`; tiap kode hanya sekali pakai).

{{fig:login-2fa}}

### Kode pemulihan habis atau menonaktifkan 2FA

Tindakan sensitif meminta password **dan** satu kode. Buat ulang kode pemulihan bila hampir habis (kode lama hangus). Peran yang diwajibkan tidak dapat mematikan 2FA.

{{fig:sec-regen}}

> **Ponsel hilang?** Masuk dengan kode pemulihan, lalu daftarkan ponsel baru. Bila kode pun hilang, hubungi Administrator untuk mereset 2FA Anda.

## Tips & Kesalahan Umum

- Jangan menyimpan kode pemulihan di ponsel yang sama dengan autentikator; pakai brankas/pengelola password.
- Selalu **Keluar** bila memakai komputer bersama.
- Jam ponsel harus akurat; kode 6 digit bergantung pada waktu.
