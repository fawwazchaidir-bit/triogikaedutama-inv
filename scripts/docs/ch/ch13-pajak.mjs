import { shot, BASE } from "../lib.mjs";

export async function run({ S, F, A }) {
  const s = S.page, f = F.page, a = A.page;
  const d = (p) => p.locator("dialog[open]");
  await s.goto(`${BASE}/taxes`);
  await s.waitForLoadState("networkidle");
  await shot(s, "tax-summary-staff", { title: "Pajak: Ringkasan (Pelaksana, hanya lihat)", caption: "Ringkasan saldo pajak dan profil pajak. Pelaksana hanya melihat; mengubah profil (Administrator) dan mencatat setoran pajak (Finance Manager) tidak tersedia baginya.", fit: true, marks: [
    { at: s.getByRole("link", { name: "PPN", exact: true }), text: "Tab: Ringkasan, PPN, PPh dipotong pelanggan, Estimasi PPh badan, Setoran pajak." },
    { at: s.getByText("Utang PPN (2-1210)"), text: "Saldo utang PPN dari penerimaan kas." },
    { at: s.getByText("Kredit PPh dipotong (1-1400)"), text: "Total PPh yang dipotong pelanggan (kredit pajak)." },
    { at: s.getByText("Status PKP"), text: "Profil pajak lembaga (diisi Administrator)." },
  ] });
  await s.goto(`${BASE}/taxes?tab=ppn`);
  await s.waitForLoadState("networkidle");
  await shot(s, "tax-ppn", { title: "Pajak: Rekap PPN", caption: "Rekap PPN per masa: menurut invoice (acuan faktur pajak) dan menurut uang yang diterima. Lembaga non-PKP umumnya bernilai nol.", fit: true, marks: [
    { at: s.getByLabel(/^Dari tanggal/), text: "Periode rekap." },
    { at: s.getByRole("link", { name: "PDF" }), text: "Ekspor." },
  ] });
  await s.goto(`${BASE}/taxes?tab=pph23`);
  await s.waitForLoadState("networkidle");
  await shot(s, "tax-pph23", { title: "Pajak: Register PPh dipotong pelanggan", caption: "Daftar pembayaran yang dipotong PPh oleh pelanggan. Lencana ‘Belum ada’ berarti nomor bukti potong belum diisi — kejar dari pelanggan lalu isi dengan tombol ‘Isi nomor’.", fit: true, marks: [
    { at: s.getByText("Belum ada", { exact: true }).first(), text: "Nomor bukti potong belum diisi." },
    { at: s.getByRole("button", { name: "Isi nomor" }).first(), text: "Isi nomor bukti potong (hanya sekali)." },
  ] });
  await s.getByRole("button", { name: "Isi nomor" }).first().click();
  await s.waitForTimeout(300);
  await d(s).getByLabel(/^Nomor bukti potong/).fill("BP-2026-0013");
  await shot(s, "tax-pph23-ref", { title: "Mengisi nomor bukti potong", caption: "Nomor hanya dapat diisi sekali. Bila salah, balikkan pembayaran (Finance Manager) lalu catat ulang dengan nomor yang benar.", dialog: true, marks: [
    { at: d(s).getByLabel(/^Nomor bukti potong/), text: "Nomor bukti potong dari pelanggan." },
  ] });
  await d(s).getByRole("button", { name: "Simpan" }).click();
  await s.waitForTimeout(1200);

  await f.goto(`${BASE}/taxes?tab=pph-badan`);
  await f.waitForLoadState("networkidle");
  await shot(f, "tax-corp", { title: "Pajak: Estimasi PPh badan", caption: "Estimasi manajemen dari pembukuan. Rezim dan tarif ditetapkan Administrator di profil pajak; bila belum diaktifkan akan tampil pemberitahuan seperti ini.", fit: true, marks: [
    { at: f.getByLabel(/^Tahun/), text: "Tahun pajak." },
  ] });
  await f.goto(`${BASE}/taxes?tab=setoran`);
  await f.waitForLoadState("networkidle");
  await shot(f, "tax-payments-fm", { title: "Pajak: Setoran pajak (Finance Manager)", caption: "Setoran pajak mengurangi utang PPN/PPh badan (bukan beban). Hanya Finance Manager yang dapat mencatat.", fit: true, marks: [
    { at: f.getByRole("button", { name: "Catat setoran pajak" }), text: "Catat setoran pajak baru." },
  ] });
  await f.getByRole("button", { name: "Catat setoran pajak" }).click();
  await f.waitForTimeout(300);
  await d(f).getByLabel(/^Masa \/ tahun pajak/).fill("2026-09");
  await d(f).getByLabel(/^Nominal/).fill("500000");
  await d(f).getByLabel(/^NTPN/).fill("NTPN-2026-09-000123");
  await shot(f, "tax-payment-new", { title: "Formulir setoran pajak", caption: "Isi jenis pajak, masa, tanggal, akun sumber dana, nominal, dan NTPN/ID billing (wajib sebagai bukti).", dialog: true, marks: [
    { at: d(f).getByLabel(/^Jenis/), text: "PPN atau PPh badan." },
    { at: d(f).getByLabel(/^Masa \/ tahun pajak/), text: "Contoh: 2026-09 atau 2026." },
    { at: d(f).getByLabel(/^Dibayar dari/), text: "Akun kas/bank sumber." },
    { at: d(f).getByLabel(/^Nominal/), text: "Nominal disetor." },
    { at: d(f).getByLabel(/^NTPN/), text: "Bukti setor (wajib)." },
  ] });
  await d(f).getByRole("button", { name: "Batal" }).click();

  await a.goto(`${BASE}/taxes`);
  await a.waitForLoadState("networkidle");
  await a.getByRole("button", { name: "Ubah profil pajak" }).click();
  await a.waitForTimeout(300);
  await shot(a, "tax-profile-admin", { title: "Profil pajak (Administrator)", caption: "Administrator mengatur status PKP, rezim PPh badan, dan tarif sesuai arahan konsultan pajak. Sistem tidak mengasumsikan tarif.", dialog: true, marks: [
    { at: d(a).getByLabel(/^Rezim PPh badan/), text: "Tidak dihitung / tarif umum / final." },
  ] });
  await d(a).getByRole("button", { name: "Batal" }).click();
}
