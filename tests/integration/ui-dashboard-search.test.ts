import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { resetDb, seedFixtures, demiChefInput, type Fixtures } from "../helpers/db";
import { cancelInvoice, createDraft, issueInvoice, submitInvoice } from "@/server/services/invoices";
import { recordPayment } from "@/server/services/payments";
import { createEntry } from "@/server/services/cash-entries";
import { getDashboard } from "@/server/services/dashboard";
import { searchAll, SEARCH_LIMIT } from "@/server/services/search";
import { getNotifications } from "@/server/services/notifications";
import { DERIVED_STATUS_ORDER } from "@/lib/invoice-status";
import { todayIso } from "@/lib/format";
import { AppError } from "@/server/errors";

/**
 * UI Dashboard Keuangan: (1) sebaran status invoice harus SALING LEPAS (tiap invoice tepat satu status) dan konsisten dengan hitungan lama;
 * (2) pencarian global memakai fungsi daftar yang ada (izin & visibilitas sama) dan membatasi hasil per bagian;
 * (3) notifikasi lonceng = antrean kerja menurut izin.
 */
let fx: Fixtures;
let customerB: string;
const today = todayIso("Asia/Jakarta");
const daysAgo = (n: number) => new Date(Date.parse(today) - n * 86_400_000).toISOString().slice(0, 10);
const err = async (p: Promise<unknown>) => (await p.then(() => null, (e: unknown) => e)) as AppError;

async function issued(over: Record<string, unknown> = {}, customerId = fx.customerId) {
  const d = await createDraft(fx.finance, demiChefInput(fx, { customerId, invoiceDate: today, paymentTermDays: 30, ...over }));
  return issueInvoice(fx.finance, d.id);
}
const pay = (invoiceId: string, amount: number, extra: Record<string, unknown> = {}) =>
  recordPayment(fx.finance, { invoiceId, paymentDate: today, amount, method: "Transfer", reference: "R", ...extra });

beforeEach(async () => {
  await resetDb();
  fx = await seedFixtures({ finance: true });
  const b = await prisma.customer.create({ data: { name: "PT Beta Mandiri", normalizedName: "beta mandiri", cityKey: "", createdById: fx.admin.userId } });
  customerB = b.id;
});

describe("dashboard — sebaran status invoice saling lepas", () => {
  async function build() {
    const A = await issued();                                           // belum dibayar, belum jatuh tempo
    const B = await issued(); await pay(B.id, 5_000_000);               // sebagian
    const C = await issued(); await pay(C.id, 14_000_000);              // lunas
    const D = await issued({ invoiceDate: daysAgo(20), paymentTermDays: 4 });            // jatuh tempo, belum dibayar
    const E = await issued({ invoiceDate: daysAgo(20), paymentTermDays: 4 }); await pay(E.id, 3_000_000); // jatuh tempo + sebagian
    const X = await issued(); await cancelInvoice(fx.finance, X.id, { reason: "Salah input" });  // batal
    await createDraft(fx.finance, demiChefInput(fx, { invoiceDate: today }));                      // draft
    const S = await createDraft(fx.staff, demiChefInput(fx, { invoiceDate: today })); await submitInvoice(fx.staff, S.id); // menunggu verifikasi
    return { A, B, C, D, E, X };
  }
  const period = () => ({ from: daysAgo(25), to: today });

  it("setiap invoice tepat satu status: jatuh tempo didahulukan atas belum dibayar/sebagian; jumlah baris = seluruh invoice pada periode", async () => {
    await build();
    const d = await getDashboard(fx.finance, period());
    expect(d.statuses.map((s) => s.key)).toEqual([...DERIVED_STATUS_ORDER]);
    const by = Object.fromEntries(d.statuses.map((s) => [s.key, s]));
    expect(by.UNPAID).toEqual({ key: "UNPAID", count: 1, amount: 14_000_000 });
    expect(by.PARTIAL).toEqual({ key: "PARTIAL", count: 1, amount: 14_000_000 });
    expect(by.PAID).toEqual({ key: "PAID", count: 1, amount: 14_000_000 });
    expect(by.OVERDUE).toEqual({ key: "OVERDUE", count: 2, amount: 28_000_000 }); // nilai invoice (bukan sisa tagihan)
    expect(by.PENDING!.count).toBe(1);
    expect(by.DRAFT!.count).toBe(1);
    expect(by.CANCELLED).toEqual({ key: "CANCELLED", count: 1, amount: 14_000_000 });

    const total = d.statuses.reduce((a, s) => a + s.count, 0);
    expect(total).toBe(8);
    expect(total).toBe(await prisma.invoice.count()); // tidak ada invoice yang hilang atau terhitung ganda
  });

  it("konsisten dengan hitungan lama: sisa tagihan jatuh tempo memakai saldo, bukan nilai invoice", async () => {
    await build();
    const d = await getDashboard(fx.finance, period());
    expect(d.overdueCount).toBe(2);
    expect(d.overdueAmount).toBe(14_000_000 + 11_000_000); // D utuh + E sisa 11 jt
    // hitungan lama: Belum dibayar / Sebagian mencakup yang jatuh tempo (tumpang tindih disengaja agar tautan daftar tetap cocok)
    expect(d.unpaidCount).toBe(2);   // A + D
    expect(d.partialCount).toBe(2);  // B + E
    expect(d.paidCount).toBe(1);
    expect(d.statuses.find((s) => s.key === "UNPAID")!.count + d.statuses.find((s) => s.key === "OVERDUE")!.count).toBeGreaterThanOrEqual(d.unpaidCount);
  });

  it("filter pelanggan menyaring seluruh sebaran; periode kosong → semua 0", async () => {
    await build();
    await issued({}, customerB);
    const b = await getDashboard(fx.finance, { ...period(), customerId: customerB });
    expect(b.statuses.reduce((a, s) => a + s.count, 0)).toBe(1);
    expect(b.statuses.find((s) => s.key === "UNPAID")!.count).toBe(1);

    const empty = await getDashboard(fx.finance, { from: "2000-01-01", to: "2000-12-31" });
    expect(empty.statuses.every((s) => s.count === 0 && s.amount === 0)).toBe(true);
  });
});

describe("pencarian global", () => {
  it("kata kunci < 2 karakter tidak menjalankan pencarian; > 80 karakter ditolak", async () => {
    for (const q of ["", " ", "a"]) {
      const r = await searchAll(fx.finance, { q });
      expect(r).toMatchObject({ tooShort: true, invoices: null, customers: null, payments: null, entries: null });
    }
    expect((await err(searchAll(fx.finance, { q: "x".repeat(81) }))).status).toBe(422);
  });

  it("menemukan invoice (nomor/pelanggan), pelanggan, pembayaran (referensi), dan entri kas", async () => {
    const a = await issued();
    const b = await issued({}, customerB);
    await pay(b.id, 1_000_000, { reference: "TRX-ALPHA-77" });
    await createEntry(fx.finance, { entryDate: today, cashAccountId: fx.bankAcctId, counterAccountId: fx.coa["5-1100"], amount: 250_000, description: "Honor asesor uji pencarian" });

    const byNumber = await searchAll(fx.finance, { q: a.number! });
    expect(byNumber.invoices!.items.map((i) => i.id)).toContain(a.id);

    const byCustomer = await searchAll(fx.finance, { q: "beta mandiri" });
    expect(byCustomer.customers!.total).toBe(1);
    expect(byCustomer.invoices!.items.map((i) => i.id)).toEqual([b.id]);

    const byRef = await searchAll(fx.finance, { q: "TRX-ALPHA" });
    expect(byRef.payments!.total).toBe(1);
    expect(byRef.payments!.items[0]!.invoiceId).toBe(b.id);

    const byEntry = await searchAll(fx.finance, { q: "asesor uji" });
    expect(byEntry.entries!.total).toBe(1);
    expect(byEntry.entries!.items[0]!.description).toContain("Honor asesor");

    const none = await searchAll(fx.finance, { q: "tidak-ada-yang-cocok" });
    expect([none.invoices, none.customers, none.payments, none.entries].every((s) => s!.total === 0)).toBe(true);
  });

  it("hasil per bagian dibatasi SEARCH_LIMIT, total tetap jumlah sebenarnya (untuk tautan 'Lihat semua')", async () => {
    for (let i = 0; i < SEARCH_LIMIT + 2; i++) await createDraft(fx.finance, demiChefInput(fx, { customerId: customerB, invoiceDate: today }));
    const r = await searchAll(fx.finance, { q: "Beta Mandiri" });
    expect(r.invoices!.items).toHaveLength(SEARCH_LIMIT);
    expect(r.invoices!.total).toBe(SEARCH_LIMIT + 2);
  });

  it("semua peran yang bisa masuk mendapat bagian yang sesuai izinnya (staf: tanpa dashboard tetap bisa mencari)", async () => {
    await issued();
    for (const a of [fx.admin, fx.finance, fx.staff]) {
      const r = await searchAll(a, { q: "Demi" });
      expect(r.tooShort).toBe(false);
      expect(r.customers).not.toBeNull();
    }
  });
});

describe("notifikasi lonceng", () => {
  const ids = async (a: typeof fx.finance) => (await getNotifications(a)).map((n) => n.id).sort();

  it("kosong bila tidak ada pekerjaan menunggu", async () => {
    for (const a of [fx.admin, fx.finance, fx.staff]) expect(await getNotifications(a)).toEqual([]);
  });

  it("invoice diajukan → hanya penyetuju (Finance/Admin) yang diberi tahu; staf pengaju tidak", async () => {
    const d = await createDraft(fx.staff, demiChefInput(fx, { invoiceDate: today }));
    await submitInvoice(fx.staff, d.id);
    const n = (await getNotifications(fx.finance)).find((x) => x.id === "invoice-submitted")!;
    expect(n).toMatchObject({ count: 1, tone: "amber", href: "/invoices?status=SUBMITTED" });
    expect(await ids(fx.admin)).toContain("invoice-submitted");
    expect(await ids(fx.staff)).not.toContain("invoice-submitted");
  });

  it("pengeluaran staf menunggu persetujuan → penyetuju diberi tahu; pencatat sendiri tidak (tidak bisa menyetujui sendiri)", async () => {
    await createEntry(fx.staff, { entryDate: today, cashAccountId: fx.bankAcctId, counterAccountId: fx.coa["5-1100"], amount: 300_000, description: "Honor menunggu" });
    expect((await getNotifications(fx.finance)).find((x) => x.id === "entry-pending")).toMatchObject({ count: 1, href: "/expenses?status=PENDING" });
    expect(await ids(fx.staff)).not.toContain("entry-pending");
    // entri finance sendiri langsung berlaku → tidak menambah antrean
    await createEntry(fx.finance, { entryDate: today, cashAccountId: fx.bankAcctId, counterAccountId: fx.coa["5-1100"], amount: 100_000, description: "Langsung berlaku" });
    expect((await getNotifications(fx.finance)).find((x) => x.id === "entry-pending")!.count).toBe(1);
  });

  it("invoice jatuh tempo belum lunas: jumlah & total sisa; lunas/baru tidak dihitung", async () => {
    await issued();                                                              // belum jatuh tempo
    await issued({ paymentTermDays: 0 });                                        // jatuh tempo HARI INI → belum terlambat (terlambat = jatuh tempo < hari ini)
    const late = await issued({ invoiceDate: daysAgo(20), paymentTermDays: 4 }); // jatuh tempo
    const paid = await issued({ invoiceDate: daysAgo(20), paymentTermDays: 4 }); await pay(paid.id, 14_000_000);
    await pay(late.id, 4_000_000);
    const n = (await getNotifications(fx.finance)).find((x) => x.id === "invoice-overdue")!;
    expect(n.count).toBe(1);
    expect(n.tone).toBe("red");
    expect(n.detail).toContain("10.000.000");
    expect(n.href).toBe("/invoices?paymentStatus=OVERDUE");
  });
});
