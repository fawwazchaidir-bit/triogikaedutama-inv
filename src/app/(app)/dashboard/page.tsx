import type { Metadata } from "next";
import Link from "next/link";
import { Coins, FileText, ReceiptText } from "lucide-react";
import { requirePagePermission } from "@/server/auth/current";
import { getDashboard, dashboardQuerySchema } from "@/server/services/dashboard";
import { listCustomers } from "@/server/services/customers";
import { listInvoices } from "@/server/services/invoices";
import { Card, CardHeader, EmptyState, Notice } from "@/components/ui/card";
import { DerivedStatusBadge } from "@/components/ui/badge";
import { CustomerFilter, PeriodFilter } from "@/components/dashboard-filters";
import { TrendChart } from "@/components/trend-chart";
import { formatRupiah } from "@/lib/finance/money";
import { formatDateCompact, todayIso } from "@/lib/format";
import { DERIVED_STATUS_LABEL, derivedStatus, type DerivedStatus } from "@/lib/invoice-status";
import { env } from "@/server/env";
import { AppError } from "@/server/errors";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const R = (n: number) => formatRupiah(n, "PLAIN");

/** Warna titik pada tabel ringkasan — sama dengan nada lencana (merah, kuning, hijau, ungu, abu, gelap). */
const DOT: Record<DerivedStatus, string> = {
  UNPAID: "bg-brand-500", PARTIAL: "bg-amber-600", PAID: "bg-emerald-600", OVERDUE: "bg-brand-700", PENDING: "bg-violet-800", DRAFT: "bg-muted", CANCELLED: "bg-ink-soft",
};
/** Tautan ke daftar invoice yang sesuai dengan status. */
const STATUS_FILTER: Record<DerivedStatus, Record<string, string>> = {
  UNPAID: { paymentStatus: "UNPAID" }, PARTIAL: { paymentStatus: "PARTIALLY_PAID" }, PAID: { paymentStatus: "PAID" }, OVERDUE: { paymentStatus: "OVERDUE" },
  PENDING: { status: "SUBMITTED" }, DRAFT: { status: "DRAFT" }, CANCELLED: { status: "CANCELLED" },
};
const STRIP: readonly DerivedStatus[] = ["UNPAID", "PARTIAL", "PAID", "OVERDUE", "PENDING", "DRAFT"];

const TILE_TONE = {
  brand: "bg-brand-50 text-accent",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
} as const;

function Kpi({ icon: Icon, tone, label, value, hint, href, alert }: { icon: typeof FileText; tone: keyof typeof TILE_TONE; label: string; value: string; hint: string; href: string; alert?: boolean }) {
  return (
    <Link href={href} className="group flex items-center gap-5 rounded-2xl border border-line bg-surface p-5 shadow-sm transition-colors hover:border-brand-200">
      <span aria-hidden className={cn("flex size-16 shrink-0 items-center justify-center rounded-2xl", TILE_TONE[tone])}><Icon className="size-8" strokeWidth={1.75} /></span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-soft">{label}</span>
        <span className={cn("tabular mt-1 block truncate text-[1.65rem] font-extrabold leading-tight tracking-tight", alert ? "text-brand-700" : "text-ink")}>{value}</span>
        <span className="mt-1 block text-xs text-muted">{hint}</span>
      </span>
    </Link>
  );
}

/** Judul bagian: kata terakhir diberi warna aksen (gaya mockup); teks aksesibel tetap satu judul utuh. */
function AccentTitle({ text }: { text: string }) {
  const i = text.lastIndexOf(" ");
  return <>{text.slice(0, i + 1)}<span className="text-accent">{text.slice(i + 1)}</span></>;
}

export default async function DashboardPage({ searchParams }: { searchParams: SP }) {
  const user = await requirePagePermission("dashboard:view");
  const sp = await searchParams;
  const raw = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, first(v)]).filter(([, v]) => v));
  const parsed = dashboardQuerySchema.safeParse(raw);
  const f = parsed.success ? parsed.data : {};
  let error: string | null = null;
  let dash: Awaited<ReturnType<typeof getDashboard>> | null = null;
  try {
    dash = await getDashboard(user, f);
  } catch (e) {
    error = e instanceof AppError ? e.message : "Gagal memuat dashboard.";
  }
  const [customers, recent] = await Promise.all([
    listCustomers(user, { status: "all", pageSize: 100 }),
    listInvoices(user, { pageSize: 5, ...(dash ? { from: dash.period.from, to: dash.period.to } : {}), ...(f.customerId ? { customerId: f.customerId } : {}) }),
  ]);
  const today = todayIso(env().APP_TIMEZONE);
  const yr = today.slice(0, 4);
  const from = dash?.period.from ?? `${yr}-01-01`;
  const to = dash?.period.to ?? today;
  const presets = [
    { label: "Bulan ini", from: `${today.slice(0, 7)}-01`, to: today },
    { label: "30 hari terakhir", from: new Date(Date.parse(today) - 29 * 86_400_000).toISOString().slice(0, 10), to: today },
    { label: "Tahun ini", from: `${yr}-01-01`, to: today },
    { label: "Tahun lalu", from: `${Number(yr) - 1}-01-01`, to: `${Number(yr) - 1}-12-31` },
  ];

  const inv = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ from, to, ...(f.customerId ? { customerId: f.customerId } : {}), ...extra });
    return `/invoices?${p.toString()}`;
  };
  const byKey = new Map((dash?.statuses ?? []).map((s) => [s.key, s]));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">Dashboard Keuangan</h1>
          <p className="mt-1 text-sm text-muted">Gambaran penagihan &amp; piutang. Semua angka dihitung langsung dari database.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className="mb-1 block text-xs font-medium text-muted">Periode Tanggal</span>
            <PeriodFilter key={`${from}|${to}`} from={from} to={to} today={today} customerId={f.customerId ?? ""} presets={presets} />
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-muted">Pelanggan</span>
            <CustomerFilter from={from} to={to} customerId={f.customerId ?? ""} customers={customers.items.map((c) => ({ id: c.id, name: c.name }))} />
          </div>
        </div>
      </div>

      {error && <Notice tone="danger">{error}</Notice>}
      {dash && (
        <>
          <section aria-label="Ringkasan keuangan" className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Kpi icon={FileText} tone="brand" label="Nilai Invoice Terbit" value={R(dash.invoicedAmount)} hint={`${dash.issuedCount} invoice · menurut tanggal invoice`} href={inv({ status: "ISSUED" })} />
            <Kpi icon={Coins} tone="green" label="Penerimaan Kas" value={R(dash.receivedAmount)} hint="Pembayaran masuk, termasuk DP" href="/payments" />
            <Kpi icon={ReceiptText} tone="amber" label="Piutang Belum Dibayar" value={R(dash.outstandingAmount)} hint="Sisa tagihan invoice terbit pada periode ini" href={inv({ status: "ISSUED" })} alert={dash.outstandingAmount > 0} />
          </section>

          <section aria-label="Sebaran status" className="mb-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <ul className="grid grid-cols-2 gap-px bg-line lg:grid-cols-3 xl:grid-cols-6">
              {STRIP.map((key) => {
                const s = byKey.get(key);
                return (
                  <li key={key} className="bg-surface">
                    <Link href={inv(STATUS_FILTER[key])} data-testid={`status-${key}`} className="block px-4 py-4 hover:bg-hover sm:px-5">
                      <DerivedStatusBadge status={key} />
                      <p className="mt-3 text-sm text-ink-soft"><span className="tabular font-semibold text-ink">{s?.count ?? 0}</span> invoice</p>
                      <p className="tabular mt-0.5 text-sm font-semibold text-ink">{R(s?.amount ?? 0)}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <Card className="mb-5 rounded-2xl">
            <CardHeader title={<AccentTitle text="Tren per Bulan" />} description="Nilai invoice terbit dan penerimaan kas pada periode terpilih." />
            <div className="p-5"><TrendChart data={dash.trend} /></div>
          </Card>

          <div className="mb-5 grid grid-cols-[minmax(0,1fr)] gap-5 min-[1440px]:grid-cols-[minmax(0,1fr)_24rem]">
            <Card className="rounded-2xl">
              <CardHeader title={<AccentTitle text="Invoice Terbaru" />} actions={<Link href={inv()} className="text-sm font-semibold text-accent hover:underline">Lihat Semua →</Link>} />
              {recent.items.length === 0 ? (
                <EmptyState title="Belum ada invoice pada periode ini" description="Ubah periode atau pelanggan untuk melihat invoice lain." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse text-sm">
                    <thead>
                      <tr className="whitespace-nowrap border-b border-line text-left text-xs font-semibold text-muted">
                        <th scope="col" className="px-4 py-3">No. Invoice</th>
                        <th scope="col" className="px-2.5 py-3">Pelanggan</th>
                        <th scope="col" className="px-2.5 py-3">Tanggal</th>
                        <th scope="col" className="px-2.5 py-3">Jatuh Tempo</th>
                        <th scope="col" className="px-2.5 py-3 text-right">Total</th>
                        <th scope="col" className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.items.map((i) => (
                        <tr key={i.id} className="border-b border-line/70 last:border-b-0 hover:bg-hover">
                          <td className="whitespace-nowrap px-4 py-3"><Link href={`/invoices/${i.id}`} className="font-mono font-semibold text-accent hover:underline">{i.number ?? "DRAFT"}</Link></td>
                          <td className="max-w-52 truncate px-2.5 py-3">{i.customerName}</td>
                          <td className="tabular whitespace-nowrap px-2.5 py-3 text-ink-soft">{formatDateCompact(i.invoiceDate)}</td>
                          <td className="tabular whitespace-nowrap px-2.5 py-3 text-ink-soft">{formatDateCompact(i.dueDate)}</td>
                          <td className="tabular whitespace-nowrap px-2.5 py-3 text-right font-medium">{R(i.totalAmount)}</td>
                          <td className="whitespace-nowrap px-4 py-3"><DerivedStatusBadge status={derivedStatus(i)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="rounded-2xl">
              <CardHeader title={<AccentTitle text="Ringkasan Status Invoice" />} />
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-semibold text-muted">
                      <th scope="col" className="px-4 py-3">Status</th>
                      <th scope="col" className="px-2 py-3 text-right">Jumlah Invoice</th>
                      <th scope="col" className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dash.statuses.map((s) => (
                      <tr key={s.key} className="border-b border-line/70 last:border-b-0">
                        <th scope="row" className="px-4 py-3 text-left font-normal">
                          <span className="inline-flex items-center gap-2.5"><span aria-hidden className={cn("size-2.5 rounded-full", DOT[s.key])} />{DERIVED_STATUS_LABEL[s.key]}</span>
                        </th>
                        <td className="tabular px-2 py-3 text-right">{s.count}</td>
                        <td className="tabular whitespace-nowrap px-4 py-3 text-right font-medium">{R(s.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line bg-canvas/60 font-semibold">
                      <th scope="row" className="px-4 py-3 text-left">Total</th>
                      <td className="tabular px-2 py-3 text-right">{dash.statuses.reduce((a, s) => a + s.count, 0)}</td>
                      <td className="tabular whitespace-nowrap px-4 py-3 text-right">{R(dash.statuses.reduce((a, s) => a + s.amount, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>

          <section aria-label="Kalender" className="mb-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface px-5 py-4 shadow-sm">
              <p className="text-sm text-muted">Nilai invoice bulan berjalan</p>
              <p className="tabular mt-1 text-xl font-bold text-ink">{R(dash.monthInvoiced)}</p>
              <p className="mt-0.5 text-xs text-muted">Bulan {today.slice(0, 7)}</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface px-5 py-4 shadow-sm">
              <p className="text-sm text-muted">Nilai invoice tahun berjalan</p>
              <p className="tabular mt-1 text-xl font-bold text-ink">{R(dash.yearInvoiced)}</p>
              <p className="mt-0.5 text-xs text-muted">Tahun {yr}</p>
            </div>
          </section>

          <Card className="rounded-2xl">
            <details>
              <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-ink-soft">Definisi angka (agar tidak terjadi hitung ganda)</summary>
              <dl className="grid gap-3 px-5 pb-5 text-sm text-ink-soft sm:grid-cols-3">
                <div><dt className="font-semibold text-ink">Nilai invoice</dt><dd>Total invoice berstatus <em>Diterbitkan</em>. Draft, invoice menunggu verifikasi, dan invoice batal tidak dihitung. DP/pembayaran <strong>tidak</strong> mengurangi nilai ini.</dd></div>
                <div><dt className="font-semibold text-ink">Penerimaan kas</dt><dd>Jumlah baris pembayaran (termasuk DP, dikurangi pembalikan) menurut tanggal bayar. Satu rupiah hanya dihitung sekali.</dd></div>
                <div><dt className="font-semibold text-ink">Piutang</dt><dd>Nilai invoice terbit dikurangi pembayaran yang tercatat. Invoice lunas bernilai 0 namun tetap ada di histori.</dd></div>
                <div className="sm:col-span-3"><dt className="font-semibold text-ink">Status invoice (saling lepas)</dt><dd>Satu invoice hanya masuk satu status: <em>Jatuh tempo</em> didahulukan atas <em>Belum dibayar</em> dan <em>Sebagian</em>. Total pada kolom status = nilai invoice (bukan sisa tagihan), sehingga jumlah barisnya sama dengan seluruh invoice pada periode.</dd></div>
              </dl>
              <p className="border-t border-line px-5 py-3 text-xs text-muted">Ini ringkasan operasional penagihan, bukan laporan akuntansi (tanpa jurnal atau pengakuan pendapatan).</p>
            </details>
          </Card>
        </>
      )}
    </div>
  );
}
