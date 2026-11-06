import { shot, BASE } from "../lib.mjs";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

export async function run({ S, F }) {
  const s = S.page, f = F.page;
  const d = (p) => p.locator("dialog[open]");
  await s.goto(`${BASE}/expenses`);
  await s.waitForLoadState("networkidle");
  await shot(s, "exp-list", { title: "Daftar pengeluaran (Pelaksana)", caption: "Menu Pengeluaran. Pelaksana mengajukan pengeluaran; Finance Manager menyetujui. Pelaksana hanya melihat pengeluaran yang ia catat sendiri.", fit: true, marks: [
    { at: s.getByRole("button", { name: "Catat pengeluaran" }), text: "Mencatat pengeluaran baru." },
    { at: s.getByLabel(/^Status/), text: "Saring: Menunggu persetujuan, Berlaku, Ditolak." },
    { at: s.getByLabel(/^Jenis/), text: "Pengeluaran atau Penerimaan lain / non-operasional." },
    { at: s.getByRole("columnheader", { name: "STATUS" }), text: "Hanya entri berstatus Berlaku yang masuk saldo dan laporan." },
    { at: s.getByRole("button", { name: "Batalkan" }).first(), text: "Pelaksana dapat membatalkan pengajuannya sendiri selama masih menunggu persetujuan." },
  ] });
  await s.getByRole("button", { name: "Catat pengeluaran" }).click();
  await s.waitForTimeout(300);
  await d(s).getByLabel(/^Dibayar dari/).selectOption({ label: "Bank Mandiri IDR" });
  await d(s).getByLabel(/^Kategori/).selectOption({ label: "5-1400 — Konsumsi & Akomodasi Kegiatan" });
  await d(s).getByLabel(/^Nominal/).fill("1500000");
  await d(s).getByLabel(/^Penerima/).fill("Katering Bu Sri");
  await d(s).getByLabel(/^No\. bukti/).fill("NOTA-0457");
  await d(s).getByLabel(/^Keterangan/).fill("Konsumsi pelatihan Barista angkatan 3");
  await d(s).getByRole("button", { name: "Simpan" }).click();
  await d(s).getByText(/wajib/i).first().waitFor();
  await shot(s, "exp-proof-required", { title: "Bukti wajib untuk pengeluaran di atas Rp1 juta", caption: "Pengeluaran lebih dari Rp1.000.000 tidak dapat disimpan tanpa bukti (nota/kuitansi). Di bawah itu bukti opsional tetapi dianjurkan.", dialog: true, marks: [{ at: d(s).getByText(/wajib/i).first(), text: "Pesan: bukti wajib." }] });
  await d(s).locator('input[type="file"]').setInputFiles({ name: "nota-katering-0457.pdf", mimeType: "application/pdf", buffer: PDF });
  await s.waitForTimeout(300);
  await shot(s, "exp-new", { title: "Formulir pengeluaran", caption: "Isi semua kolom bertanda *, lampirkan bukti, lalu simpan.", dialog: true, marks: [
    { at: d(s).getByLabel(/^Dibayar dari/), text: "Akun kas/bank yang membayar." },
    { at: d(s).getByLabel(/^Kategori/), text: "Kategori biaya (menentukan posisi di laporan laba rugi). Pilih yang paling sesuai." },
    { at: d(s).getByLabel(/^Nominal/), text: "Jumlah uang keluar." },
    { at: d(s).getByLabel(/^Penerima/), text: "Penerima/pemasok (opsional, membantu pelacakan)." },
    { at: d(s).getByLabel(/^No\. bukti/), text: "Nomor nota/kuitansi." },
    { at: d(s).locator('input[type="file"]'), text: "Unggah bukti (PDF/JPG/PNG)." },
    { at: d(s).getByRole("button", { name: "Simpan" }), text: "Simpan → status “Menunggu persetujuan”. Belum mengurangi saldo sampai disetujui." },
  ] });
  await d(s).getByRole("button", { name: "Simpan" }).click();
  await s.getByText("Konsumsi pelatihan Barista angkatan 3").first().waitFor();
  await s.waitForLoadState("networkidle");
  await shot(s, "exp-pending", { title: "Pengeluaran menunggu persetujuan", caption: "Entri tersimpan berstatus “Menunggu persetujuan”. Finance Manager menerima pemberitahuan di lonceng.", fit: true, marks: [{ at: s.getByRole("row", { name: /Konsumsi pelatihan Barista angkatan 3/ }), text: "Pengeluaran yang baru diajukan." }] });

  // ── Finance Manager ──
  await f.goto(`${BASE}/expenses?status=PENDING`);
  await f.waitForLoadState("networkidle");
  await shot(f, "exp-list-fm", { title: "Daftar pengeluaran (Finance Manager)", caption: "Finance Manager melihat seluruh pengeluaran. Pengajuan yang menunggu muncul di atas bersama tombol Setujui / Tolak.", fit: true, marks: [
    { at: f.getByText(/menunggu persetujuan/).first(), text: "Pengingat jumlah pengajuan yang menunggu." },
    { at: f.getByRole("button", { name: "Setujui" }).first(), text: "Setujui: entri menjadi Berlaku (masuk saldo & laporan)." },
    { at: f.getByRole("button", { name: "Tolak" }).first(), text: "Tolak dengan alasan (tidak pernah masuk saldo/laporan)." },
  ] });
  await f.getByRole("row", { name: /Konsumsi pelatihan Barista angkatan 3/ }).getByRole("button", { name: "Setujui" }).click();
  await f.waitForTimeout(300);
  await shot(f, "exp-approve-dialog", { title: "Menyetujui pengeluaran", caption: "Periksa nominal, kategori, dan bukti sebelum menyetujui. Pencatat tidak dapat menyetujui pengeluarannya sendiri.", dialog: true, marks: [{ at: d(f).getByRole("button", { name: "Ya, setujui" }), text: "Setujui." }] });
  await d(f).getByRole("button", { name: "Ya, setujui" }).click();
  await f.waitForTimeout(800);
  await f.goto(`${BASE}/expenses?status=PENDING`);
  await f.getByRole("row", { name: /Konsumsi peserta pelatihan Barista/ }).getByRole("button", { name: "Tolak" }).click();
  await f.waitForTimeout(300);
  await d(f).getByLabel(/^Alasan penolakan/).fill("Nota tidak terbaca. Mohon unggah ulang foto yang jelas.");
  await shot(f, "exp-reject-dialog", { title: "Menolak pengeluaran", caption: "Alasan wajib dan terlihat oleh pencatat. Pencatat dapat mencatat ulang dengan perbaikan.", dialog: true, marks: [
    { at: d(f).getByLabel(/^Alasan penolakan/), text: "Alasan penolakan." },
    { at: d(f).getByRole("button", { name: "Tolak pengeluaran" }), text: "Tolak." },
  ] });
  await d(f).getByRole("button", { name: "Tolak pengeluaran" }).click();
  await f.waitForTimeout(800);
  await f.goto(`${BASE}/expenses`);
  await f.waitForLoadState("networkidle");
  await f.getByRole("row", { name: /ATK & fotokopi/ }).getByRole("button", { name: "Balikkan" }).click();
  await f.waitForTimeout(300);
  await d(f).getByLabel(/^Alasan pembalikan/).fill("Nota ATK ganda tercatat dua kali.");
  await shot(f, "exp-reverse-dialog", { title: "Membalikkan pengeluaran yang sudah berlaku", caption: "Pengeluaran yang sudah Berlaku tidak dapat diedit/dihapus. Koreksi dengan pembalikan: dibuat baris pembalik bertanggal hari ini, entri asli tetap tampil.", dialog: true, marks: [
    { at: d(f).getByLabel(/^Alasan pembalikan/), text: "Alasan wajib." },
    { at: d(f).getByRole("button", { name: "Balikkan entri" }), text: "Konfirmasi pembalikan." },
  ] });
  await d(f).getByRole("button", { name: "Balikkan entri" }).click();
  await f.waitForTimeout(800);
  await f.goto(`${BASE}/expenses`);
  await f.waitForLoadState("networkidle");
  await shot(f, "exp-list-after", { title: "Daftar setelah persetujuan, penolakan, dan pembalikan", caption: "Status tiap entri: Berlaku, Ditolak (beserta alasan), dan baris pembalik.", fit: true });
}
