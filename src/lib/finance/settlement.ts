/**
 * Tanggal pelunasan invoice: tanggal pembayaran terakhir di antara pembayaran yang MASIH BERLAKU (bukan pembalikan dan belum dibalik).
 * Dipakai untuk keterangan "LUNAS" pada PDF. Fungsi murni; pemanggil memastikan invoice memang berstatus lunas.
 */
export interface SettlementPayment { id: string; entryType: "PAYMENT" | "REVERSAL"; reversesPaymentId: string | null; date: string }

export function settlementDate(payments: SettlementPayment[]): string | null {
  const reversed = new Set(payments.filter((p) => p.entryType === "REVERSAL" && p.reversesPaymentId).map((p) => p.reversesPaymentId!));
  const active = payments.filter((p) => p.entryType === "PAYMENT" && !reversed.has(p.id));
  return active.length === 0 ? null : active.reduce((max, p) => (p.date > max ? p.date : max), active[0]!.date);
}
