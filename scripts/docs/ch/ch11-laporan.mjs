import { shot, BASE } from "../lib.mjs";

export async function run({ S, F }) {
  const s = S.page, f = F.page;
  await s.goto(`${BASE}/reports`);
  await s.waitForLoadState("networkidle");
  await shot(s, "rpt-invoices", { title: "Laporan operasional: Daftar Invoice", caption: "Menu Laporan tersedia untuk Pelaksana dan Finance Manager. Pilih jenis laporan di baris lencana, atur periode dan pelanggan, lalu ekspor CSV/Excel.", fit: true, marks: [
    { at: s.getByText("Penerbitan invoice", { exact: true }), text: "Kelompok laporan: penerbitan invoice, penerimaan kas, piutang." },
    { at: s.getByRole("link", { name: "Daftar Invoice" }), text: "Jenis laporan aktif (warna marun)." },
    { at: s.getByLabel(/^Dari tanggal/), text: "Periode laporan (bawaan: 1 Januari s.d. hari ini)." },
    { at: s.getByLabel(/^Pelanggan/), text: "Saring per pelanggan." },
    { at: s.getByRole("link", { name: "CSV" }), text: "Ekspor CSV." },
    { at: s.getByRole("link", { name: "Excel" }), text: "Ekspor Excel (.xlsx)." },
  ] });
  await s.goto(`${BASE}/reports?type=receivables`);
  await s.waitForLoadState("networkidle");
  await shot(s, "rpt-receivables", { title: "Laporan: Daftar Piutang", caption: "Invoice terbit dengan sisa tagihan > 0 per hari ini, beserta umur piutang. Laporan piutang selalu ‘per hari ini’, sehingga tidak memiliki filter tanggal.", fit: true, marks: [
    { at: s.getByRole("link", { name: "Daftar Piutang" }), text: "Jenis laporan: piutang." },
    { at: s.getByRole("link", { name: "Invoice Jatuh Tempo" }), text: "Hanya yang sudah melewati jatuh tempo." },
  ] });
  await f.goto(`${BASE}/reports?type=monthly`);
  await f.waitForLoadState("networkidle");
  await shot(f, "rpt-monthly", { title: "Laporan: Rekap Bulanan & Tahunan", caption: "Membandingkan nilai invoice terbit dengan penerimaan kas per bulan. Dua angka ini berbeda dan tidak boleh dijumlahkan.", fit: true, marks: [
    { at: f.getByRole("link", { name: "Rekap Bulanan & Tahunan" }), text: "Jenis laporan." },
    { at: f.getByText(/BUKAN laporan akuntansi/), text: "Catatan: laporan ini operasional, bukan laporan keuangan akuntansi." },
  ] });
  await f.goto(`${BASE}/reports?type=payments`);
  await f.waitForLoadState("networkidle");
  await shot(f, "rpt-payments", { title: "Laporan: Rekap Pembayaran Masuk", caption: "Penerimaan kas menurut tanggal pembayaran, termasuk pembalikan (negatif).", fit: true });
}
