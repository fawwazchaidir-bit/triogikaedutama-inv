import { shot, BASE } from "../lib.mjs";

export async function run({ S, F }) {
  const s = S.page, f = F.page;
  const d = (p) => p.locator("dialog[open]");
  // ── Pelaksana ──
  await s.goto(`${BASE}/cash`);
  await s.waitForLoadState("networkidle");
  await shot(s, "cash-overview-staff", { title: "Kas & Bank (Pelaksana)", caption: "Menu Kas & Bank menampilkan saldo tiap akun dan buku kas. Pelaksana dapat mencatat transfer antar akun dan penerimaan lain (menunggu persetujuan), tetapi tidak dapat membalikkan.", fit: true, marks: [
    { at: s.getByRole("button", { name: "Transfer antar akun" }), text: "Memindahkan dana antar kas/bank." },
    { at: s.getByRole("button", { name: /Catat penerimaan lain/ }), text: "Mencatat uang masuk non-invoice (bunga, jasa giro, hibah). Menunggu persetujuan Finance Manager." },
    { at: s.getByText("Total kas & bank"), text: "Total seluruh akun aktif." },
    { at: s.getByRole("link", { name: /Bank Mandiri IDR/ }).first(), text: "Klik kartu akun untuk melihat buku kasnya." },
  ] });
  await s.getByRole("button", { name: "Transfer antar akun" }).click();
  await s.waitForTimeout(300);
  const opts = await d(s).getByLabel(/^Dari akun/).locator("option").allTextContents();
  console.log("akun:", opts.join(" | "));
  await d(s).getByLabel(/^Dari akun/).selectOption({ index: 0 });
  await d(s).getByLabel(/^Ke akun/).selectOption({ index: 1 });
  await d(s).getByLabel(/^Nominal/).fill("2000000");
  await d(s).getByLabel(/^Keterangan/).fill("Isi kas kecil bulan November");
  await shot(s, "cash-transfer", { title: "Formulir transfer antar akun", caption: "Total kas tidak berubah dan laba rugi tidak terpengaruh. Transfer langsung berlaku (tanpa persetujuan).", dialog: true, marks: [
    { at: d(s).getByLabel(/^Tanggal/), text: "Tanggal transfer (tidak boleh melewati hari ini)." },
    { at: d(s).getByLabel(/^Nominal/), text: "Jumlah yang dipindahkan." },
    { at: d(s).getByLabel(/^Dari akun/), text: "Akun sumber dana." },
    { at: d(s).getByLabel(/^Ke akun/), text: "Akun tujuan (harus berbeda dari sumber)." },
    { at: d(s).getByLabel(/^Keterangan/), text: "Catatan opsional." },
    { at: d(s).getByRole("button", { name: "Simpan transfer" }), text: "Simpan." },
  ] });
  await d(s).getByRole("button", { name: "Simpan transfer" }).click();
  await s.waitForTimeout(1000);
  await s.getByRole("button", { name: /Catat penerimaan lain/ }).click();
  await s.waitForTimeout(300);
  await d(s).getByLabel(/^Akun kas\/bank/).selectOption({ index: 1 });
  const cats = await d(s).getByLabel(/^Kategori/).locator("option").allTextContents();
  console.log("kategori:", cats.join(" | "));
  await d(s).getByLabel(/^Kategori/).selectOption({ index: 1 });
  await d(s).getByLabel(/^Nominal/).fill("350000");
  await d(s).getByLabel(/^Pemberi/).fill("Bank Mandiri");
  await d(s).getByLabel(/^Keterangan/).fill("Bunga tabungan Oktober 2026");
  await shot(s, "cash-receipt-staff", { title: "Catat penerimaan lain (Pelaksana)", caption: "Untuk uang masuk yang bukan pembayaran invoice. Kategori terbatas pada akun pendapatan; arah otomatis ‘Masuk’. Entri menunggu persetujuan Finance Manager.", dialog: true, marks: [
    { at: d(s).getByLabel(/^Akun kas\/bank/), text: "Akun tempat uang diterima." },
    { at: d(s).getByLabel(/^Kategori/), text: "Akun pendapatan lain-lain." },
    { at: d(s).getByLabel(/^Nominal/), text: "Jumlah uang masuk." },
    { at: d(s).getByLabel(/^Pemberi/), text: "Pihak pemberi (opsional)." },
    { at: d(s).getByLabel(/^Keterangan/), text: "Uraian wajib diisi." },
  ] });
  await d(s).getByRole("button", { name: "Simpan" }).click();
  await s.waitForTimeout(1000);
  await s.goto(`${BASE}/cash`);
  await s.waitForLoadState("networkidle");
  await shot(s, "cash-after-staff", { title: "Setelah transfer dicatat", caption: "Transfer muncul di ‘Transfer antar akun terbaru’ dan di buku kas kedua akun. Peringatan biru mengingatkan ada entri yang menunggu persetujuan.", fit: true, marks: [
    { at: s.getByText(/menunggu persetujuan/).first(), text: "Pengingat entri yang belum disetujui (belum masuk saldo)." },
    { at: s.getByRole("row", { name: /Isi kas kecil/ }).first(), text: "Transfer yang baru dicatat." },
  ] });

  // ── Finance Manager ──
  await f.goto(`${BASE}/expenses?status=PENDING`);
  await f.waitForLoadState("networkidle");
  await shot(f, "cash-receipt-pending-fm", { title: "Menyetujui penerimaan lain", caption: "Penerimaan lain dari Pelaksana tampil di menu Pengeluaran dengan status Menunggu persetujuan, dan disetujui sama seperti pengeluaran.", fit: true, marks: [
    { at: f.getByRole("row", { name: /Bunga tabungan Oktober/ }), text: "Penerimaan lain yang diajukan Pelaksana." },
    { at: f.getByRole("row", { name: /Bunga tabungan Oktober/ }).getByRole("button", { name: "Setujui" }), text: "Setujui → masuk saldo & laporan." },
  ] });
  await f.getByRole("row", { name: /Bunga tabungan Oktober/ }).getByRole("button", { name: "Setujui" }).click();
  await f.waitForTimeout(300);
  await d(f).getByRole("button", { name: /^Ya, setujui/ }).click();
  await f.waitForTimeout(1000);

  await f.goto(`${BASE}/cash`);
  await f.waitForLoadState("networkidle");
  await shot(f, "cash-overview-fm", { title: "Kas & Bank (Finance Manager)", caption: "Finance Manager memiliki semua aksi Pelaksana ditambah kolom Aksi untuk membalikkan transfer, dan tombol penerimaan/non-operasional yang langsung berlaku.", fit: true, marks: [
    { at: f.getByRole("button", { name: "Transfer antar akun" }), text: "Transfer antar akun." },
    { at: f.getByRole("button", { name: /Catat penerimaan/ }), text: "Penerimaan lain & non-operasional (modal, prive, pinjaman, aset) — langsung berlaku." },
    { at: f.getByRole("columnheader", { name: "AKSI" }), text: "Aksi pembalikan hanya untuk Finance Manager." },
  ] });
  await f.getByRole("button", { name: /Catat penerimaan/ }).click();
  await f.waitForTimeout(300);
  await shot(f, "cash-other-fm", { title: "Catat penerimaan / non-operasional (Finance Manager)", caption: "Kategori mencakup pendapatan lain, modal, prive, pinjaman, dan aset. Arah (Masuk/Keluar) dapat dipilih untuk kategori non-pendapatan; entri langsung berlaku.", dialog: true, marks: [
    { at: d(f).getByLabel(/^Kategori/), text: "Pilih kategori; menentukan arah dan laporan." },
    { at: d(f).getByLabel(/^Arah/), text: "Masuk / Keluar (terkunci untuk pendapatan)." },
  ] });
  await d(f).getByRole("button", { name: "Batal" }).click();
  await f.waitForTimeout(300);

  const acc = f.getByRole("link", { name: /Bank Mandiri IDR/ }).first();
  await acc.click();
  await f.waitForLoadState("networkidle");
  await shot(f, "cash-ledger", { title: "Buku kas per akun", caption: "Klik kartu akun untuk melihat buku kasnya: saldo awal periode, setiap mutasi (pembayaran invoice, pengeluaran, penerimaan, transfer), saldo berjalan, dan saldo akhir.", fit: true, marks: [
    { at: f.getByLabel(/^Dari tanggal/), text: "Ubah periode buku kas." },
    { at: f.getByText("Saldo awal periode"), text: "Saldo awal periode." },
    { at: f.getByText("Saldo akhir periode"), text: "Saldo akhir periode (sama dengan saldo di kartu bila sampai hari ini)." },
  ] });
  await f.goto(`${BASE}/cash`);
  await f.waitForLoadState("networkidle");
  await f.getByRole("row", { name: /Isi kas kecil/ }).getByRole("button", { name: "Balikkan" }).first().click();
  await f.waitForTimeout(300);
  await d(f).getByLabel(/^Alasan pembalikan/).fill("Salah akun tujuan; transfer diulang ke akun yang benar.");
  await shot(f, "cash-transfer-reverse", { title: "Membalikkan transfer", caption: "Transfer tidak dapat diedit/dihapus. Koreksi dengan pembalikan: dibuat transfer pembalik bertanggal hari ini, transfer asli tetap tercatat.", dialog: true, marks: [
    { at: d(f).getByLabel(/^Alasan pembalikan/), text: "Alasan wajib." },
    { at: d(f).getByRole("button", { name: "Balikkan transfer" }), text: "Konfirmasi." },
  ] });
  await d(f).getByRole("button", { name: "Balikkan transfer" }).click();
  await f.waitForTimeout(1000);
  await f.waitForLoadState("networkidle");
  await shot(f, "cash-transfer-reversed", { title: "Transfer setelah dibalikkan", caption: "Transfer asli berstatus ‘Sudah dibalik’; baris pembalik berlatar merah muda berstatus ‘Pembalikan’ lengkap dengan alasan.", fit: true, marks: [
    { at: f.getByText("Sudah dibalik").first(), text: "Transfer asli." },
    { at: f.getByText("Pembalikan", { exact: true }).first(), text: "Baris pembalik." },
  ] });
}
