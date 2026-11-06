import { shot, BASE } from "../lib.mjs";

export async function run({ S, F }) {
  const s = S.page, f = F.page;
  const d = (p) => p.locator("dialog[open]");
  await s.goto(`${BASE}/journals`);
  await s.waitForLoadState("networkidle");
  await shot(s, "jrn-list-staff", { title: "Jurnal (Pelaksana: hanya lihat)", caption: "Buku jurnal seluruh transaksi. Jurnal dari pembayaran, entri kas, dan transfer dibuat otomatis. Pelaksana hanya melihat; mencatat dan membalikkan jurnal adalah wewenang Finance Manager.", fit: true, marks: [
    { at: s.getByLabel(/^Sumber/), text: "Saring menurut sumber jurnal." },
    { at: s.getByTestId("journal-item").first(), text: "Satu jurnal: nomor, tanggal, uraian, dan baris debit/kredit." },
    { at: s.getByText(/Pembayaran invoice|Entri kas|Transfer/).first(), text: "Lencana sumber jurnal." },
  ] });

  await f.goto(`${BASE}/journals`);
  await f.waitForLoadState("networkidle");
  await shot(f, "jrn-list-fm", { title: "Jurnal (Finance Manager)", caption: "Finance Manager dapat mencatat jurnal manual (penyesuaian, saldo awal akun non-kas) dan membalikkan jurnal manual. Status penguncian buku tampil di atas daftar.", fit: true, marks: [
    { at: f.getByRole("button", { name: "Catat jurnal" }), text: "Mencatat jurnal manual." },
    { at: f.getByLabel(/^Dari tanggal/), text: "Rentang tanggal." },
  ] });
  await f.getByRole("button", { name: "Catat jurnal" }).click();
  await f.waitForTimeout(400);
  const opts = await d(f).getByLabel("Akun baris 1").locator("option").allTextContents();
  console.log("akun jurnal:", opts.slice(0, 40).join(" | "));
  await d(f).getByLabel(/^Keterangan/).fill("Penyusutan peralatan kantor Oktober 2026");
  await d(f).getByLabel(/^Referensi/).fill("PNY-2026-10");
  await d(f).getByLabel("Akun baris 1").selectOption({ label: "6-2000 — Beban Penyusutan" });
  await d(f).getByLabel("Debit baris 1").fill("250000");
  await d(f).getByLabel("Akun baris 2").selectOption({ label: "1-2900 — Akumulasi Penyusutan" });
  await d(f).getByLabel("Kredit baris 2").fill("250000");
  await d(f).getByLabel("Catatan baris 1").fill("Beban penyusutan");
  await shot(f, "jrn-new", { title: "Formulir jurnal manual", caption: "Jurnal harus seimbang (total debit = total kredit) agar dapat disimpan. Akun kas/bank tidak dapat dipilih di sini; gunakan modul Kas & Bank.", dialog: true, marks: [
    { at: d(f).getByLabel(/^Jenis/), text: "Penyesuaian/koreksi, atau Saldo awal akun non-kas." },
    { at: d(f).getByLabel(/^Tanggal/), text: "Tanggal jurnal." },
    { at: d(f).getByLabel(/^Referensi/), text: "Nomor dokumen pendukung (opsional)." },
    { at: d(f).getByLabel(/^Keterangan/), text: "Uraian jurnal (wajib)." },
    { at: d(f).getByLabel("Akun baris 1"), text: "Pilih akun per baris." },
    { at: d(f).getByLabel("Debit baris 1"), text: "Isi debit ATAU kredit pada satu baris." },
    { at: d(f).getByLabel("Total debit"), text: "Total harus sama dengan total kredit." },
    { at: d(f).getByRole("button", { name: "Tambah baris" }), text: "Tambah baris untuk jurnal majemuk." },
    { at: d(f).getByRole("button", { name: "Simpan jurnal" }), text: "Aktif hanya bila seimbang." },
  ] });
  await d(f).getByRole("button", { name: "Simpan jurnal" }).click();
  await f.waitForTimeout(1200);
  await f.goto(`${BASE}/journals?source=MANUAL`);
  await f.waitForLoadState("networkidle");
  await shot(f, "jrn-saved", { title: "Jurnal manual tersimpan", caption: "Jurnal manual berlencana biru. Tombol Balikkan membuat jurnal pembalik (debit ↔ kredit) bertanggal hari ini; jurnal asli tetap tercatat.", fit: true, marks: [
    { at: f.getByTestId("journal-item").first(), text: "Jurnal yang baru dicatat." },
    { at: f.getByRole("button", { name: "Balikkan" }).first(), text: "Balikkan (koreksi)." },
  ] });
  await f.getByRole("button", { name: "Balikkan" }).first().click();
  await f.waitForTimeout(300);
  await d(f).getByLabel(/^Alasan pembalikan/).fill("Nilai penyusutan keliru; dihitung ulang.");
  await shot(f, "jrn-reverse", { title: "Membalikkan jurnal manual", caption: "Alasan wajib. Jurnal pembalik berlencana ‘Pembalikan’, jurnal asli ‘Sudah dibalik’.", dialog: true, marks: [
    { at: d(f).getByLabel(/^Alasan pembalikan/), text: "Alasan wajib." },
    { at: d(f).getByRole("button", { name: /^Balikkan/ }).last(), text: "Konfirmasi." },
  ] });
  await d(f).getByRole("button", { name: /^Balikkan/ }).last().click();
  await f.waitForTimeout(1200);
  await f.goto(`${BASE}/journals?source=MANUAL`);
  await f.waitForLoadState("networkidle");
  await shot(f, "jrn-reversed", { title: "Jurnal setelah dibalikkan", caption: "Jurnal asli dan pembaliknya sama-sama tampil sehingga jejak audit utuh.", fit: true });
}
