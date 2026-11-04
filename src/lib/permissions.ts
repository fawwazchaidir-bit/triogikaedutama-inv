/**
 * Matriks hak akses (RBAC). Satu file, dapat ditinjau & diuji.
 *
 * PENTING: UI memakai ini hanya untuk menyembunyikan tombol. Penegakan sebenarnya ada di SERVICE LAYER
 * (`assertCan`) sehingga berlaku untuk setiap endpoint dan halaman server.
 *
 * Prinsip least privilege:
 *   ADMIN   — (pemilik) semua, termasuk pengguna, pengaturan, penomoran, pajak, audit log.
 *   FINANCE — Finance Manager: VERIFIKATOR/penyetuju invoice (setujui → terbit, kembalikan), melihat seluruh data invoice,
 *             satu-satunya yang membatalkan invoice terbit & membalikkan pembayaran, plus pembayaran, laporan, unduh PDF.
 *   Keuangan (basis kas): Administrator mengelola bagan akun/akun kas/saldo awal; Finance Manager mencatat, menyetujui, membalikkan,
 *             memfinalisasi rekonsiliasi bank, dan menutup buku.
 *   STAFF   — Staf Administrasi Keuangan (nilai enum tetap STAFF): menginput data invoice secara lengkap (termasuk harga/diskon/pajak) lalu
 *             MENGAJUKAN untuk diverifikasi; mencatat pembayaran; mencatat PENGELUARAN dan PENERIMAAN LAIN (keduanya menunggu persetujuan
 *             Finance Manager) serta TRANSFER antar akun; mengimpor rekening koran dan mencocokkannya (draft); dan MELIHAT seluruh laporan
 *             keuangan tanpa dapat mengubahnya. Beda dengan Finance Manager: TIDAK dapat menyetujui/menerbitkan/mengembalikan, membatalkan
 *             invoice terbit, membalikkan apa pun (otoritas koreksi), memfinalisasi/membuka rekonsiliasi bank, mencatat jurnal manual,
 *             setoran pajak, menutup buku, atau mengelola akun & pengaturan keuangan — dan tanpa dashboard.
 */

export type Role = "ADMIN" | "FINANCE" | "STAFF";

export const PERMISSIONS = [
  "dashboard:view",
  "customer:view",
  "customer:create",
  "customer:update",
  "customer:archive",
  "product:view",
  "product:manage",
  "invoice:view",          // semua invoice
  "invoice:view_own",      // hanya invoice buatan sendiri
  "invoice:create",        // buat/edit/hapus DRAFT & duplikasi
  "invoice:override_price",// ubah harga satuan / baris bebas (tanpa produk) / pajak per baris
  "invoice:discount",      // diskon baris & diskon tambahan
  "invoice:submit",        // ajukan draft untuk diverifikasi / tarik kembali pengajuan sendiri
  "invoice:approve",       // setujui & terbitkan (nomor, cap, tanda tangan) atau kembalikan ke staff
  "invoice:cancel",
  "invoice:pdf",           // pratinjau & unduh PDF invoice terbit
  "invoice:preview_draft", // pratinjau PDF draft (watermark DRAFT)
  "invoice:history",       // riwayat perubahan invoice
  "payment:view",
  "payment:record",
  "payment:reverse",
  "report:view",
  "audit:view",
  "settings:view",
  "settings:manage",
  "numbering:manage",
  "tax:manage",
  "user:manage",
  "finance:view",          // kas & bank, buku kas, seluruh pengeluaran, laporan keuangan (arus kas, laba rugi), bagan akun
  "finance:manage",        // bagan akun, akun kas/bank, saldo awal
  "cash:record",           // SEMUA entri kas non-pengeluaran (penerimaan lain, investasi, pendanaan, setoran pajak) — langsung berlaku bagi penyetuju
  "cash:receipt",          // hanya PENERIMAAN LAIN (uang masuk ke akun pendapatan lain-lain); bagi non-penyetuju entri menunggu persetujuan
  "cash:transfer",         // transfer antar akun kas/bank (langsung berlaku)
  "expense:record",        // mencatat pengeluaran (staff: menunggu persetujuan; penyetuju: langsung berlaku)
  "expense:view_own",      // melihat pengeluaran yang dicatat sendiri
  "expense:approve",       // menyetujui/menolak pengeluaran staff
  "expense:void",          // membalikkan entri kas/transfer/jurnal yang sudah berlaku (koreksi)
  "journal:record",        // mencatat jurnal manual (penyesuaian, penyusutan, saldo awal non-kas) — langsung berlaku
  "books:lock",            // menetapkan/membuka penutupan buku (transaksi ≤ tanggal tutup ditolak)
  "bank:reconcile",        // impor rekening koran, mencocokkan/melepas (draft), membuat entri dari mutasi, menghapus draft
  "bank:finalize",         // memfinalisasi / membuka kembali rekonsiliasi bank (otoritas Finance Manager)
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  ADMIN: new Set(ALL),
  FINANCE: new Set<Permission>([
    "dashboard:view",
    "customer:view", "customer:create", "customer:update", "customer:archive",
    "product:view",
    "invoice:view", "invoice:create", "invoice:override_price", "invoice:discount",
    "invoice:approve", "invoice:cancel", "invoice:pdf", "invoice:preview_draft", "invoice:history",
    "payment:view", "payment:record", "payment:reverse",
    "report:view",
    "settings:view",
    "finance:view", "cash:record", "cash:receipt", "cash:transfer", "expense:record", "expense:approve", "expense:void", "journal:record", "books:lock", "bank:reconcile", "bank:finalize",
  ]),
  // Staf Administrasi Keuangan = Finance Manager TANPA otoritas koreksi/persetujuan — approval (setujui/terbitkan/kembalikan),
  // pembatalan invoice terbit, pembalikan, finalisasi rekonsiliasi, jurnal manual, dan tutup buku tetap di tangan Finance Manager — serta TANPA
  // dashboard; sebagai gantinya staf dapat mengajukan invoice, mencatat penerimaan lain (menunggu persetujuan) & transfer, mengerjakan
  // rekonsiliasi bank sampai draft siap, dan melihat seluruh laporan keuangan (hanya baca). Mengedit/menghapus/mengajukan draft hanya untuk draft
  // miliknya sendiri (lihat `canEditDraft`).
  STAFF: new Set<Permission>([
    "customer:view", "customer:create", "customer:update", "customer:archive",
    "product:view",
    "invoice:view", "invoice:create", "invoice:override_price", "invoice:discount", "invoice:submit",
    "invoice:pdf", "invoice:preview_draft", "invoice:history",
    "payment:view", "payment:record",
    "report:view",
    "settings:view",
    "expense:record", "expense:view_own",
    "finance:view", "cash:receipt", "cash:transfer", "bank:reconcile",
  ]),
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].has(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  FINANCE: "Finance Manager",
  STAFF: "Staf Administrasi Keuangan",
};

/** Menu sidebar beserta izin (salah satu cukup) untuk melihatnya. */
export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", anyOf: ["dashboard:view"] },
  { href: "/invoices", label: "Invoice", anyOf: ["invoice:view", "invoice:view_own"] },
  { href: "/payments", label: "Pembayaran", anyOf: ["payment:view"] },
  { href: "/customers", label: "Pelanggan", anyOf: ["customer:view"] },
  { href: "/products", label: "Produk & Layanan", anyOf: ["product:view"] },
  { href: "/expenses", label: "Pengeluaran", anyOf: ["expense:record", "expense:view_own", "finance:view"] },
  { href: "/cash", label: "Kas & Bank", anyOf: ["finance:view"] },
  { href: "/journals", label: "Jurnal", anyOf: ["finance:view"] },
  { href: "/reconciliation", label: "Rekonsiliasi", anyOf: ["finance:view"] },
  { href: "/reports", label: "Laporan", anyOf: ["report:view"] },
  { href: "/statements", label: "Laporan Keuangan", anyOf: ["finance:view"] },
  { href: "/taxes", label: "Pajak", anyOf: ["finance:view"] },
  { href: "/closing", label: "Tutup Buku", anyOf: ["finance:view"] },
  { href: "/audit-log", label: "Audit Log", anyOf: ["audit:view"] },
  { href: "/settings", label: "Pengaturan", anyOf: ["settings:view"] },
] as const satisfies readonly { href: string; label: string; anyOf: readonly Permission[] }[];

export function visibleNav(role: Role | null | undefined) {
  return NAV_ITEMS.filter((i) => (i.anyOf as readonly Permission[]).some((p) => can(role, p)));
}
