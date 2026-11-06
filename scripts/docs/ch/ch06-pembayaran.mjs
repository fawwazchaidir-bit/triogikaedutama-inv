import { shot, pdfShot, BASE } from "../lib.mjs";
import { writeFileSync } from "node:fs";
import path from "node:path";

const TMP = "/tmp/claude-0/-home-user-triogikaedutama/6b6e38d7-3bfa-5d64-87be-6b4b3772d943/scratchpad";

export async function run({ S, F }) {
  const s = S.page, f = F.page;
  const d = (p) => p.locator("dialog[open]");
  // Cari invoice baru milik PT Cahaya Boga
  await s.goto(`${BASE}/invoices?q=Cahaya`);
  await s.getByRole("link", { name: /^0044/ }).first().click();
  await s.waitForURL(/\/invoices\/[0-9a-f-]{36}$/);
  const invUrl = s.url();

  // ── Pembayaran pertama (sebagian) ──
  await s.getByRole("button", { name: "Catat pembayaran" }).click();
  await s.waitForTimeout(300);
  await d(s).getByLabel(/^Nominal/).fill("5000000");
  await d(s).getByLabel(/^Referensi transfer/).fill("TRX-2026-0501");
  await d(s).getByLabel(/^Catatan/).fill("Pembayaran termin 1");
  await shot(s, "pay-dialog", {
    title: "Mencatat pembayaran", caption: "Dari halaman invoice terbit → Catat pembayaran. Satu invoice dapat dibayar bertahap (DP, termin, pelunasan).", dialog: true,
    marks: [
      { at: d(s).getByLabel(/^Tanggal pembayaran/), text: "Tanggal uang diterima (bukan tanggal pencatatan)." },
      { at: d(s).getByLabel(/^Nominal/), text: "Jumlah yang diterima. Tidak boleh melebihi sisa tagihan." },
      { at: d(s).getByLabel(/^Metode/), text: "Transfer, Tunai, QRIS, Virtual Account, Cek/Giro, atau Lainnya." },
      { at: d(s).getByLabel(/^Diterima di/), text: "Akun kas/bank penerima. “Otomatis” = bank default untuk Transfer/QRIS/VA, kas untuk Tunai." },
      { at: d(s).getByLabel(/^PPh dipotong pelanggan/), text: "Isi bila pelanggan memotong PPh (mis. PPh 23) — lihat contoh berikutnya." },
      { at: d(s).getByLabel(/^Referensi transfer/), text: "Nomor referensi transfer/bukti — mempermudah pencocokan dengan rekening koran." },
      { at: d(s).getByLabel(/^Bukti pembayaran/), text: "Unggah bukti transfer (PDF/JPG/PNG, opsional)." },
      { at: d(s).getByRole("button", { name: "Simpan pembayaran" }), text: "Simpan. Pembayaran tidak dapat diubah/dihapus; koreksi hanya lewat pembalikan oleh Finance Manager." },
    ],
  });
  await d(s).getByRole("button", { name: "Simpan pembayaran" }).click();
  await s.getByText("Dibayar Sebagian").first().waitFor();
  await s.waitForLoadState("networkidle");
  await shot(s, "pay-recorded", { title: "Setelah pembayaran dicatat", caption: "Status pembayaran berubah otomatis (Belum Dibayar → Dibayar Sebagian → Lunas). Pembayaran masuk ke buku kas akun yang dipilih.", fit: true, marks: [
    { at: s.getByText("Dibayar Sebagian").first(), text: "Status pembayaran." },
    { at: s.locator("section").filter({ has: s.getByRole("heading", { name: "Pembayaran" }) }), text: "Daftar pembayaran (termasuk DP) beserta pencatatnya." },
    { at: s.getByText("Sisa tagihan").first(), text: "Sisa tagihan terkini." },
  ] });

  // ── Pembayaran dengan PPh dipotong pelanggan ──
  await s.getByRole("button", { name: "Catat pembayaran" }).click();
  await s.waitForTimeout(300);
  await d(s).getByLabel(/^Nominal/).fill("7000000");
  await d(s).getByLabel(/^PPh dipotong pelanggan/).fill("150000");
  await d(s).getByLabel(/^Referensi transfer/).fill("TRX-2026-0522");
  await s.waitForTimeout(300);
  await shot(s, "pay-pph", { title: "Pembayaran dengan PPh dipotong pelanggan", caption: "Bila pelanggan (mis. instansi) memotong PPh 23, uang yang masuk lebih kecil dari tagihan. Isi nominal uang yang DITERIMA dan PPh yang dipotong — keduanya mengurangi sisa tagihan.", dialog: true, marks: [
    { at: d(s).getByLabel(/^Nominal/), text: "Uang yang benar-benar masuk ke rekening." },
    { at: d(s).getByLabel(/^PPh dipotong pelanggan/), text: "PPh yang dipotong pelanggan (menjadi kredit pajak lembaga). Nomor bukti potong dapat diisi kemudian di menu Pajak." },
  ] });
  await d(s).getByRole("button", { name: "Simpan pembayaran" }).click();
  await s.waitForLoadState("networkidle");
  await s.waitForTimeout(500);

  // ── Pembayaran melebihi sisa (ditolak) lalu pelunasan tunai ──
  await s.getByRole("button", { name: "Catat pembayaran" }).click();
  await s.waitForTimeout(300);
  await d(s).getByLabel(/^Nominal/).fill("99999999");
  await d(s).getByRole("button", { name: "Simpan pembayaran" }).click();
  await d(s).getByText(/melebihi sisa tagihan/).first().waitFor();
  await shot(s, "pay-over", { title: "Pembayaran melebihi sisa tagihan ditolak", caption: "Aplikasi menolak nominal di atas sisa tagihan dan menyebutkan sisa yang benar.", dialog: true, marks: [{ at: d(s).getByText(/melebihi sisa tagihan/).first(), text: "Pesan kesalahan memuat sisa tagihan yang boleh dibayar." }] });
  await d(s).getByLabel(/^Nominal/).fill("3500000");
  await d(s).getByLabel(/^Metode/).selectOption({ label: "Tunai" });
  await d(s).getByLabel(/^Diterima di/).selectOption({ label: "Kas Kecil" });
  await d(s).getByLabel(/^Catatan/).fill("Pelunasan tunai");
  await d(s).getByRole("button", { name: "Simpan pembayaran" }).click();
  await s.getByText("Lunas").first().waitFor();
  await s.waitForLoadState("networkidle");
  await shot(s, "pay-paid", { title: "Invoice lunas", caption: "Sisa tagihan nol → status Lunas. PDF-nya otomatis berjudul KWITANSI.", fit: true, marks: [
    { at: s.getByText("Lunas").first(), text: "Status Lunas." },
    { at: s.getByRole("link", { name: /^Unduh/ }), text: "Unduh PDF (kini berupa kwitansi)." },
  ] });
  const id = invUrl.split("/").pop();
  const pdf = await s.request.get(`${BASE}/api/invoices/${id}/pdf`);
  writeFileSync(path.join(TMP, "kwitansi.pdf"), await pdf.body());
  pdfShot(path.join(TMP, "kwitansi.pdf"), "inv-pdf-kwitansi", { title: "Kwitansi (invoice lunas)", caption: "Invoice yang sudah lunas otomatis berjudul KWITANSI, bertanda LUNAS beserta tanggal pelunasan. Nomor dan isinya tetap sama." });

  // ── Halaman Pembayaran (daftar) ──
  await s.goto(`${BASE}/payments`);
  await s.waitForLoadState("networkidle");
  await shot(s, "pay-list", { title: "Daftar pembayaran", caption: "Menu Pembayaran: seluruh pembayaran dan pembalikan. Dipakai untuk mencocokkan dengan rekening koran.", fit: true, marks: [
    { at: s.getByRole("button", { name: "Catat pembayaran" }), text: "Catat pembayaran: pilih invoice terbit lalu isi formulir yang sama." },
    { at: s.getByLabel(/^Invoice \/ pelanggan/), text: "Cari nomor invoice, pelanggan, atau referensi transfer." },
    { at: s.getByLabel(/^Jenis/), text: "Tampilkan Pembayaran saja atau Pembalikan saja." },
    { at: s.getByRole("columnheader", { name: "DITERIMA DI" }), text: "Akun kas/bank penerima." },
    { at: s.getByRole("columnheader", { name: "PPH DIPOTONG" }), text: "PPh yang dipotong pelanggan pada pembayaran itu." },
  ] });
  await s.getByRole("button", { name: "Catat pembayaran" }).click();
  await s.waitForTimeout(300);
  await shot(s, "pay-pick", { title: "Memilih invoice untuk dibayar", caption: "Dari halaman Pembayaran, cari invoice terbit yang masih punya sisa tagihan.", dialog: true, marks: [{ at: d(s).locator("input").first(), text: "Ketik nomor atau nama pelanggan lalu pilih invoice." }] });
  await s.keyboard.press("Escape");

  // ── Pembalikan (Finance Manager) ──
  await f.goto(`${BASE}/payments?q=TRX-0004`);
  await f.waitForLoadState("networkidle");
  await f.getByRole("button", { name: "Balikkan" }).first().click();
  await f.waitForTimeout(300);
  await d(f).getByLabel(/^Alasan pembalikan/).fill("Salah catat: transfer ini ternyata milik pelanggan lain.");
  await shot(f, "pay-reverse-dialog", { title: "Membalikkan pembayaran (Finance Manager)", caption: "Pembayaran tidak dapat diedit atau dihapus. Kesalahan dikoreksi dengan pembalikan — baris pembalik bernilai negatif, baris asli tetap terlihat.", dialog: true, marks: [
    { at: d(f).getByLabel(/^Alasan pembalikan/), text: "Alasan wajib dan tercatat di audit." },
    { at: d(f).getByRole("button", { name: "Balikkan pembayaran" }), text: "Konfirmasi. Saldo invoice dan kas/bank dikoreksi otomatis." },
  ] });
  await d(f).getByRole("button", { name: "Balikkan pembayaran" }).click();
  await f.waitForTimeout(800);
  await f.goto(`${BASE}/payments?type=REVERSAL`);
  await f.waitForLoadState("networkidle");
  await shot(f, "pay-reversed", { title: "Hasil pembalikan", caption: "Baris Pembalikan (nominal negatif) muncul di daftar bersama alasannya; status invoice kembali menyesuaikan.", fit: true, marks: [{ at: f.getByRole("row", { name: /Pembalikan/ }).first(), text: "Baris pembalik." }] });
}
