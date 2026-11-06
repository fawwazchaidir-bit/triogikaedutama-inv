import { shot, BASE } from "../lib.mjs";

export async function run({ S, F }) {
  const s = S.page, f = F.page;
  await s.goto(`${BASE}/statements`);
  await s.waitForLoadState("networkidle");
  await shot(s, "stm-income", { title: "Laporan Keuangan: Laba Rugi (basis kas)", caption: "Pelaksana dapat MELIHAT seluruh laporan keuangan namun tidak mengubahnya. Pendapatan diakui saat uang diterima, beban saat dibayar; hanya entri berlaku yang dihitung.", fit: true, marks: [
    { at: s.getByRole("link", { name: "Laba Rugi" }), text: "Lima laporan: Laba Rugi, Arus Kas, Neraca, Neraca Saldo, Buku Besar." },
    { at: s.getByLabel(/^Dari tanggal/), text: "Periode laporan." },
    { at: s.getByLabel(/^Pembanding/), text: "Bandingkan dengan periode sebelumnya / tahun lalu." },
    { at: s.getByRole("link", { name: "PDF" }), text: "Ekspor PDF (juga CSV & Excel)." },
    { at: s.getByText("Laba (rugi) bersih sebelum pajak penghasilan"), text: "Baris hasil akhir." },
  ] });
  await f.goto(`${BASE}/statements?type=income-statement&compare=previous`);
  await f.waitForLoadState("networkidle");
  await shot(f, "stm-compare", { title: "Laba Rugi dengan pembanding", caption: "Memilih pembanding menampilkan kolom Periode ini, Pembanding, Selisih, dan persen perubahan. Ekspor mengikuti tampilan yang sama.", fit: true, marks: [
    { at: f.getByLabel(/^Pembanding/), text: "Pilih pembanding lalu klik Terapkan." },
    { at: f.getByTestId("compare-table"), text: "Tabel pembanding." },
  ] });
  await f.goto(`${BASE}/statements?type=cash-flow`);
  await f.waitForLoadState("networkidle");
  await shot(f, "stm-cashflow", { title: "Arus Kas", caption: "Arus kas dikelompokkan operasi, investasi, pendanaan. Baris hijau di bawah memastikan kas akhir arus kas sama dengan kas di neraca.", fit: true, marks: [
    { at: f.getByTestId("cash-tie-out"), text: "Pengecekan: kas akhir arus kas = kas pada neraca." },
  ] });
  await f.goto(`${BASE}/statements?type=balance-sheet`);
  await f.waitForLoadState("networkidle");
  await shot(f, "stm-balance", { title: "Neraca", caption: "Posisi aset, kewajiban, dan ekuitas per tanggal. Laporan ‘per tanggal’ hanya memiliki satu filter tanggal.", fit: true, marks: [
    { at: f.getByLabel(/^Per tanggal/), text: "Tanggal posisi neraca." },
  ] });
  await f.goto(`${BASE}/statements?type=trial-balance`);
  await f.waitForLoadState("networkidle");
  await shot(f, "stm-trial", { title: "Neraca Saldo", caption: "Saldo seluruh akun; total debit harus sama dengan total kredit.", fit: true });
  await f.goto(`${BASE}/statements?type=general-ledger`);
  await f.waitForLoadState("networkidle");
  const gl = f.getByLabel(/^Akun/);
  const opts = await gl.locator("option").allTextContents();
  const pick = opts.find((o) => /Pendapatan Lain-lain|Bunga/.test(o)) ?? opts[1];
  await gl.selectOption({ label: pick });
  await f.getByRole("button", { name: /Terapkan|Tampilkan|Filter/ }).first().click();
  await f.waitForLoadState("networkidle");
  await shot(f, "stm-gl", { title: "Buku Besar per akun", caption: "Pilih satu akun untuk melihat seluruh mutasinya dengan saldo berjalan. Ekspor aktif setelah akun dipilih.", fit: true, marks: [
    { at: f.getByLabel(/^Akun/), text: "Pilih akun." },
  ] });
}
