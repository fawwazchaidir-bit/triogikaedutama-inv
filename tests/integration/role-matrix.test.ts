import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { resetDb, seedFixtures, demiChefInput, type Fixtures } from "../helpers/db";
import type { Actor } from "@/server/actor";
import { cancelInvoice, createDraft, issueInvoice, submitInvoice } from "@/server/services/invoices";
import { recordPayment, reversePayment } from "@/server/services/payments";
import { approveEntry, createEntry, createTransfer, rejectEntry, reverseEntry, reverseTransfer } from "@/server/services/cash-entries";
import { createCashAccount, listCashAccounts } from "@/server/services/cash-accounts";
import { createCoaAccount } from "@/server/services/finance-coa";
import { createJournal, reverseJournal } from "@/server/services/journals";
import { getTrialBalance } from "@/server/services/finance-ledger";
import { getTaxOverview, recordTaxPayment, updateTaxProfile } from "@/server/services/finance-tax";
import { closePeriod, listPeriods, reopenPeriod } from "@/server/services/periods";
import { autoMatchStatement, createStatement, finalizeStatement, getReconOverview, matchLine, reopenStatement, unmatchLine } from "@/server/services/bank-reconciliation";
import { runStatement } from "@/server/services/finance-statements";
import { getDashboard } from "@/server/services/dashboard";
import { ROLE_PERMISSIONS, type Permission } from "@/lib/permissions";
import { AppError } from "@/server/errors";

/**
 * MATRIKS PERAN × AKSI (tingkat service) — satu tabel yang mudah ditinjau pemilik bisnis.
 * "Diizinkan" = TIDAK ditolak FORBIDDEN (hasil lain — validasi, konflik, tak ditemukan — berarti otorisasi lolos).
 * Staf Administrasi Keuangan (STAFF): mencatat pengeluaran/penerimaan lain/transfer & mengerjakan rekonsiliasi draft, melihat semua laporan;
 * seluruh persetujuan, koreksi, finalisasi, jurnal, setoran pajak, tutup buku, dan pengelolaan akun tetap di Finance Manager/Administrator.
 */
const err = async (p: Promise<unknown>) => (await p.then(() => null, (e: unknown) => e)) as AppError | null;
let fx: Fixtures;
const c = (code: string) => fx.coa[code]!;
beforeEach(async () => {
  await resetDb();
  fx = await seedFixtures({ finance: true, openingDate: "2026-01-01" });
});
afterAll(async () => { await prisma.$disconnect(); });

const RANDOM = "00000000-0000-4000-8000-000000000001";
const base = { entryDate: "2026-03-09", cashAccountId: "", amount: 10_000, description: "Uji matriks peran" };
const entryIn = (a: Actor, counter: string, direction: "IN" | "OUT") => createEntry(a, { ...base, cashAccountId: fx.bankAcctId, counterAccountId: c(counter), direction });
const approvedEntry = async () => entryIn(fx.finance, "6-1300", "OUT");
const pendingEntry = async () => entryIn(fx.staff2, "6-1300", "OUT");
const journalBody = () => ({ journalDate: "2026-03-09", description: "Uji matriks peran", lines: [{ accountId: c("6-2000"), debit: 10, credit: 0 }, { accountId: c("1-2900"), debit: 0, credit: 10 }] });
const issuedInvoice = async () => issueInvoice(fx.finance, (await createDraft(fx.finance, demiChefInput(fx, { invoiceDate: "2026-03-02", paymentTermDays: 30 }))).id);

type Who = "admin" | "finance" | "staff";
interface Case { name: string; run: (a: Actor) => Promise<unknown>; allow: Who[] }
const ALL: Who[] = ["admin", "finance", "staff"], FIN: Who[] = ["admin", "finance"], ADM: Who[] = ["admin"];

const CASES: Case[] = [
  // ── mencatat ──
  { name: "catat pengeluaran (beban)", run: (a) => entryIn(a, "6-1300", "OUT"), allow: ALL },
  { name: "catat penerimaan lain (pendapatan lain-lain)", run: (a) => entryIn(a, "4-2200", "IN"), allow: ALL },
  { name: "catat modal / pendanaan", run: (a) => entryIn(a, "3-1100", "IN"), allow: FIN },
  { name: "catat investasi (pembelian aset)", run: (a) => entryIn(a, "1-2100", "OUT"), allow: FIN },
  { name: "catat prive", run: (a) => entryIn(a, "3-1200", "OUT"), allow: FIN },
  { name: "transfer antar akun", run: (a) => createTransfer(a, { transferDate: "2026-03-09", fromAccountId: fx.bankAcctId, toAccountId: fx.cashAcctId, amount: 1000 }), allow: ALL },
  { name: "catat pembayaran invoice", run: async (a) => recordPayment(a, { invoiceId: (await issuedInvoice()).id, paymentDate: "2026-03-05", amount: 1_000_000, method: "Transfer" }), allow: ALL },
  { name: "setoran pajak", run: (a) => recordTaxPayment(a, { kind: "PPN", taxPeriod: "2026-02", entryDate: "2026-03-09", cashAccountId: fx.bankAcctId, amount: 1000, reference: "NTPN-MATRIKS" }), allow: FIN },
  { name: "jurnal manual", run: (a) => createJournal(a, journalBody()), allow: FIN },
  // ── persetujuan & koreksi ──
  { name: "setujui pengeluaran/penerimaan", run: async (a) => approveEntry(a, (await pendingEntry()).id), allow: FIN },
  { name: "tolak pengeluaran/penerimaan", run: async (a) => rejectEntry(a, (await pendingEntry()).id, { reason: "Uji matriks peran" }), allow: FIN },
  { name: "balikkan entri kas", run: async (a) => reverseEntry(a, (await approvedEntry()).id, { reason: "Uji matriks peran" }), allow: FIN },
  { name: "balikkan transfer", run: async (a) => reverseTransfer(a, (await createTransfer(fx.finance, { transferDate: "2026-03-09", fromAccountId: fx.bankAcctId, toAccountId: fx.cashAcctId, amount: 1000 })).id, { reason: "Uji matriks peran" }), allow: FIN },
  { name: "balikkan jurnal", run: async (a) => reverseJournal(a, (await createJournal(fx.finance, journalBody())).id, { reason: "Uji matriks peran" }), allow: FIN },
  { name: "balikkan pembayaran invoice", run: async (a) => { const inv = await issuedInvoice(); const p = await recordPayment(fx.finance, { invoiceId: inv.id, paymentDate: "2026-03-05", amount: 1_000_000, method: "Transfer" }); return reversePayment(a, p.id, { reason: "Uji matriks peran" }); }, allow: FIN },
  { name: "terbitkan invoice (approval)", run: async (a) => { const d = await createDraft(fx.staff2, demiChefInput(fx)); await submitInvoice(fx.staff2, d.id); return issueInvoice(a, d.id); }, allow: FIN },
  { name: "batalkan invoice terbit", run: async (a) => cancelInvoice(a, (await issuedInvoice()).id, { reason: "Uji matriks peran" }), allow: FIN },
  // ── rekonsiliasi bank ──
  { name: "rekonsiliasi: impor/buat rekening koran (draft)", run: (a) => createStatement(a, {}), allow: ALL },
  { name: "rekonsiliasi: cocokkan otomatis / manual / lepas", run: async (a) => { const r = [await err(autoMatchStatement(a, RANDOM)), await err(matchLine(a, RANDOM, { items: [] })), await err(unmatchLine(a, RANDOM))]; const f = r.find((e) => e?.code === "FORBIDDEN"); if (f) throw f; return r; }, allow: ALL },
  { name: "rekonsiliasi: finalisasi", run: (a) => finalizeStatement(a, RANDOM), allow: FIN },
  { name: "rekonsiliasi: buka kembali", run: (a) => reopenStatement(a, RANDOM, { reason: "Uji matriks peran" }), allow: FIN },
  // ── tutup buku, pajak, pengaturan ──
  { name: "tutup bulan", run: (a) => closePeriod(a, { year: 2026, month: 1, acknowledge: [], note: "Uji matriks peran" }), allow: FIN },
  { name: "buka kembali periode", run: (a) => reopenPeriod(a, { year: 2026, month: 1, reason: "Uji matriks peran" }), allow: FIN },
  { name: "ubah profil pajak", run: (a) => updateTaxProfile(a, { isPkp: true, regime: "NONE", rateBps: null }), allow: ADM },
  { name: "kelola bagan akun", run: (a) => createCoaAccount(a, { code: "6-5100", name: "Beban Uji", type: "BEBAN", manualEntry: true }), allow: ADM },
  { name: "kelola akun kas/bank & saldo awal", run: (a) => createCashAccount(a, { name: "Kas Uji", kind: "KAS", coaAccountId: c("1-1100"), openingBalance: 1, openingDate: "2026-01-01" }), allow: ADM },
  // ── melihat ──
  { name: "lihat Kas & Bank", run: (a) => listCashAccounts(a), allow: ALL },
  { name: "lihat laporan keuangan (laba rugi/neraca/arus kas)", run: async (a) => { await runStatement(a, "income-statement", {}); await runStatement(a, "balance-sheet", {}); return runStatement(a, "cash-flow", {}); }, allow: ALL },
  { name: "lihat neraca saldo", run: (a) => getTrialBalance(a), allow: ALL },
  { name: "lihat periode tutup buku", run: (a) => listPeriods(a), allow: ALL },
  { name: "lihat rekap pajak", run: (a) => getTaxOverview(a), allow: ALL },
  { name: "lihat rekonsiliasi bank", run: (a) => getReconOverview(a), allow: ALL },
  { name: "dashboard", run: (a) => getDashboard(a, { from: "2026-01-01", to: "2026-03-31" }), allow: FIN },
];

describe("matriks peran × aksi", () => {
  for (const cs of CASES) {
    it(`${cs.name}: ${cs.allow.join(", ")} boleh; selainnya FORBIDDEN`, async () => {
      const actors: Record<Who, Actor> = { admin: fx.admin, finance: fx.finance, staff: fx.staff };
      for (const who of ["admin", "finance", "staff"] as Who[]) {
        const e = await err(cs.run(actors[who]));
        const forbidden = e?.code === "FORBIDDEN";
        expect(forbidden, `${cs.name} / ${who}: ${e ? `${e.code} ${e.message}` : "sukses"}`).toBe(!cs.allow.includes(who));
      }
    });
  }

  it("hasil pencatatan staf: pengeluaran & penerimaan lain MENUNGGU persetujuan (Finance langsung berlaku); hanya Finance yang dapat menyetujui", async () => {
    const [sExp, sInc, fExp, fInc] = await Promise.all([entryIn(fx.staff, "6-1300", "OUT"), entryIn(fx.staff, "4-2200", "IN"), entryIn(fx.finance, "6-1300", "OUT"), entryIn(fx.finance, "4-2200", "IN")]);
    expect([sExp.status, sInc.status, fExp.status, fInc.status]).toEqual(["PENDING", "PENDING", "APPROVED", "APPROVED"]);
    // staf tidak dapat menyetujui entrinya sendiri maupun milik staf lain
    expect((await err(approveEntry(fx.staff, sInc.id)))?.code).toBe("FORBIDDEN");
    expect((await err(approveEntry(fx.staff2, sInc.id)))?.code).toBe("FORBIDDEN");
    // Finance menyetujui → baru masuk saldo
    const before = (await listCashAccounts(fx.finance)).find((a) => a.id === fx.bankAcctId)!.balance;
    await approveEntry(fx.finance, sInc.id);
    expect((await listCashAccounts(fx.finance)).find((a) => a.id === fx.bankAcctId)!.balance).toBe(before + 10_000);
  });

  it("penegakan di service tidak bergantung pada nama peran: tanpa izin cash:receipt, pencatat tidak dapat mencatat penerimaan lain walau boleh mencatat pengeluaran", async () => {
    const set = ROLE_PERMISSIONS.STAFF as Set<Permission>;
    set.delete("cash:receipt");
    try {
      expect((await err(entryIn(fx.staff, "4-2200", "IN")))?.code).toBe("FORBIDDEN");
      expect((await err(entryIn(fx.staff, "6-1300", "OUT")))).toBeNull(); // pengeluaran tetap boleh
      expect((await err(createTransfer(fx.staff, { transferDate: "2026-03-09", fromAccountId: fx.bankAcctId, toAccountId: fx.cashAcctId, amount: 1000 })))).toBeNull();
      set.delete("cash:transfer");
      expect((await err(createTransfer(fx.staff, { transferDate: "2026-03-09", fromAccountId: fx.bankAcctId, toAccountId: fx.cashAcctId, amount: 1000 })))?.code).toBe("FORBIDDEN");
    } finally { set.add("cash:receipt"); set.add("cash:transfer"); }
    expect((await err(entryIn(fx.staff, "4-2200", "IN")))).toBeNull(); // pulih
  });
});
