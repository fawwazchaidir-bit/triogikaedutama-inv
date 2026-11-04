import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requirePagePermission } from "@/server/auth/current";
import { SEARCH_MIN, searchAll } from "@/server/services/search";
import { AppError } from "@/server/errors";
import { Card, CardHeader, EmptyState, Notice, PageHeader } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/ui/badge";
import { buildQuery } from "@/lib/invoice-can";
import { formatRupiah } from "@/lib/finance/money";
import { formatDateShort } from "@/lib/format";

export const metadata: Metadata = { title: "Pencarian" };
export const dynamic = "force-dynamic";

const R = (n: number) => formatRupiah(n, "PLAIN");

function Section({ title, total, shown, all, children }: { title: string; total: number; shown: number; all: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4">
      <CardHeader title={`${title} (${total})`} actions={total > shown ? <Link href={all} className="text-sm font-medium text-accent hover:underline">Lihat semua {total} →</Link> : undefined} />
      <ul className="divide-y divide-line">{children}</ul>
    </Card>
  );
}
const row = "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 text-sm hover:bg-hover";

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission(["invoice:view", "invoice:view_own", "customer:view", "payment:view", "finance:view"]);
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";
  let error: string | null = null;
  let res: Awaited<ReturnType<typeof searchAll>> | null = null;
  try { res = await searchAll(user, { q }); } catch (e) { if (e instanceof AppError) error = e.message; else throw e; }
  const none = res && !res.tooShort && [res.invoices, res.customers, res.payments, res.entries].every((s) => !s || s.total === 0);

  return (
    <div>
      <PageHeader title="Pencarian" description="Cari lintas invoice, pelanggan, pembayaran, dan entri kas. Hasil mengikuti hak akses Anda." />
      <form action="/search" role="search" className="mb-5">
        <label htmlFor="search-page-q" className="sr-only">Kata kunci</label>
        <div className="relative max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <input id="search-page-q" name="q" type="search" defaultValue={q} maxLength={80} autoFocus={!q} placeholder="Nomor invoice, nama pelanggan, referensi transfer…"
            className="h-12 w-full rounded-full border border-line bg-field pl-12 pr-4 text-[15px] text-ink placeholder:text-muted/70 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20" />
        </div>
      </form>

      {error && <Notice tone="danger">{error}</Notice>}
      {res?.tooShort && <Notice tone="info">{q.length === 0 ? "Ketik kata kunci untuk mulai mencari." : `Kata kunci minimal ${SEARCH_MIN} karakter.`}</Notice>}
      {none && <Card><EmptyState title={`Tidak ada hasil untuk “${q}”`} description="Coba nomor invoice (mis. 00434), sebagian nama pelanggan, atau nomor referensi transfer." /></Card>}

      {res?.invoices && res.invoices.total > 0 && (
        <Section title="Invoice" total={res.invoices.total} shown={res.invoices.items.length} all={`/invoices${buildQuery({ q })}`}>
          {res.invoices.items.map((i) => (
            <li key={i.id}><Link href={`/invoices/${i.id}`} className={row}>
              <span className="min-w-0"><span className="font-mono font-semibold text-accent">{i.number ?? "DRAFT"}</span> <span className="ml-2">{i.customerName}</span></span>
              <span className="flex items-center gap-3"><span className="text-muted">{formatDateShort(i.invoiceDate)}</span><span className="tabular font-medium">{R(i.totalAmount)}</span><InvoiceStatusBadge status={i.status} /></span>
            </Link></li>
          ))}
        </Section>
      )}
      {res?.customers && res.customers.total > 0 && (
        <Section title="Pelanggan" total={res.customers.total} shown={res.customers.items.length} all={`/customers${buildQuery({ q })}`}>
          {res.customers.items.map((c) => (
            <li key={c.id}><Link href={`/customers/${c.id}`} className={row}>
              <span className="min-w-0 font-medium">{c.name}<span className="ml-2 font-normal text-muted">{[c.city, c.contactName].filter(Boolean).join(" · ")}</span></span>
              <span className="text-muted">{c.invoiceCount} invoice · piutang <span className="tabular text-ink">{R(c.outstandingAmount)}</span></span>
            </Link></li>
          ))}
        </Section>
      )}
      {res?.payments && res.payments.total > 0 && (
        <Section title="Pembayaran" total={res.payments.total} shown={res.payments.items.length} all={`/payments${buildQuery({ q })}`}>
          {res.payments.items.map((p) => (
            <li key={p.id}><Link href={`/invoices/${p.invoiceId}`} className={row}>
              <span className="min-w-0"><span className="font-mono font-semibold text-accent">{p.invoiceNumber ?? "—"}</span> <span className="ml-2">{p.customerName}</span>{p.reference && <span className="ml-2 text-muted">{p.reference}</span>}</span>
              <span className="flex items-center gap-3"><span className="text-muted">{formatDateShort(p.paymentDate)} · {p.method}</span><span className={`tabular font-medium ${p.amount < 0 ? "text-brand-700" : ""}`}>{R(p.amount)}</span></span>
            </Link></li>
          ))}
        </Section>
      )}
      {res?.entries && res.entries.total > 0 && (
        <Section title="Entri kas" total={res.entries.total} shown={res.entries.items.length} all={`/expenses${buildQuery({ q })}`}>
          {res.entries.items.map((e) => (
            <li key={e.id}><Link href={`/expenses${buildQuery({ q: e.description })}`} className={row}>
              <span className="min-w-0"><span className="font-mono text-xs text-muted">{e.counterCode}</span> <span className="ml-1">{e.description}</span>{e.payee && <span className="ml-2 text-muted">{e.payee}</span>}</span>
              <span className="flex items-center gap-3"><span className="text-muted">{formatDateShort(e.entryDate)} · {e.cashAccountName}</span><span className="tabular font-medium">{e.direction === "IN" ? "+" : "−"}{R(e.amount)}</span></span>
            </Link></li>
          ))}
        </Section>
      )}
    </div>
  );
}
