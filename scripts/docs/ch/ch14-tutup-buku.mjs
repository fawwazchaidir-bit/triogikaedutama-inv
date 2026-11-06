import { shot, BASE } from "../lib.mjs";

export async function run({ S, F }) {
  const s = S.page, f = F.page;
  const d = (p) => p.locator("dialog[open]");
  await s.goto(`${BASE}/closing`);
  await s.waitForLoadState("networkidle");
  await shot(s, "close-staff", { title: "Tutup Buku (Pelaksana, hanya lihat)", caption: "Pelaksana dapat melihat status tiap periode tetapi tidak dapat menutup atau membuka kembali. Kunci buku menolak transaksi bertanggal sampai akhir bulan yang ditutup.", fit: true, marks: [
    { at: s.getByTestId("period-row").first(), text: "Satu baris per bulan: status, total aset, laba, catatan penutupan." },
  ] });
  await f.goto(`${BASE}/closing`);
  await f.waitForLoadState("networkidle");
  await shot(f, "close-fm", { title: "Tutup Buku (Finance Manager)", caption: "Bulan ditutup berurutan dari yang paling awal. Tombol ‘Tutup bulan’ hanya muncul pada bulan yang boleh ditutup berikutnya.", fit: true, marks: [
    { at: f.getByRole("button", { name: "Tutup bulan" }).first(), text: "Tutup bulan ini." },
  ] });
  await f.getByRole("button", { name: "Tutup bulan" }).first().click();
  await d(f).getByRole("list", { name: "Daftar periksa penutupan" }).waitFor();
  await f.waitForTimeout(500);
  await shot(f, "close-checklist", { title: "Daftar periksa penutupan", caption: "Sistem memeriksa pembukuan: centang hijau lolos; merah menghalangi (harus diselesaikan); kuning peringatan (boleh ditutup bila diakui). Wajib mengisi catatan penutupan.", dialog: true, marks: [
    { at: d(f).getByRole("list", { name: "Daftar periksa penutupan" }), text: "Hasil pemeriksaan otomatis." },
    { at: d(f).getByLabel(/^Catatan penutupan/), text: "Catatan wajib (min. 5 karakter)." },
  ] });
  const boxes = d(f).locator('input[type="checkbox"]');
  for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).check();
  await d(f).getByLabel(/^Catatan penutupan/).fill("Pembukuan dan rekonsiliasi bank sudah dicek; ditutup.");
  await shot(f, "close-confirm", { title: "Menutup bulan", caption: "Peringatan kuning harus diberi tanda ‘diakui’. Setelah menekan ‘Tutup …’, foto neraca saldo dan hash disimpan.", dialog: true, marks: [
    { at: d(f).getByRole("button", { name: /^Tutup / }).last(), text: "Konfirmasi penutupan." },
  ] });
  await d(f).getByRole("button", { name: /^Tutup / }).last().click();
  await f.waitForTimeout(1500);
  await f.goto(`${BASE}/closing`);
  await f.waitForLoadState("networkidle");
  await shot(f, "close-done", { title: "Periode yang sudah ditutup", caption: "Status ‘Ditutup’ beserta ‘Foto cocok’ (hash cocok dengan buku besar). Bila muncul ‘Foto berubah!’, hubungi Administrator.", fit: true, marks: [
    { at: f.getByText("Foto cocok").first(), text: "Integritas angka periode terjaga." },
    { at: f.getByRole("button", { name: "Buka kembali" }).first(), text: "Buka kembali (alasan wajib) bila perlu koreksi." },
  ] });
  await f.getByRole("button", { name: "Buka kembali" }).first().click();
  await f.waitForTimeout(300);
  await d(f).getByLabel(/^Alasan/).fill("Ada koreksi pencatatan yang belum masuk.");
  await shot(f, "close-reopen", { title: "Membuka kembali periode", caption: "Hanya periode yang paling akhir ditutup yang dapat dibuka. Alasan tercatat di audit log.", dialog: true, marks: [
    { at: d(f).getByLabel(/^Alasan/), text: "Alasan (min. 5 karakter)." },
    { at: d(f).getByRole("button", { name: "Buka kembali" }).last(), text: "Konfirmasi." },
  ] });
  await d(f).getByRole("button", { name: "Buka kembali" }).last().click();
  await f.waitForTimeout(1200);
}
