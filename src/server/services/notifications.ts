import "server-only";
import { prisma } from "../db";
import { env } from "../env";
import { actorCan, type Actor } from "../actor";
import { isoToDate } from "../json";
import { todayIso } from "@/lib/format";
import { formatRupiah } from "@/lib/finance/money";
import type { NotificationItem } from "@/lib/notifications";

/**
 * Notifikasi lonceng = antrean pekerjaan menurut IZIN pengguna, dihitung dari data (hanya hitungan ringan; tidak ada tabel notifikasi
 * yang bisa basi). Butir bernilai 0 tidak ditampilkan; titik merah pada lonceng muncul bila ada butir.
 */
export async function getNotifications(actor: Actor): Promise<NotificationItem[]> {
  const today = isoToDate(todayIso(env().APP_TIMEZONE));
  const tasks: Promise<NotificationItem | null>[] = [];
  const add = (fn: () => Promise<NotificationItem | null>) => { tasks.push(fn()); };

  if (actorCan(actor, "invoice:approve")) {
    add(async () => {
      const n = await prisma.invoice.count({ where: { status: "SUBMITTED" } });
      return n ? { id: "invoice-submitted", label: "invoice menunggu verifikasi Anda", count: n, href: "/invoices?status=SUBMITTED", tone: "amber" } : null;
    });
  }
  if (actorCan(actor, "expense:approve")) {
    add(async () => {
      const n = await prisma.cashEntry.count({ where: { status: "PENDING", createdById: { not: actor.userId } } }); // milik sendiri tidak dapat disetujui sendiri
      return n ? { id: "entry-pending", label: "pengeluaran / penerimaan menunggu persetujuan", count: n, href: "/expenses?status=PENDING", tone: "amber" } : null;
    });
  }
  if (actorCan(actor, "invoice:view") && actorCan(actor, "payment:view")) {
    add(async () => {
      const a = await prisma.invoice.aggregate({ where: { status: "ISSUED", balanceAmount: { gt: 0n }, dueDate: { lt: today } }, _count: { _all: true }, _sum: { balanceAmount: true } });
      return a._count._all ? { id: "invoice-overdue", label: "invoice jatuh tempo belum lunas", count: a._count._all, detail: formatRupiah(Number(a._sum.balanceAmount ?? 0n), "PLAIN"), href: "/invoices?paymentStatus=OVERDUE", tone: "red" } : null;
    });
  }
  if (actorCan(actor, "finance:view")) {
    add(async () => {
      const n = await prisma.payment.count({ where: { entryType: "PAYMENT", cashAccountId: null } });
      return n ? { id: "payment-unallocated", label: "pembayaran belum dialokasikan ke kas/bank", count: n, href: "/cash", tone: "amber" } : null;
    });
    add(async () => {
      const n = await prisma.payment.count({ where: { entryType: "PAYMENT", withholdingAmount: { gt: 0n }, withholdingRef: null } });
      return n ? { id: "withholding-ref", label: "pembayaran PPh dipotong belum ada nomor bukti potong", count: n, href: "/taxes?tab=pph23", tone: "blue" } : null;
    });
  }
  return (await Promise.all(tasks)).filter((x): x is NotificationItem => x !== null);
}
