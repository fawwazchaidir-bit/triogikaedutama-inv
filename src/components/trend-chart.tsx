"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatNumberId, formatRupiah } from "@/lib/finance/money";
import { monthLabel } from "@/lib/format";

/**
 * Grafik garis + area: Nilai invoice terbit vs Penerimaan kas per bulan. Satu sumbu (tidak ada dual-axis); dua seri → legenda wajib.
 * Warna seri memakai token tema (`series-a` raspberry, `series-b` emas) sehingga kontras terjaga di tema terang & gelap; seluruh
 * garis bantu/teks juga token (tanpa hex tetap). Tooltip, fokus keyboard, dan tombol "Tampilkan tabel" menjamin nilai tak bergantung hover.
 */
export interface TrendPoint { month: string; invoiced: number; received: number }

const SERIES = [
  { key: "invoiced", label: "Invoice Terbit", cls: { stroke: "stroke-series-a", fill: "fill-series-a", bg: "bg-series-a" } },
  { key: "received", label: "Penerimaan Kas", cls: { stroke: "stroke-series-b", fill: "fill-series-b", bg: "bg-series-b" } },
] as const;

const dec = (v: number) => String(+v.toFixed(1)).replace(".", ",");

/** Label sumbu ringkas gaya Indonesia: 0 · 500 Rb · 10 Jt · 1,5 M. */
export function compactRupiah(n: number): string {
  if (n >= 1_000_000_000) return `${dec(n / 1_000_000_000)} M`;
  if (n >= 1_000_000) return `${dec(n / 1_000_000)} Jt`;
  if (n >= 1_000) return `${dec(n / 1_000)} Rb`;
  return String(n);
}

/** Skala "bulat": langkah 1/2/5 × 10^k (mis. 0 · 10 Jt · 20 Jt · 30 Jt) sehingga label sumbu mudah dibaca. */
export function niceScale(maxValue: number): { top: number; ticks: number[] } {
  if (maxValue <= 0) return { top: 4_000_000, ticks: [0, 1_000_000, 2_000_000, 3_000_000, 4_000_000] };
  const raw = maxValue / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  const count = Math.ceil(maxValue / step);
  return { top: count * step, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) };
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const gid = useId().replace(/:/g, "");
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.max(300, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [table]);

  const H = 300;
  const m = { top: 14, right: 18, bottom: 40, left: 62 };
  const innerW = width - m.left - m.right;
  const innerH = H - m.top - m.bottom;
  const { top: max, ticks } = useMemo(() => niceScale(Math.max(0, ...data.flatMap((d) => [d.invoiced, d.received]))), [data]);
  const band = data.length ? innerW / data.length : innerW;
  const y = (v: number) => m.top + innerH - (v / max) * innerH;
  const x = (i: number) => m.left + band * i + band / 2;
  const showEvery = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 74)));
  const hasData = data.some((d) => d.invoiced || d.received);
  const base = y(0);

  const line = (k: "invoiced" | "received") => data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(" ");
  const area = (k: "invoiced" | "received") =>
    data.length < 2 ? "" : `${line(k)} L${x(data.length - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`;

  const a = active !== null ? data[active] : null;
  const tipLeft = active !== null ? Math.min(Math.max(x(active) - 95, 4), Math.max(4, width - 200)) : 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setTable((t) => !t)} aria-pressed={table} className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-hover">
          {table ? "Tampilkan grafik" : "Tampilkan tabel"}
        </button>
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-ink-soft" aria-label="Legenda">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span aria-hidden className="relative inline-flex w-6 items-center justify-center"><span className={`h-0.5 w-6 rounded ${s.cls.bg}`} /><span className={`absolute size-2 rounded-full ${s.cls.bg}`} /></span>
              {s.label}
            </li>
          ))}
        </ul>
      </div>

      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <caption className="sr-only">Nilai invoice terbit dan penerimaan kas per bulan</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="py-2 pr-4">Bulan</th>
                <th scope="col" className="py-2 pr-4 text-right">Invoice Terbit</th>
                <th scope="col" className="py-2 text-right">Penerimaan Kas</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.month} className="border-b border-line/60">
                  <th scope="row" className="py-2 pr-4 text-left font-normal">{monthLabel(d.month)}</th>
                  <td className="tabular py-2 pr-4 text-right">{formatRupiah(d.invoiced, "PLAIN")}</td>
                  <td className="tabular py-2 text-right">{formatRupiah(d.received, "PLAIN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrap} className="relative">
          <svg width={width} height={H} role="img" aria-label={`Grafik garis nilai invoice terbit dan penerimaan kas per bulan, ${data.length} bulan`} onPointerLeave={() => setActive(null)}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: s.key === "invoiced" ? "var(--color-series-a)" : "var(--color-series-b)" }} stopOpacity={0.28} />
                  <stop offset="100%" style={{ stopColor: s.key === "invoiced" ? "var(--color-series-a)" : "var(--color-series-b)" }} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} strokeDasharray={t === 0 ? undefined : "3 4"} />
                <text x={m.left - 10} y={y(t) + 4} textAnchor="end" fontSize={12} className="fill-muted">{compactRupiah(t)}</text>
              </g>
            ))}
            {active !== null && <line x1={x(active)} x2={x(active)} y1={m.top} y2={base} className="stroke-muted" strokeOpacity={0.5} strokeWidth={1} />}
            {SERIES.map((s) => (
              <g key={s.key}>
                {data.length > 1 && <path d={area(s.key)} fill={`url(#${gid}-${s.key})`} />}
                {data.length > 1 && <path d={line(s.key)} fill="none" className={s.cls.stroke} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
                {data.map((d, i) => (
                  <circle key={d.month} cx={x(i)} cy={y(d[s.key])} r={active === i ? 5.5 : 4} className={`fill-surface ${s.cls.stroke}`} strokeWidth={2.5} />
                ))}
              </g>
            ))}
            {data.map((d, i) => (
              <g key={d.month}>
                {i % showEvery === 0 && (
                  <text x={x(i)} y={H - 14} textAnchor="middle" fontSize={12} className="fill-muted">{monthLabel(d.month, true)}</text>
                )}
                {/* Area sentuh sebesar seluruh pita bulan (lebih besar dari tanda), juga fokus keyboard. */}
                <rect
                  x={m.left + band * i} y={m.top} width={band} height={innerH + 26} fill="transparent" tabIndex={0}
                  aria-label={`${monthLabel(d.month)}: nilai invoice ${formatRupiah(d.invoiced, "PLAIN")}, penerimaan kas ${formatRupiah(d.received, "PLAIN")}`}
                  onPointerEnter={() => setActive(i)} onPointerMove={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                />
              </g>
            ))}
          </svg>
          {a && (
            <div role="status" className="pointer-events-none absolute top-2 z-10 w-[190px] rounded-lg border border-line bg-surface p-3 text-xs shadow-lg" style={{ left: tipLeft }}>
              <p className="mb-1.5 font-semibold text-ink">{monthLabel(a.month)}</p>
              {SERIES.map((s) => (
                <p key={s.key} className="flex items-center justify-between gap-2 py-0.5">
                  <span className="flex items-center gap-1.5 text-muted"><span aria-hidden className={`inline-block size-2 rounded-full ${s.cls.bg}`} />{s.label}</span>
                  <span className="tabular font-semibold text-ink">{formatNumberId(a[s.key])}</span>
                </p>
              ))}
            </div>
          )}
          {!hasData && <p className="pointer-events-none absolute inset-x-0 top-1/2 text-center text-sm text-muted">Belum ada data pada periode ini.</p>}
        </div>
      )}
    </div>
  );
}
