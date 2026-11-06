import { shot, BASE } from "../lib.mjs";

export async function run({ S, F }) {
  const s = S.page;
  await s.goto(`${BASE}/customers`);
  await s.waitForLoadState("networkidle");
  await shot(s, "cust-list", {
    title: "Daftar pelanggan", caption: "Menu Pelanggan. Pelaksana dan Finance Manager dapat menambah, mengubah, dan mengarsipkan pelanggan.", fit: true,
    marks: [
      { at: s.getByLabel(/^Cari/), text: "Cari nama, kontak, kota, atau email." },
      { at: s.getByLabel(/^Status/), text: "Tampilkan pelanggan Aktif, Diarsipkan, atau Semua." },
      { at: s.getByRole("button", { name: "Tambah pelanggan" }), text: "Tambah pelanggan baru." },
      { at: s.getByRole("columnheader", { name: "PIUTANG" }), text: "Piutang = nilai invoice terbit dikurangi pembayaran yang tercatat." },
      { at: s.getByRole("button", { name: "Edit" }).first(), text: "Edit data pelanggan; Arsipkan menyembunyikan pelanggan dari pilihan invoice baru (riwayat tetap)." },
    ],
  });
  await s.getByRole("button", { name: "Tambah pelanggan" }).click();
  await s.waitForTimeout(250);
  await s.getByLabel(/^Nama perusahaan/).fill("PT Cahaya Boga");
  await s.getByLabel(/^Kota/).fill("Yogyakarta");
  await s.getByLabel(/^Nama kontak/).fill("Ibu Dewi");
  await s.getByLabel(/^Jabatan kontak/).fill("Manajer HRD");
  await s.getByLabel(/^Telepon/).fill("0812-3456-7890");
  await s.getByLabel(/^Email/).fill("hrd@cahayaboga.example");
  await s.getByLabel(/^Alamat/).fill("Jl. Kenari No. 12, Yogyakarta");
  await shot(s, "cust-new", {
    title: "Menambah pelanggan", caption: "Hanya nama yang wajib; makin lengkap data kontak, makin rapi invoice dan penagihan.", dialog: true,
    marks: [
      { at: s.getByLabel(/^Nama perusahaan/), text: "Nama perusahaan/instansi persis seperti yang akan tercetak di invoice." },
      { at: s.getByLabel(/^NPWP/), text: "NPWP (opsional) — dicetak bila diisi." },
      { at: s.getByRole("button", { name: "Simpan" }), text: "Simpan. Aplikasi memeriksa kemungkinan duplikat lebih dulu." },
    ],
  });
  await s.getByRole("button", { name: "Simpan" }).click();
  await s.waitForTimeout(600);
  await shot(s, "cust-saved", { title: "Pelanggan tersimpan", caption: "Muncul notifikasi hijau dan pelanggan baru langsung ada di daftar serta di pilihan invoice.", fit: true, marks: [{ at: s.getByText("PT Cahaya Boga").first(), text: "Pelanggan baru." }] });

  // Deteksi duplikat: (1) identitas sama persis → ditolak; (2) nama sama, kota berbeda → peringatan + konfirmasi
  await s.getByRole("button", { name: "Tambah pelanggan" }).click();
  await s.waitForTimeout(250);
  await s.getByLabel(/^Nama perusahaan/).fill("CV Bima Satria Jaya");
  await s.getByLabel(/^Kota/).fill("Sleman");
  await s.getByRole("button", { name: "Simpan" }).click();
  await s.getByText(/sudah ada/).first().waitFor();
  await shot(s, "cust-dup-exact", {
    title: "Pelanggan yang sudah ada (ditolak)", caption: "Bila nama dan kota sama persis dengan pelanggan yang sudah ada, penyimpanan ditolak dan pelanggan yang cocok ditampilkan. Pakai pelanggan itu, jangan buat ganda.", dialog: true,
    marks: [{ at: s.getByText(/sudah ada/).first(), text: "Pesan penolakan beserta pelanggan yang cocok (nama dan kotanya)." }],
  });
  await s.getByLabel(/^Kota/).fill("Bantul");
  await s.getByRole("button", { name: "Simpan" }).click();
  await s.getByRole("button", { name: "Tetap simpan sebagai pelanggan berbeda" }).waitFor();
  await shot(s, "cust-dup", {
    title: "Peringatan pelanggan mirip", caption: "Bila nama sama tetapi kota berbeda, aplikasi meminta konfirmasi. Ini mencegah catatan ganda karena salah ketik, tetapi tetap mengizinkan cabang/pelanggan yang memang berbeda.", dialog: true,
    marks: [{ at: s.getByRole("button", { name: "Tetap simpan sebagai pelanggan berbeda" }), text: "Pilih ini HANYA bila memang pelanggan yang berbeda (mis. cabang lain). Jika sama, tekan Batal dan pakai pelanggan yang sudah ada." }],
  });
  await s.getByRole("button", { name: "Batal" }).click();

  // Detail pelanggan
  await s.getByRole("link", { name: "CV Bima Satria Jaya" }).first().click();
  await s.waitForURL(/\/customers\/[0-9a-f-]{36}/);
  await s.waitForLoadState("networkidle");
  await shot(s, "cust-detail", { title: "Detail pelanggan", caption: "Klik nama pelanggan di daftar. Menampilkan data kontak, ringkasan piutang, dan seluruh riwayat invoice pelanggan itu.", fit: true });

  // Edit & arsip (Finance Manager)
  const f = F.page;
  await f.goto(`${BASE}/customers`);
  await f.waitForLoadState("networkidle");
  const row = f.getByRole("row", { name: /PT Rasa Bersama/ });
  await row.getByRole("button", { name: "Edit" }).click();
  await f.waitForTimeout(250);
  await shot(f, "cust-edit", { title: "Mengubah pelanggan", caption: "Perubahan data pelanggan tidak mengubah invoice yang sudah terbit (nama pada invoice terbit adalah salinan beku).", dialog: true, marks: [{ at: f.getByRole("button", { name: "Simpan" }), text: "Simpan perubahan." }] });
  await f.getByRole("button", { name: "Batal" }).click();
  await row.getByRole("button", { name: "Arsipkan" }).click();
  await f.waitForTimeout(250);
  await shot(f, "cust-archive", { title: "Mengarsipkan pelanggan", caption: "Pelanggan yang tidak aktif diarsipkan (bukan dihapus). Riwayatnya tetap utuh dan dapat diaktifkan kembali lewat filter Status → Diarsipkan.", dialog: true, marks: [{ at: f.getByRole("button", { name: "Arsipkan" }).last(), text: "Konfirmasi pengarsipan." }] });
  await f.getByRole("button", { name: "Batal" }).click();
}
