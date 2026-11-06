import { shot, BASE } from "../lib.mjs";

export async function run({ S, F, A }) {
  const s = S.page, f = F.page, a = A.page;
  for (const [tab, id, title, cap] of [
    ["company", "set-company", "Pengaturan: Perusahaan & dokumen", "Identitas lembaga yang tampil di PDF invoice. Pelaksana dan Finance Manager hanya melihat; perubahan dilakukan Administrator."],
    ["banks", "set-banks", "Pengaturan: Rekening bank", "Rekening bank yang dicetak pada invoice."],
    ["numbering", "set-numbering", "Pengaturan: Penomoran invoice", "Format dan urutan nomor invoice berikutnya."],
    ["finance", "set-finance", "Pengaturan: Keuangan", "Akun kas/bank beserta saldo awal dan bagan akun. Finance Manager dan Pelaksana hanya melihat; Administrator mengelola."],
  ]) {
    await s.goto(`${BASE}/settings?tab=${tab}`);
    await s.waitForLoadState("networkidle");
    await shot(s, id, { title, caption: cap, fit: true, marks: [{ at: s.getByRole("link", { name: "Perusahaan & dokumen" }), text: "Bagian pengaturan yang terlihat untuk peran Anda." }] });
  }
  await a.goto(`${BASE}/settings?tab=finance`);
  await a.waitForLoadState("networkidle");
  await shot(a, "set-finance-admin", { title: "Pengaturan Keuangan (Administrator)", caption: "Administrator menambah akun kas/bank, saldo awal, dan mengelola bagan akun. Contoh di sini hanya untuk gambaran; Pelaksana dan Finance Manager tidak melakukannya.", fit: true });
  await a.goto(`${BASE}/audit-log`);
  await a.waitForLoadState("networkidle");
  await shot(a, "audit-admin", { title: "Audit Log (Administrator)", caption: "Seluruh aksi penting tercatat (siapa, kapan, apa). Menu ini hanya untuk Administrator.", fit: true });
}
