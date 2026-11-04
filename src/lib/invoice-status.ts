/**
 * Status tampilan invoice yang SALING LEPAS (satu invoice = satu status), dipakai dashboard:
 *  Menunggu verifikasi / Draft / Dibatalkan (menurut status dokumen) dan, untuk invoice terbit, Belum dibayar / Sebagian / Lunas / Jatuh tempo.
 * "Jatuh tempo" didahulukan atas "Belum dibayar" & "Sebagian" (invoice terlambat dihitung SEKALI, tidak ganda).
 */
export type DerivedStatus = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE" | "PENDING" | "DRAFT" | "CANCELLED";

export const DERIVED_STATUS_ORDER: readonly DerivedStatus[] = ["UNPAID", "PARTIAL", "PAID", "OVERDUE", "PENDING", "DRAFT", "CANCELLED"];

export const DERIVED_STATUS_LABEL: Record<DerivedStatus, string> = {
  UNPAID: "Belum dibayar", PARTIAL: "Sebagian", PAID: "Lunas", OVERDUE: "Jatuh tempo", PENDING: "Menunggu verifikasi", DRAFT: "Draft", CANCELLED: "Dibatalkan",
};

export function derivedStatus(inv: { status: "DRAFT" | "SUBMITTED" | "ISSUED" | "CANCELLED"; paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID"; isOverdue: boolean }): DerivedStatus {
  if (inv.status === "DRAFT") return "DRAFT";
  if (inv.status === "SUBMITTED") return "PENDING";
  if (inv.status === "CANCELLED") return "CANCELLED";
  if (inv.paymentStatus === "PAID") return "PAID";
  if (inv.isOverdue) return "OVERDUE";
  return inv.paymentStatus === "PARTIALLY_PAID" ? "PARTIAL" : "UNPAID";
}
