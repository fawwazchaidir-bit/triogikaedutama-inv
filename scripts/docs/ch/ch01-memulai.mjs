import { shot, login, totp, BASE, PASSWORD, W } from "../lib.mjs";

export async function run({ A, F, S, mk }) {
  const ORIGIN = { Origin: BASE };
  // ── Halaman masuk ──
  const T = await mk("tamu");
  await T.page.goto(`${BASE}/login`);
  await shot(T.page, "login", {
    title: "Halaman masuk", caption: "Alamat aplikasi dibuka di peramban (Chrome/Edge/Safari). Tombol bulan/matahari di kanan atas mengganti tema terang/gelap.",
    marks: [
      { at: T.page.getByLabel("Email"), text: "Email akun Anda (diberikan Administrator)." },
      { at: T.page.getByLabel("Password"), text: "Password. Ikon mata di ujung kanan menampilkan/menyembunyikan isian." },
      { at: T.page.getByRole("button", { name: "Masuk" }), text: "Klik Masuk. Setelah 5 kali salah, akun dikunci sementara 15 menit." },
      { at: T.page.getByTestId("theme-toggle"), text: "Ganti tema terang/gelap (pilihan diingat di perangkat ini)." },
    ],
  });

  // ── Login pertama: wajib ganti password (akun baru dibuat Administrator) ──
  const mail = "pelaksana.baru@trilogika.test";
  const r = await A.page.request.post(`${BASE}/api/users`, { headers: ORIGIN, data: { email: mail, name: "Pelaksana Baru", role: "STAFF", password: "Awal-Sementara-7391!" } });
  if (!r.ok() && r.status() !== 409) throw new Error(`gagal membuat akun contoh: ${r.status()} ${await r.text()}`);
  await T.page.goto(`${BASE}/login`);
  await T.page.getByLabel("Email").fill(mail);
  await T.page.getByLabel("Password").fill("Awal-Sementara-7391!");
  await T.page.getByRole("button", { name: "Masuk" }).click();
  await T.page.waitForURL(/change-password/);
  await shot(T.page, "pw-forced", {
    title: "Ganti password saat masuk pertama kali", caption: "Akun baru memakai password sementara dari Administrator. Aplikasi memaksa Anda menggantinya sebelum bisa dipakai.",
    marks: [
      { at: T.page.getByLabel("Password saat ini"), text: "Isi password sementara dari Administrator." },
      { at: T.page.getByLabel(/^Password baru/), text: "Password baru: minimal 12 karakter, bukan password umum, tidak memuat nama/email Anda." },
      { at: T.page.getByLabel(/^Ulangi password baru/), text: "Ketik ulang password baru yang sama." },
      { at: T.page.getByRole("button", { name: "Simpan" }), text: "Simpan. Sesi Anda di perangkat lain otomatis berakhir." },
    ],
  });
  await T.ctx.close();

  // ── Kerangka aplikasi (Finance Manager) ──
  const f = F.page;
  await f.goto(`${BASE}/dashboard`);
  await f.waitForLoadState("networkidle");
  await shot(f, "shell", {
    title: "Kerangka aplikasi", caption: "Semua halaman memakai kerangka yang sama. Menu yang tampil mengikuti peran Anda.",
    marks: [
      { at: f.locator("header a").first(), text: "Merek & nama aplikasi (klik untuk ke halaman awal)." },
      { at: f.getByRole("search"), text: "Pencarian global: invoice, pelanggan, pembayaran, entri kas." },
      { at: f.getByTestId("bell"), text: "Lonceng: daftar pekerjaan yang menunggu Anda. Titik merah = ada yang perlu ditindak." },
      { at: f.getByTestId("theme-toggle"), text: "Tema terang/gelap." },
      { at: f.getByTestId("user-menu"), text: "Menu pengguna: identitas, ganti password, Keamanan (2FA), Keluar." },
      { at: f.getByRole("navigation", { name: "Menu utama" }), text: "Menu utama (sidebar). Item yang tidak tampil berarti tidak termasuk wewenang peran Anda." },
    ],
  });
  await f.getByTestId("bell").click();
  await f.waitForTimeout(200);
  await shot(f, "shell-bell", {
    title: "Lonceng notifikasi", caption: "Berisi antrean pekerjaan sesuai peran (mis. invoice menunggu verifikasi, pengeluaran menunggu persetujuan, invoice jatuh tempo). Klik butir untuk langsung ke daftar yang sudah terfilter.",
    marks: [{ at: f.getByRole("menu", { name: "Notifikasi" }), text: "Setiap baris = satu jenis pekerjaan beserta jumlahnya; klik untuk membukanya." }],
  });
  await f.keyboard.press("Escape");
  await f.getByTestId("user-menu").click();
  await f.waitForTimeout(200);
  await shot(f, "shell-usermenu", {
    title: "Menu pengguna", caption: "Dibuka dengan mengklik nama lembaga di kanan atas.",
    marks: [
      { at: f.getByRole("menu", { name: "Menu pengguna" }).getByText("Finance Manager"), text: "Nama, email, dan peran Anda." },
      { at: f.getByRole("menuitem", { name: "Password" }), text: "Ganti password kapan saja." },
      { at: f.getByRole("menuitem", { name: "Keamanan (2FA)" }), text: "Aktifkan/kelola autentikasi dua langkah." },
      { at: f.getByRole("menuitem", { name: "Keluar" }), text: "Keluar dari aplikasi (selalu lakukan di komputer bersama)." },
    ],
  });
  await f.keyboard.press("Escape");

  // ── Pencarian ──
  await f.goto(`${BASE}/search?q=bima`);
  await shot(f, "search", {
    title: "Hasil pencarian global", caption: "Ketik minimal 2 karakter di kotak cari (atas) lalu tekan Enter. Hasil dikelompokkan per jenis dan hanya menampilkan yang boleh Anda lihat.",
    fit: true,
    marks: [
      { at: f.getByRole("searchbox", { name: "Kata kunci" }), text: "Kata kunci: nomor invoice, nama pelanggan, referensi transfer, keterangan kas." },
      { at: f.getByRole("heading", { name: /^Invoice \(/ }), text: "Tiap bagian menunjukkan jumlah hasil; klik baris untuk membuka dokumennya." },
      { at: f.getByRole("link", { name: /Lihat semua/ }), text: "\"Lihat semua\" muncul bila hasil lebih banyak dari yang ditampilkan." },
    ].filter(Boolean).slice(0, 2),
  });

  // ── Tema gelap ──
  await f.goto(`${BASE}/invoices`);
  await f.getByTestId("theme-toggle").click();
  await f.waitForTimeout(300);
  await shot(f, "theme-dark", { title: "Tema gelap", caption: "Nyaman untuk bekerja malam hari. Pilihan tema tersimpan di perangkat Anda dan tidak memengaruhi PDF/Excel.", marks: [{ at: f.getByTestId("theme-toggle"), text: "Klik lagi untuk kembali ke tema terang." }] });
  await f.getByTestId("theme-toggle").click();
  await f.waitForTimeout(200);

  // ── Ponsel ──
  const M = await S.ctx.newPage();
  await M.setViewportSize({ width: 390, height: 844 });
  await M.goto(`${BASE}/invoices`);
  await M.waitForLoadState("networkidle");
  await shot(M, "mobile-list", { title: "Tampilan di ponsel", caption: "Aplikasi menyesuaikan layar kecil. Menu utama berada di tombol tiga garis.", w: 390, h: 844, marks: [
    { at: M.getByRole("button", { name: "Buka menu" }), text: "Buka menu utama." },
    { at: M.getByRole("link", { name: "Cari" }), text: "Pencarian." },
  ] });
  await M.getByRole("button", { name: "Buka menu" }).click();
  await M.waitForTimeout(250);
  await shot(M, "mobile-menu", { title: "Menu di ponsel", caption: "Pilih halaman dari laci menu; tutup dengan tanda silang atau mengetuk area gelap.", w: 390, h: 844, marks: [{ at: M.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Invoice" }), text: "Ketuk untuk berpindah halaman." }] });
  await M.close();

  // ── Keamanan: 2FA (Finance Manager) ──
  await f.goto(`${BASE}/security`);
  await shot(f, "sec-idle", { title: "Keamanan akun — sebelum 2FA aktif", caption: "Dibuka dari menu pengguna → Keamanan (2FA). Peran yang diwajibkan (mis. Finance Manager & Administrator) akan diarahkan ke sini saat pertama masuk.", marks: [
    { at: f.getByText("Belum diaktifkan"), text: "Status saat ini." },
    { at: f.getByRole("button", { name: "Aktifkan 2FA" }), text: "Mulai mengaktifkan." },
  ] });
  await f.getByRole("button", { name: "Aktifkan 2FA" }).click();
  await shot(f, "sec-password", { title: "Konfirmasi password", caption: "Demi keamanan, aplikasi meminta password lagi sebelum membuat kunci 2FA.", marks: [
    { at: f.getByLabel("Password"), text: "Masukkan password akun Anda." },
    { at: f.getByRole("button", { name: "Lanjut" }), text: "Lanjut ke kode QR." },
  ] });
  await f.getByLabel("Password").fill(PASSWORD);
  await f.getByRole("button", { name: "Lanjut" }).click();
  await f.getByTestId("totp-qr").waitFor();
  const secret = ((await f.getByTestId("totp-secret").textContent()) ?? "").replace(/\s/g, "");
  await shot(f, "sec-qr", { title: "Pindai kode QR", caption: "Buka aplikasi autentikator di ponsel (Google Authenticator, Microsoft Authenticator, Aegis, dll.) → tambah akun → pindai kode ini.", fit: true, marks: [
    { at: f.getByTestId("totp-qr"), text: "Kode QR untuk dipindai aplikasi autentikator." },
    { at: f.getByTestId("totp-secret"), text: "Tidak bisa memindai? Ketik kunci ini secara manual di aplikasi." },
    { at: f.getByLabel("Kode 6 digit"), text: "Masukkan 6 digit yang tampil di aplikasi (berganti tiap 30 detik)." },
    { at: f.getByRole("button", { name: "Aktifkan", exact: true }), text: "Aktifkan 2FA." },
  ] });
  await f.getByLabel("Kode 6 digit").fill(totp(secret));
  await f.getByRole("button", { name: "Aktifkan", exact: true }).click();
  await f.getByTestId("recovery-codes").waitFor();
  await shot(f, "sec-recovery", { title: "Simpan kode pemulihan", caption: "10 kode sekali pakai untuk masuk bila ponsel hilang/rusak. Ditampilkan SEKALI saja.", fit: true, marks: [
    { at: f.getByTestId("recovery-codes"), text: "Sepuluh kode pemulihan. Setiap kode hanya berlaku sekali." },
    { at: f.getByRole("button", { name: "Salin" }), text: "Salin ke papan klip, atau Unduh .txt." },
    { at: f.getByLabel("Saya sudah menyimpan kode ini di tempat aman."), text: "Centang setelah kode tersimpan di tempat aman (brankas/pengelola password — bukan di ponsel yang sama)." },
    { at: f.getByRole("button", { name: "Selesai" }), text: "Selesai (baru aktif setelah dicentang)." },
  ] });
  const recovery = await f.getByTestId("recovery-codes").locator("li").allTextContents();
  await f.getByLabel("Saya sudah menyimpan kode ini di tempat aman.").check();
  await f.getByRole("button", { name: "Selesai" }).click();
  await f.getByRole("button", { name: "Nonaktifkan 2FA" }).waitFor();
  await shot(f, "sec-active", { title: "Keamanan akun — 2FA aktif", caption: "Status memuat tanggal aktif dan sisa kode pemulihan.", marks: [
    { at: f.getByText(/Aktif sejak/), text: "Status, tanggal aktif, dan sisa kode pemulihan." },
    { at: f.getByRole("button", { name: "Buat ulang kode pemulihan" }), text: "Buat 10 kode baru (yang lama hangus) — lakukan bila kode hampir habis." },
    { at: f.getByRole("button", { name: "Nonaktifkan 2FA" }), text: "Mematikan 2FA (tidak tersedia untuk peran yang diwajibkan)." },
  ] });

  // Login dua langkah (konteks tamu)
  const T2 = await mk("tamu2");
  await T2.page.goto(`${BASE}/login`);
  await T2.page.getByLabel("Email").fill("finance@trilogika.test");
  await T2.page.getByLabel("Password").fill(PASSWORD);
  await T2.page.getByRole("button", { name: "Masuk" }).click();
  await T2.page.getByLabel("Kode verifikasi").waitFor();
  await shot(T2.page, "login-2fa", { title: "Masuk dengan 2FA (langkah 2)", caption: "Setelah password benar, aplikasi meminta kode dari aplikasi autentikator. Tanpa kode, tidak ada sesi yang dibuat.", marks: [
    { at: T2.page.getByLabel("Kode verifikasi"), text: "Kode 6 digit dari aplikasi autentikator, ATAU salah satu kode pemulihan (format XXXXX-XXXXX)." },
    { at: T2.page.getByRole("button", { name: "Verifikasi" }), text: "Verifikasi untuk masuk." },
    { at: T2.page.getByRole("button", { name: "Kembali" }), text: "Kembali ke langkah 1 (mis. salah akun)." },
  ] });
  await T2.ctx.close();

  // Matikan lagi agar bab berikutnya berjalan normal (memakai kode pemulihan: kode TOTP langkah kini sudah terpakai)
  await f.getByRole("button", { name: "Buat ulang kode pemulihan" }).click();
  await f.getByLabel("Password").fill(PASSWORD);
  await f.getByLabel("Kode 6 digit (atau kode pemulihan)").fill(recovery[0]);
  await shot(f, "sec-regen", { title: "Buat ulang kode pemulihan / nonaktifkan", caption: "Tindakan sensitif selalu meminta password dan satu kode (dari autentikator atau salah satu kode pemulihan).", marks: [
    { at: f.getByLabel("Password"), text: "Password akun." },
    { at: f.getByLabel("Kode 6 digit (atau kode pemulihan)"), text: "Kode autentikator atau kode pemulihan." },
  ] });
  await f.getByRole("button", { name: "Batal" }).click();
  await f.getByRole("button", { name: "Nonaktifkan 2FA" }).click();
  await f.getByLabel("Password").fill(PASSWORD);
  await f.getByLabel("Kode 6 digit (atau kode pemulihan)").fill(recovery[1]);
  await f.getByRole("button", { name: "Nonaktifkan", exact: true }).click();
  await f.getByText("Belum diaktifkan").waitFor();
  await f.goto(`${BASE}/dashboard`);
}
