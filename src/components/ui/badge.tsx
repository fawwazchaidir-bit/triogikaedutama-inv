import { cn } from "@/lib/cn";
import { DERIVED_STATUS_LABEL, type DerivedStatus } from "@/lib/invoice-status";

type Tone = "gray" | "green" | "amber" | "red" | "blue" | "purple" | "dark";

const TONES: Record<Tone, string> = {
  gray: "bg-stone-100 text-stone-700 ring-stone-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-brand-50 text-brand-700 ring-brand-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  purple: "bg-violet-100 text-violet-800 ring-violet-200",
  dark: "bg-ink text-surface ring-ink",
};

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", TONES[tone], className)}>
      {children}
    </span>
  );
}

export type InvoiceStatus = "DRAFT" | "SUBMITTED" | "ISSUED" | "CANCELLED";
export type PaymentStatusValue = "UNPAID" | "PARTIALLY_PAID" | "PAID";

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, [Tone, string]> = {
    DRAFT: ["gray", "Draft"],
    SUBMITTED: ["purple", "Menunggu Verifikasi"],
    ISSUED: ["blue", "Diterbitkan"],
    CANCELLED: ["dark", "Dibatalkan"],
  };
  const [tone, label] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

/** `overdue` diturunkan dari jatuh tempo + saldo (tidak disimpan). */
export function PaymentStatusBadge({ status, overdue, invoiceStatus }: { status: PaymentStatusValue; overdue?: boolean; invoiceStatus?: InvoiceStatus }) {
  if (invoiceStatus && invoiceStatus !== "ISSUED") return <span className="text-muted">—</span>;
  if (overdue && status !== "PAID") {
    return <Badge tone="red">{status === "PARTIALLY_PAID" ? "Jatuh Tempo · Sebagian" : "Jatuh Tempo"}</Badge>;
  }
  const map: Record<PaymentStatusValue, [Tone, string]> = {
    UNPAID: ["red", "Belum Dibayar"],
    PARTIALLY_PAID: ["amber", "Dibayar Sebagian"],
    PAID: ["green", "Lunas"],
  };
  const [tone, label] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export const DERIVED_TONE: Record<DerivedStatus, Tone> = { UNPAID: "red", PARTIAL: "amber", PAID: "green", OVERDUE: "red", PENDING: "purple", DRAFT: "gray", CANCELLED: "dark" };

/** Lencana status tunggal (saling lepas) untuk dashboard. */
export function DerivedStatusBadge({ status, className }: { status: DerivedStatus; className?: string }) {
  return <Badge tone={DERIVED_TONE[status]} className={className}>{DERIVED_STATUS_LABEL[status]}</Badge>;
}
