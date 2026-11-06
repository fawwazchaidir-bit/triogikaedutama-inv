import { shot, pdfShot, BASE } from "../lib.mjs";
import { writeFileSync } from "node:fs";
import path from "node:path";

const TMP = "/tmp/claude-0/-home-user-triogikaedutama/6b6e38d7-3bfa-5d64-87be-6b4b3772d943/scratchpad";

async function pickCombobox(page, loc, text) {
  await loc.click();
  await loc.fill(text);
  const opt = page.getByRole("listbox").getByRole("option").first();
  await opt.waitFor();
  await opt.click();
}

export async function run({ S, F }) {
  const s = S.page, f = F.page;
  // ───────── Daftar invoice (Pelaksana) ─────────
  await s.goto(`${BASE}/invoices`);
  await s.waitForLoadState("networkidle");
  await shot(s, "inv-list", {
    title: "Daftar invoice", caption: "Menu Invoice. Pelaksana melihat seluruh invoice; Finance Manager juga.", fit: true,
    marks: [
      { at: s.getByRole("link", { name: "Buat invoice" }), text: "Membuat invoice baru." },
      { at: s.getByRole("link", { name: "CSV" }), text: "Ekspor daftar (sesuai filter) ke CSV atau Excel." },
      { at: s.getByLabel(/^Nomor \/ pelanggan/), text: "Cari nomor invoice atau nama pelanggan." },
      { at: s.getByLabel(/^Status invoice/), text: "Saring menurut status dokumen: Draft, Menunggu verifikasi, Diterbitkan, Dibatalkan." },
      { at: s.getByLabel(/^Status pembayaran/), text: "Saring menurut pembayaran: Belum dibayar, Dibayar sebagian, Lunas, Jatuh tempo." },
      { at: s.getByRole("button", { name: "Terapkan" }), text: "Terapkan filter (Reset mengembalikan semua)." },
      { at: s.getByRole("columnheader", { name: "SISA" }), text: "Sisa = tagihan yang belum dibayar. Merah = sudah lewat jatuh tempo." },
      { at: s.getByRole("button", { name: "Aksi invoice 00441" }), text: "Menu aksi per baris (Duplikasi, Hapus draft, Batalkan — sesuai status & peran)." },
    ],
  });
  await s.getByLabel(/^Status invoice/).selectOption({ label: "Diterbitkan" });
  await s.getByLabel(/^Status pembayaran/).selectOption({ label: "Jatuh tempo" });
  await s.getByRole("button", { name: "Terapkan" }).click();
  await s.waitForLoadState("networkidle");
  await shot(s, "inv-list-filtered", { title: "Contoh filter: invoice terbit yang jatuh tempo", caption: "Kombinasi filter dapat dipakai untuk menyiapkan penagihan. Angka di dashboard dan lonceng memakai definisi yang sama.", fit: true, marks: [{ at: s.getByLabel(/^Status pembayaran/), text: "Filter aktif." }] });
  await s.goto(`${BASE}/invoices`);
  await s.getByRole("button", { name: "Aksi invoice draft" }).first().click();
  await s.waitForTimeout(250);
  await shot(s, "inv-row-menu", { title: "Menu aksi pada baris", caption: "Pada draft: Duplikasi dan Hapus draft. Pada invoice terbit: Duplikasi (dan Batalkan invoice untuk Finance Manager).", marks: [{ at: s.getByRole("menuitem", { name: "Duplikasi" }), text: "Salin invoice menjadi draft baru (tanpa nomor & pembayaran)." }] });
  await s.keyboard.press("Escape");

  // ───────── Membuat invoice (Pelaksana) ─────────
  await s.goto(`${BASE}/invoices/new`);
  await s.waitForLoadState("networkidle");
  await s.getByRole("button", { name: "Simpan draft" }).click();
  await s.waitForTimeout(500);
  await shot(s, "inv-new-error", { title: "Validasi saat menyimpan", caption: "Isian wajib yang kosong ditandai merah dengan pesan. Perbaiki lalu simpan lagi.", fit: true, marks: [{ at: s.getByRole("alert").first(), text: "Pesan kesalahan / isian yang harus dilengkapi." }] });
  await s.goto(`${BASE}/invoices/new`);
  await pickCombobox(s, s.getByRole("combobox", { name: "Pelanggan" }), "Cahaya");
  await s.getByLabel(/^Referensi/).fill("PO-2026-117");
  await shot(s, "inv-new-top", {
    title: "Membuat invoice — Informasi utama", caption: "Buka Invoice → Buat invoice. Bagian atas berisi data dokumen.", fit: true,
    marks: [
      { at: s.getByRole("combobox", { name: "Pelanggan" }), text: "Pilih pelanggan: ketik sebagian nama lalu pilih dari daftar. Pelanggan baru dapat ditambahkan langsung dari sini." },
      { at: s.getByLabel(/^Tanggal invoice/), text: "Tanggal invoice (bawaan hari ini)." },
      { at: s.getByLabel(/^Jangka waktu/), text: "Jangka waktu pembayaran dalam hari. Tanggal jatuh tempo dihitung otomatis." },
      { at: s.getByLabel(/^Hitungan hari/), text: "Hari kalender atau hari kerja (Senin–Jumat)." },
      { at: s.getByLabel(/^Referensi/), text: "Nomor kontrak/PO pelanggan (opsional, tercetak di invoice)." },
      { at: s.getByLabel(/^Transfer ke rekening/), text: "Rekening tujuan pembayaran yang tercetak di invoice." },
    ],
  });
  await pickCombobox(s, s.getByRole("combobox", { name: "Produk baris 1" }), "Barista");
  await s.getByLabel("Kuantitas baris 1").fill("5");
  await s.getByRole("button", { name: "Tambah baris" }).click();
  await pickCombobox(s, s.getByRole("combobox", { name: "Produk baris 2" }), "TOT");
  await s.getByLabel("Kuantitas baris 2").fill("2");
  await s.waitForTimeout(400);
  await shot(s, "inv-new-lines", {
    title: "Rincian transaksi (baris produk/layanan)", caption: "Setiap baris = satu produk/layanan. Memilih produk mengisi satuan, harga, dan deskripsi otomatis.", fit: true,
    marks: [
      { at: s.getByRole("combobox", { name: "Produk baris 1" }), text: "Cari & pilih produk dari katalog." },
      { at: s.getByLabel("Kuantitas baris 1"), text: "Jumlah (qty). Harga satuan terisi dari katalog." },
      { at: s.getByLabel(/^Product Description/).first(), text: "Deskripsi baris yang tercetak. Boleh ditambah (mis. nama peserta, periode); “Remark” program tetap mengikuti produk." },
      { at: s.getByLabel("Diskon baris 1"), text: "Diskon per baris (Rupiah) — hanya bila diizinkan." },
      { at: s.getByRole("button", { name: "Tambah baris" }), text: "Tambah baris produk lain." },
      { at: s.getByRole("button", { name: "Naikkan baris 2" }), text: "Ubah urutan baris atau hapus baris." },
    ],
  });
  await s.getByLabel(/^Transport/).fill("150000");
  await s.getByLabel(/^Down Payment/).fill("2000000");
  await s.waitForTimeout(400);
  await shot(s, "inv-new-summary", {
    title: "Ringkasan biaya (dihitung otomatis)", caption: "Panel kanan menghitung ulang setiap kali isian berubah. Angka akhir selalu dihitung ulang oleh server saat disimpan.", fit: true,
    marks: [
      { at: s.getByLabel(/^Diskon tambahan/), text: "Diskon tambahan atas seluruh invoice (bila berwenang)." },
      { at: s.getByLabel(/^Transport/), text: "Biaya transport dan Administrasi (opsional)." },
      { at: s.getByText("Nett Total").first(), text: "Nett Total = total invoice, lengkap dengan terbilang." },
      { at: s.getByLabel(/^Down Payment/), text: "DP yang sudah diterima: dicatat sebagai pembayaran pertama saat invoice terbit (tidak mengurangi nilai invoice)." },
      { at: s.getByText("Sisa tagihan").first(), text: "Sisa tagihan setelah DP." },
      { at: s.getByRole("button", { name: "Simpan & ajukan verifikasi" }), text: "Simpan DAN langsung ajukan ke Finance Manager (jalan pintas bila sudah yakin)." },
      { at: s.getByRole("button", { name: "Simpan draft" }), text: "Simpan sebagai draft (belum bernomor) — bisa dilanjutkan nanti." },
      { at: s.getByRole("button", { name: "Simpan & pratinjau PDF" }), text: "Simpan lalu tampilkan PDF draft untuk diperiksa." },
    ],
  });
  await s.getByRole("button", { name: "Simpan draft" }).click();
  await s.waitForURL(/\/invoices\/[0-9a-f-]{36}$/);
  await s.waitForLoadState("networkidle");
  const draftUrl = s.url();
  const draftId = draftUrl.split("/").pop();
  await shot(s, "inv-draft", {
    title: "Draft invoice tersimpan", caption: "Draft belum bernomor dan berwatermark DRAFT. Isi masih dapat diubah oleh pembuatnya.", fit: true,
    marks: [
      { at: s.getByText("Edit draft", { exact: true }), text: "Ubah isi draft (hanya selama masih draft dan hanya oleh pembuatnya)." },
      { at: s.getByRole("button", { name: /Preview PDF/ }), text: "Pratinjau PDF draft (berwatermark)." },
      { at: s.getByRole("button", { name: "Ajukan untuk verifikasi" }), text: "Kirim ke Finance Manager untuk diperiksa & diterbitkan." },
      { at: s.getByRole("button", { name: "Aksi lainnya" }), text: "Menu: Duplikasi dan Hapus draft." },
      { at: s.getByText("Ini masih draft", { exact: false }), text: "Penanda status: belum bernomor, tanpa tanda tangan & cap." },
      { at: s.locator("section").filter({ has: s.getByRole("heading", { name: "Ringkasan biaya" }) }), text: "Ringkasan biaya dan sisa tagihan." },
    ],
  });
  const pdf = await s.request.get(`${BASE}/api/invoices/${draftId}/pdf`);
  writeFileSync(path.join(TMP, "draft.pdf"), await pdf.body());
  pdfShot(path.join(TMP, "draft.pdf"), "inv-pdf-draft", { title: "PDF draft (pratinjau)", caption: "Pratinjau draft berwatermark DRAFT; tanda tangan dan cap baru muncul setelah disetujui." });

  // ───────── Mengajukan (Pelaksana) ─────────
  await s.getByRole("button", { name: "Ajukan untuk verifikasi" }).click();
  await s.waitForTimeout(250);
  await shot(s, "inv-submit-dialog", { title: "Mengajukan untuk verifikasi", caption: "Setelah diajukan, isi invoice terkunci. Draft tetap berwatermark sampai Finance Manager menyetujui.", dialog: true, marks: [{ at: s.getByRole("button", { name: "Ya, ajukan" }), text: "Konfirmasi pengajuan." }] });
  await s.getByRole("button", { name: "Ya, ajukan" }).click();
  await s.getByText("Menunggu Verifikasi").first().waitFor();
  await s.waitForLoadState("networkidle");
  await shot(s, "inv-submitted", { title: "Invoice menunggu verifikasi", caption: "Status berubah menjadi “Menunggu Verifikasi”. Pelaksana tidak dapat mengubah isinya, tetapi masih boleh menarik kembali selama belum diperiksa.", fit: true, marks: [
    { at: s.getByText("Menunggu Verifikasi").first(), text: "Status dokumen." },
    { at: s.getByRole("button", { name: "Tarik kembali" }), text: "Tarik kembali pengajuan (invoice kembali menjadi draft yang dapat diedit)." },
  ] });
  await s.getByRole("button", { name: "Tarik kembali" }).click();
  await s.waitForTimeout(250);
  await shot(s, "inv-withdraw-dialog", { title: "Menarik kembali pengajuan", caption: "Dipakai bila ada kesalahan yang disadari sebelum Finance Manager memeriksa.", dialog: true, marks: [{ at: s.getByRole("button", { name: "Ya, tarik kembali" }), text: "Konfirmasi (di sini dibatalkan agar alur berlanjut)." }] });
  await s.getByRole("button", { name: "Batal" }).click();

  // ───────── Verifikasi (Finance Manager) ─────────
  await f.goto(draftUrl);
  await f.waitForLoadState("networkidle");
  await shot(f, "inv-review", { title: "Meninjau invoice yang diajukan (Finance Manager)", caption: "Finance Manager membuka invoice dari lonceng atau filter “Menunggu verifikasi”. Periksa pelanggan, rincian, nominal, dan PDF sebelum memutuskan.", fit: true, marks: [
    { at: f.getByRole("button", { name: /Preview PDF/ }), text: "Periksa PDF (masih berwatermark DRAFT)." },
    { at: f.getByRole("button", { name: /Setujui/ }), text: "Setujui & terbitkan: nomor dialokasikan, tanda tangan & cap muncul, isi dibekukan." },
    { at: f.getByRole("button", { name: "Kembalikan ke staff" }), text: "Kembalikan ke pelaksana dengan catatan perbaikan." },
    { at: f.locator("section").filter({ has: f.getByRole("heading", { name: "Rincian transaksi" }) }), text: "Rincian yang diperiksa." },
  ] });
  await f.getByRole("button", { name: "Kembalikan ke staff" }).click();
  await f.waitForTimeout(250);
  await f.getByLabel(/^Alasan/).fill("Jumlah peserta Barista seharusnya 6 orang sesuai daftar hadir. Mohon diperbaiki.");
  await shot(f, "inv-return-dialog", { title: "Mengembalikan invoice ke pelaksana", caption: "Alasan wajib diisi dan akan terlihat oleh pelaksana.", dialog: true, marks: [
    { at: f.getByLabel(/^Alasan/), text: "Tulis perbaikan yang diminta secara spesifik." },
    { at: f.getByRole("button", { name: "Kembalikan", exact: true }), text: "Kembalikan." },
  ] });
  await f.getByRole("button", { name: "Kembalikan", exact: true }).click();
  await f.waitForTimeout(800);

  // ───────── Diperbaiki pelaksana ─────────
  await s.goto(draftUrl);
  await s.waitForLoadState("networkidle");
  await shot(s, "inv-returned", { title: "Invoice dikembalikan oleh Finance Manager", caption: "Pelaksana melihat catatan perbaikan pada halaman invoice (juga di riwayat). Draft dapat diedit lagi.", fit: true, marks: [
    { at: s.getByText(/Jumlah peserta Barista/).first(), text: "Catatan dari Finance Manager." },
    { at: s.getByText("Edit draft", { exact: true }), text: "Perbaiki isi draft." },
  ] });
  await s.getByText("Edit draft", { exact: true }).click();
  await s.waitForURL(/\/edit/);
  await s.waitForLoadState("networkidle");
  await s.getByLabel("Kuantitas baris 1").fill("6");
  await s.waitForTimeout(300);
  await shot(s, "inv-edit", { title: "Mengedit draft", caption: "Formulir sama dengan saat membuat invoice, sudah terisi. Ubah yang perlu, lalu simpan.", fit: true, marks: [
    { at: s.getByLabel("Kuantitas baris 1"), text: "Contoh perbaikan: jumlah peserta menjadi 6." },
    { at: s.getByRole("button", { name: "Simpan & ajukan verifikasi" }), text: "Simpan perbaikan sekaligus mengajukan ulang." },
    { at: s.getByRole("button", { name: "Simpan draft" }), text: "Atau simpan saja tanpa mengajukan." },
  ] });
  await s.getByRole("button", { name: "Simpan & ajukan verifikasi" }).click();
  await s.getByText("Menunggu Verifikasi").first().waitFor();
  await s.waitForTimeout(500);

  // ───────── Disetujui & diterbitkan ─────────
  await f.goto(draftUrl);
  await f.waitForLoadState("networkidle");
  await f.getByRole("button", { name: /Setujui/ }).click();
  await f.waitForTimeout(250);
  await shot(f, "inv-approve-dialog", { title: "Menyetujui & menerbitkan", caption: "Tindakan ini tidak dapat dibatalkan dengan mudah: isi dibekukan, nomor terpakai. Koreksi setelah terbit dilakukan lewat pembatalan.", dialog: true, marks: [{ at: f.getByRole("button", { name: "Ya, setujui & terbitkan" }), text: "Terbitkan." }] });
  await f.getByRole("button", { name: "Ya, setujui & terbitkan" }).click();
  await f.getByText("Diterbitkan").first().waitFor();
  await f.waitForLoadState("networkidle");
  await shot(f, "inv-issued", { title: "Invoice terbit", caption: "Setelah terbit invoice bernomor, pelanggan & rincian dibekukan, dan siap ditagih.", fit: true, marks: [
    { at: f.getByRole("heading", { name: /^Invoice 00/ }), text: "Nomor invoice resmi (urut, tidak pernah dipakai ulang)." },
    { at: f.getByRole("button", { name: "Preview PDF" }), text: "Preview PDF resmi di layar; Unduh PDF menyimpan berkasnya." },
    { at: f.getByRole("button", { name: "Catat pembayaran" }), text: "Mencatat pembayaran/DP dari pelanggan (lihat bab Pembayaran)." },
    { at: f.getByRole("button", { name: "Aksi lainnya" }), text: "Duplikasi atau Batalkan invoice (Finance Manager)." },
    { at: f.locator("section").filter({ has: f.getByRole("heading", { name: "Pembayaran" }) }), text: "Daftar pembayaran yang tercatat pada invoice ini." },
    { at: f.locator("section").filter({ has: f.getByRole("heading", { name: "Riwayat" }) }), text: "Riwayat: siapa membuat, mengajukan, mengembalikan, menyetujui — lengkap dengan waktunya." },
  ] });
  const issuedId = f.url().split("/").pop();
  const pdf2 = await f.request.get(`${BASE}/api/invoices/${issuedId}/pdf`);
  writeFileSync(path.join(TMP, "issued.pdf"), await pdf2.body());
  pdfShot(path.join(TMP, "issued.pdf"), "inv-pdf-issued", { title: "PDF invoice resmi", caption: "PDF resmi: bernomor, bertanda tangan Finance Manager dan bercap. Bandingkan dengan draft di atas." });

  await f.getByRole("button", { name: "Aksi lainnya" }).click();
  await f.waitForTimeout(250);
  await shot(f, "inv-menu-detail", { title: "Menu aksi pada invoice terbit", caption: "Hanya Finance Manager yang dapat membatalkan invoice terbit.", marks: [
    { at: f.getByRole("menuitem", { name: "Duplikasi" }), text: "Salin menjadi draft baru." },
    { at: f.getByRole("menuitem", { name: /Batalkan invoice/ }), text: "Batalkan invoice (alasan wajib)." },
  ] });
  await f.getByRole("menuitem", { name: /Batalkan invoice/ }).click();
  await f.waitForTimeout(250);
  await shot(f, "inv-cancel-dialog", { title: "Membatalkan invoice terbit", caption: "Invoice tetap tersimpan dengan status Dibatalkan dan nomornya tidak dipakai ulang. Bila sudah ada pembayaran, balikkan pembayaran lebih dulu.", dialog: true, marks: [
    { at: f.getByLabel(/^Alasan pembatalan/), text: "Alasan wajib (tercatat di riwayat)." },
    { at: f.getByRole("button", { name: "Batalkan invoice" }), text: "Konfirmasi pembatalan (tidak dijalankan pada contoh ini)." },
  ] });
  await f.getByRole("button", { name: "Batal", exact: true }).click();

  // Invoice yang sudah dibatalkan (data demo)
  await f.goto(`${BASE}/invoices?status=CANCELLED`);
  await f.getByRole("link", { name: /^0044/ }).first().click();
  await f.waitForLoadState("networkidle");
  await shot(f, "inv-cancelled", { title: "Invoice yang dibatalkan", caption: "Pesan merah menjelaskan siapa, kapan, dan mengapa dibatalkan. PDF-nya berwatermark DIBATALKAN.", fit: true, marks: [{ at: f.getByText(/Invoice dibatalkan pada/), text: "Keterangan pembatalan beserta alasan." }] });

  // Duplikasi lalu hapus draft
  await f.goto(`${BASE}/invoices/${issuedId}`);
  await f.getByRole("button", { name: "Aksi lainnya" }).click();
  await f.getByRole("menuitem", { name: "Duplikasi" }).click();
  await f.waitForURL(/\/invoices\/[0-9a-f-]{36}\/edit/);
  await f.waitForLoadState("networkidle");
  await shot(f, "inv-duplicated", { title: "Hasil duplikasi", caption: "Duplikasi membuat draft baru dan langsung membuka formulir ubah: rincian disalin, tetapi tanpa nomor, tanpa DP, dan tanpa pembayaran. Sesuaikan tanggal/jumlah, lalu simpan atau ajukan.", fit: true, marks: [
    { at: f.getByRole("heading", { name: "Edit draft invoice" }), text: "Draft baru (bukan invoice terbit)." },
    { at: f.getByLabel(/^Tanggal invoice/), text: "Periksa tanggal — bawaan hari ini." },
    { at: f.getByRole("button", { name: "Simpan draft" }), text: "Simpan sebagai draft." },
  ] });
  await f.goto(f.url().replace(/\/edit.*$/, ""));
  await f.waitForLoadState("networkidle");
  await f.getByRole("button", { name: "Aksi lainnya" }).click();
  await f.getByRole("menuitem", { name: /Hapus draft/ }).click();
  await f.waitForTimeout(250);
  await shot(f, "inv-delete-dialog", { title: "Menghapus draft", caption: "Hanya draft (belum bernomor) yang dapat dihapus; penghapusan tercatat di audit log.", dialog: true, marks: [{ at: f.getByRole("button", { name: "Hapus draft" }).last(), text: "Konfirmasi hapus." }] });
  await f.getByRole("button", { name: "Hapus draft" }).last().click();
  await f.waitForURL(/\/invoices$/);
  return { draftId, issuedId };
}
