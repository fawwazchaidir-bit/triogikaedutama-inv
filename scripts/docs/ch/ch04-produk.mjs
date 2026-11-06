import { shot, BASE } from "../lib.mjs";

export async function run({ S }) {
  const s = S.page;
  await s.goto(`${BASE}/products`);
  await s.waitForLoadState("networkidle");
  await shot(s, "prod-list", {
    title: "Produk & Layanan (katalog)", caption: "Katalog yang dipilih saat membuat invoice. Pelaksana dan Finance Manager dapat MELIHAT; penambahan/perubahan produk dilakukan Administrator.", fit: true,
    marks: [
      { at: s.getByLabel(/^Cari/), text: "Cari kode atau nama produk." },
      { at: s.getByRole("columnheader", { name: "HARGA DEFAULT" }), text: "Harga default terisi otomatis di baris invoice (dapat diubah oleh yang berwenang)." },
      { at: s.getByRole("columnheader", { name: "PAJAK" }), text: "Pajak bawaan produk (non-PKP: umumnya “Tanpa pajak”)." },
    ],
  });
}
