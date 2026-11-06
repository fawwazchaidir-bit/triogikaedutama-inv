import { shot, BASE } from "../lib.mjs";

export async function run({ F }) {
  const f = F.page;
  await f.goto(`${BASE}/dashboard`);
  await f.waitForLoadState("networkidle");
  const card = (name) => f.locator("section").filter({ has: f.getByRole("heading", { name }) });
  await shot(f, "dash", {
    title: "Dashboard Keuangan", caption: "Hanya Finance Manager (dan Administrator) yang melihat dashboard. Semua angka dihitung langsung dari database, bukan input manual.", fit: true,
    marks: [
      { at: f.getByTestId("period-filter"), text: "Periode tanggal yang dianalisis (bawaan: 1 Januari s.d. hari ini)." },
      { at: f.getByLabel("Pelanggan", { exact: true }), text: "Saring seluruh angka untuk satu pelanggan." },
      { at: f.getByRole("region", { name: "Ringkasan keuangan" }), text: "Tiga angka utama: Nilai Invoice Terbit, Penerimaan Kas, dan Piutang Belum Dibayar. Klik kartu untuk melihat rinciannya." },
      { at: f.getByRole("region", { name: "Sebaran status" }), text: "Enam status invoice yang SALING LEPAS (satu invoice hanya masuk satu status). Klik untuk membuka daftar yang cocok." },
      { at: f.getByRole("img", { name: /Grafik garis/ }), text: "Tren per bulan: Invoice Terbit (merah) dan Penerimaan Kas (kuning). Arahkan kursor ke titik untuk melihat nilai." },
      { at: card("Invoice Terbaru"), text: "Lima invoice terbaru pada periode; klik nomor untuk membuka." },
      { at: card("Ringkasan Status Invoice"), text: "Jumlah & nilai per status (termasuk Dibatalkan). Baris Total = seluruh invoice pada periode." },
    ],
  });
  await f.getByTestId("period-filter").click();
  await f.waitForTimeout(250);
  await shot(f, "dash-period", {
    title: "Memilih periode", caption: "Klik tombol periode. Pilih rentang cepat atau isi tanggal sendiri.", h: 520,
    marks: [
      { at: f.getByRole("button", { name: "Bulan ini" }), text: "Rentang cepat: Bulan ini, 30 hari terakhir, Tahun ini, Tahun lalu." },
      { at: f.getByLabel("Dari tanggal"), text: "Tanggal awal." },
      { at: f.getByLabel("Sampai tanggal"), text: "Tanggal akhir (tidak boleh di masa depan)." },
      { at: f.getByRole("button", { name: "Terapkan" }), text: "Terapkan. Tombol nonaktif bila tanggal tidak valid." },
    ],
  });
  await f.keyboard.press("Escape");
  await f.getByRole("button", { name: "Tampilkan tabel" }).click();
  await f.waitForTimeout(250);
  await shot(f, "dash-table", {
    title: "Grafik dalam bentuk tabel", caption: "Tombol “Tampilkan tabel” mengganti grafik dengan tabel angka (berguna untuk dicetak atau dibaca pembaca layar).", fit: true,
    marks: [{ at: f.getByRole("button", { name: "Tampilkan grafik" }), text: "Kembali ke grafik." }, { at: f.getByRole("table").first(), text: "Nilai invoice terbit dan penerimaan kas tiap bulan." }],
  });
  await f.getByRole("button", { name: "Tampilkan grafik" }).click();
  await f.getByLabel("Pelanggan", { exact: true }).selectOption({ label: "CV Bima Satria Jaya" });
  await f.waitForURL(/customerId=/);
  await f.waitForLoadState("networkidle");
  await shot(f, "dash-customer", {
    title: "Dashboard untuk satu pelanggan", caption: "Setelah memilih pelanggan, semua kartu, status, grafik, dan tabel hanya memuat data pelanggan itu.", fit: true,
    marks: [{ at: f.getByLabel("Pelanggan", { exact: true }), text: "Pelanggan terpilih (kembalikan ke “Semua Pelanggan” untuk melihat keseluruhan)." }],
  });
  await f.goto(`${BASE}/dashboard`);
}
