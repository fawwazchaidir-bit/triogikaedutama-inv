import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { shot, BASE } from "../lib.mjs";

export async function run({ S, F }) {
  const s = S.page, f = F.page;
  const d = (p) => p.locator("dialog[open]");
  const dir = mkdtempSync(join(tmpdir(), "bank-"));
  execSync(`bash -c "set -a; . ./.env; set +a; npx tsx scripts/docs/make-bank-csv.mts ${dir}"`, { stdio: "inherit", env: { ...process.env, NODE_OPTIONS: "--conditions=react-server" } });
  const meta = JSON.parse(readFileSync(join(dir, "mutasi-mandiri.json"), "utf8"));
  const csvPath = join(dir, "mutasi-mandiri.csv");
  const line = (p, txt) => p.getByTestId("bank-line").filter({ hasText: txt }).first();

  // ── Pelaksana: impor ──
  await s.goto(`${BASE}/reconciliation`);
  await s.waitForLoadState("networkidle");
  await shot(s, "rec-list-empty", { title: "Rekonsiliasi Bank (awal)", caption: "Kartu per akun menunjukkan terakhir direkonsiliasi sampai kapan dan periode berikutnya. Daftar rekening koran masih kosong.", fit: true, marks: [
    { at: s.getByRole("button", { name: "Impor rekening koran" }), text: "Mulai dengan mengimpor CSV mutasi dari internet banking." },
    { at: s.getByText(/Periode berikutnya mulai/).first(), text: "Tanggal awal periode yang harus diimpor berikutnya." },
  ] });
  await s.getByRole("button", { name: "Impor rekening koran" }).click();
  await s.waitForTimeout(400);
  await d(s).getByLabel(/^Akun/).selectOption({ label: "Bank Mandiri IDR" });
  await d(s).getByLabel(/^Awal periode/).fill(meta.start);
  await d(s).getByLabel(/^Akhir periode/).fill(meta.end);
  await d(s).getByLabel(/^Saldo awal menurut bank/).fill(String(meta.opening));
  await d(s).getByLabel(/^Saldo akhir menurut bank/).fill(String(meta.closing));
  await d(s).getByLabel(/^Label/).fill("Mandiri Agustus–November 2026");
  await d(s).locator("#csvfile").setInputFiles(csvPath);
  await s.waitForTimeout(500);
  await shot(s, "rec-import-form", { title: "Impor rekening koran: isi data", caption: "Pilih akun, periode, saldo awal dan akhir sesuai rekening koran bank, lalu unggah CSV (atau tempel isinya). Tombol Impor baru aktif setelah pratinjau valid.", dialog: true, marks: [
    { at: d(s).getByLabel(/^Akun/), text: "Akun bank yang direkonsiliasi." },
    { at: d(s).getByLabel(/^Awal periode/), text: "Awal periode harus bersambung dengan periode sebelumnya." },
    { at: d(s).getByLabel(/^Saldo awal menurut bank/), text: "Saldo awal menurut rekening koran." },
    { at: d(s).getByLabel(/^Saldo akhir menurut bank/), text: "Saldo akhir menurut rekening koran." },
    { at: d(s).locator("#csvfile"), text: "Unggah berkas CSV dari internet banking." },
    { at: d(s).getByRole("button", { name: "Pratinjau" }), text: "Periksa pembacaan CSV sebelum diimpor." },
  ] });
  await d(s).getByRole("button", { name: "Pratinjau" }).click();
  await d(s).getByText(/baris terbaca/).waitFor();
  await d(s).getByText(/baris terbaca/).scrollIntoViewIfNeeded();
  await shot(s, "rec-import-preview", { title: "Impor rekening koran: pratinjau & pemetaan kolom", caption: "Sistem mendeteksi kolom, format tanggal, dan format angka otomatis. Ubah bila keliru, klik Terapkan pemetaan. Centang hijau ‘Saldo awal + mutasi = saldo akhir’ menandakan berkas lengkap.", dialog: true, marks: [
    { at: d(s).getByText(/baris terbaca/), text: "Ringkasan: jumlah baris, total mutasi, rentang tanggal." },
    { at: d(s).getByLabel(/^Format tanggal/), text: "Format tanggal (hari/bulan/tahun, dst.)." },
    { at: d(s).getByLabel(/^Format angka/), text: "Format angka (1.234.567,00 atau 1,234,567.00)." },
    { at: d(s).getByRole("button", { name: "Terapkan pemetaan" }), text: "Terapkan setelah mengubah pemetaan." },
    { at: d(s).getByText(/Saldo awal \+ mutasi/), text: "Pengecekan kelengkapan berkas." },
  ] });
  await d(s).getByRole("button", { name: "Impor", exact: true }).click();
  await s.waitForURL(/\/reconciliation\/.+/);
  await s.waitForLoadState("networkidle");
  const wsUrl = s.url();
  await shot(s, "rec-workspace", { title: "Ruang kerja rekonsiliasi (draft)", caption: "Atas: ringkasan selisih. Tengah: mutasi bank (baris kuning belum cocok). Bawah: transaksi buku yang belum muncul di bank. Tujuan: selisih 0.", fit: true, marks: [
    { at: s.getByText("Saldo akhir bank"), text: "Saldo akhir menurut bank." },
    { at: s.getByText("= Saldo bank disesuaikan"), text: "Saldo bank + transaksi buku yang beredar." },
    { at: s.getByText("Selisih", { exact: true }), text: "Harus 0 sebelum finalisasi." },
    { at: s.getByRole("button", { name: "Pencocokan otomatis" }), text: "Cocokkan otomatis menurut nominal & tanggal." },
    { at: s.getByRole("button", { name: "Hapus draft" }), text: "Hapus draft bila salah impor." },
  ] });
  await s.getByRole("button", { name: "Pencocokan otomatis" }).click();
  await s.waitForTimeout(1500);
  await s.waitForLoadState("networkidle");
  await shot(s, "rec-automatch", { title: "Setelah pencocokan otomatis", caption: "Baris yang nominalnya sama persis dengan transaksi buku dalam jendela tanggal langsung dicocokkan (ditandai ‘otomatis’). Sisanya perlu ditangani manual.", fit: true, marks: [
    { at: s.getByText("(otomatis)").first(), text: "Pencocokan otomatis." },
    { at: s.getByText("Belum cocok").first(), text: "Masih perlu tindakan." },
    { at: s.getByLabel(/Jendela/), text: "Jendela toleransi tanggal (± hari)." },
  ] });

  // cocokkan manual
  const unmatched = s.getByTestId("bank-line").filter({ hasText: "Belum cocok" });
  console.log("belum cocok:", (await unmatched.allTextContents()).map((t) => t.slice(0, 60)).join(" || "));
  const target = unmatched.filter({ hasText: /Sewa kantor/i }).first();
  await target.getByRole("button", { name: "Cocokkan" }).click();
  await s.waitForTimeout(400);
  await d(s).locator('input[type="checkbox"]').first().check();
  await shot(s, "rec-match-dialog", { title: "Mencocokkan manual", caption: "Pilih transaksi buku yang jumlahnya persis sama dengan sisa baris mutasi (urut dari yang paling mendekati). Beberapa transaksi boleh digabung bila totalnya sama.", dialog: true, marks: [
    { at: d(s).locator('input[type="checkbox"]').first(), text: "Centang transaksi buku yang sesuai." },
    { at: d(s).getByRole("status"), text: "Total terpilih harus = sisa; baru tombol aktif." },
    { at: d(s).getByRole("button", { name: "Cocokkan", exact: true }), text: "Simpan pencocokan." },
  ] });
  await d(s).getByRole("button", { name: "Cocokkan", exact: true }).click();
  await s.waitForTimeout(1200);

  // catat dari mutasi (Pelaksana → menunggu persetujuan)
  await line(s, /BIAYA ADM/).getByRole("button", { name: "Catat dari mutasi" }).click();
  await s.waitForTimeout(400);
  await d(s).getByLabel(/^Kategori/).selectOption({ label: "6-1800 — Administrasi & Biaya Bank" });
  await shot(s, "rec-entry-staff", { title: "Catat dari mutasi (Pelaksana)", caption: "Untuk mutasi yang hanya ada di bank (biaya admin, bunga). Pelaksana mencatat entri kas dari mutasi; entri menunggu persetujuan Finance Manager, setelah itu baris dicocokkan.", dialog: true, marks: [
    { at: d(s).getByLabel(/^Kategori/), text: "Kategori biaya/pendapatan." },
    { at: d(s).getByLabel(/^Uraian/), text: "Uraian (terisi dari mutasi)." },
    { at: d(s).getByRole("button", { name: /^Catat/ }), text: "Pelaksana: ‘Catat (menunggu persetujuan)’." },
  ] });
  await d(s).getByRole("button", { name: /^Catat/ }).click();
  await s.waitForTimeout(1500);

  // ── Finance Manager ──
  await f.goto(`${BASE}/expenses?status=PENDING`);
  await f.waitForLoadState("networkidle");
  await f.getByRole("row", { name: /BIAYA ADM/ }).getByRole("button", { name: "Setujui" }).click();
  await f.waitForTimeout(300);
  await d(f).getByRole("button", { name: /^Ya, setujui/ }).click();
  await f.waitForTimeout(1200);
  await f.goto(wsUrl);
  await f.waitForLoadState("networkidle");
  await line(f, /BIAYA ADM/).getByRole("button", { name: "Cocokkan" }).click();
  await f.waitForTimeout(400);
  const cb = d(f).locator('input[type="checkbox"]');
  console.log("kandidat:", await cb.count());
  await cb.first().check();
  await d(f).getByRole("button", { name: "Cocokkan", exact: true }).click();
  await f.waitForTimeout(1200);
  await line(f, /BUNGA TABUNGAN/).getByRole("button", { name: "Catat dari mutasi" }).click();
  await f.waitForTimeout(400);
  await d(f).getByLabel(/^Kategori/).selectOption({ label: "4-2200 — Pendapatan Bunga & Jasa Giro" });
  await shot(f, "rec-entry-fm", { title: "Catat dari mutasi (Finance Manager)", caption: "Finance Manager mencatat langsung berlaku dan baris mutasi otomatis dicocokkan.", dialog: true, marks: [
    { at: d(f).getByRole("button", { name: "Catat & cocokkan" }), text: "Catat & cocokkan sekaligus." },
  ] });
  await d(f).getByRole("button", { name: "Catat & cocokkan" }).click();
  await f.waitForTimeout(1500);
  await f.waitForLoadState("networkidle");
  await shot(f, "rec-ready", { title: "Siap difinalisasi (selisih 0)", caption: "Setelah semua baris cocok, selisih menjadi 0 (✓ hijau) dan tombol Finalisasi aktif. Transaksi buku yang masih beredar ditampilkan di bagian bawah sebagai alasan perbedaan saldo.", fit: true, marks: [
    { at: f.getByRole("status").filter({ hasText: "✓" }), text: "Selisih 0." },
    { at: f.getByRole("button", { name: "Finalisasi" }), text: "Hanya Finance Manager dapat memfinalisasi." },
    { at: f.getByText("Transaksi buku yang beredar"), text: "Transaksi buku yang belum tampil di bank." },
  ] });
  await f.getByRole("button", { name: "Finalisasi" }).click();
  await f.waitForTimeout(400);
  await shot(f, "rec-finalize-dialog", { title: "Konfirmasi finalisasi", caption: "Setelah final, pencocokan tidak dapat diubah kecuali dibuka kembali dengan alasan (hanya periode terakhir).", dialog: true, marks: [{ at: d(f).getByRole("button", { name: "Ya, finalisasi" }), text: "Finalisasi." }] });
  await d(f).getByRole("button", { name: "Ya, finalisasi" }).click();
  await f.waitForTimeout(1500);
  await f.waitForLoadState("networkidle");
  await shot(f, "rec-final", { title: "Rekonsiliasi final", caption: "Status ‘Final’. Aksi tersisa: Buka kembali (dengan alasan) dan ekspor.", fit: true, marks: [
    { at: f.getByRole("button", { name: "Buka kembali" }), text: "Buka kembali bila ada koreksi (alasan tercatat di audit)." },
  ] });
  await f.getByRole("button", { name: "Buka kembali" }).click();
  await f.waitForTimeout(400);
  await d(f).getByLabel(/^Alasan/).fill("Ditemukan satu transaksi kas yang belum dicatat.");
  await shot(f, "rec-reopen-dialog", { title: "Membuka kembali rekonsiliasi", caption: "Hanya rekening koran terakhir yang sudah final pada akun tersebut yang dapat dibuka kembali.", dialog: true, marks: [
    { at: d(f).getByLabel(/^Alasan/), text: "Alasan wajib." },
    { at: d(f).getByRole("button", { name: "Buka kembali" }), text: "Konfirmasi." },
  ] });
  await d(f).getByRole("button", { name: "Buka kembali" }).click();
  await f.waitForTimeout(1200);
  await f.waitForLoadState("networkidle");
  await f.getByRole("button", { name: "Finalisasi" }).click();
  await f.waitForTimeout(300);
  await d(f).getByRole("button", { name: "Ya, finalisasi" }).click();
  await f.waitForTimeout(1500);
  await f.goto(`${BASE}/reconciliation`);
  await f.waitForLoadState("networkidle");
  await shot(f, "rec-list-after", { title: "Daftar rekening koran setelah final", caption: "Kartu akun kini menunjukkan tanggal terakhir direkonsiliasi; kolom Status ‘Final’. Impor periode berikutnya mulai dari tanggal yang disarankan.", fit: true });
}
