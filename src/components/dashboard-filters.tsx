"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Popover } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/styles";
import { formatDateCompact } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Preset { label: string; from: string; to: string }

function go(router: ReturnType<typeof useRouter>, from: string, to: string, customerId: string) {
  const p = new URLSearchParams({ from, to });
  if (customerId) p.set("customerId", customerId);
  router.push(`/dashboard?${p.toString()}`);
}

/** Pemilih periode (satu tombol berisi rentang): preset cepat + dua tanggal bebas. Mengubah URL → halaman server dihitung ulang. */
export function PeriodFilter({ from, to, today, customerId, presets }: { from: string; to: string; today: string; customerId: string; presets: Preset[] }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const invalid = !f || !t || f > t || t > today;
  return (
    <Popover
      align="left"
      panelClassName="w-80 p-4"
      button={({ open, props }) => (
        <button type="button" {...props} aria-label={`Periode tanggal: ${formatDateCompact(from)} sampai ${formatDateCompact(to)}`} data-testid="period-filter"
          className="inline-flex h-11 items-center gap-3 rounded-lg border border-line bg-surface px-4 text-[15px] text-ink shadow-sm hover:bg-hover">
          <CalendarDays className="size-5 text-ink-soft" aria-hidden />
          <span className="tabular">{formatDateCompact(from)} – {formatDateCompact(to)}</span>
          <ChevronDown className={cn("size-4 text-ink-soft transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <div role="group" aria-label="Pilih periode">
          <div className="mb-3 flex flex-wrap gap-2">
            {presets.map((p) => (
              <button key={p.label} type="button" onClick={() => { close(); go(router, p.from, p.to, customerId); }}
                className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-soft hover:bg-hover">{p.label}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">Dari tanggal<input type="date" name="from" value={f} max={today} onChange={(e) => setF(e.target.value)} className={controlClass} /></label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">Sampai tanggal<input type="date" name="to" value={t} max={today} onChange={(e) => setT(e.target.value)} className={controlClass} /></label>
          </div>
          {invalid && <p role="alert" className="mt-2 text-xs font-medium text-brand-700">{!f || !t ? "Isi kedua tanggal." : f > t ? "Tanggal awal harus sebelum tanggal akhir." : "Tanggal akhir tidak boleh di masa depan."}</p>}
          <Button variant="primary" size="sm" className="mt-3 w-full" disabled={invalid} onClick={() => { close(); go(router, f, t, customerId); }}>Terapkan</Button>
        </div>
      )}
    </Popover>
  );
}

/** Filter pelanggan: berlaku seketika saat dipilih (tanpa tombol terapkan). */
export function CustomerFilter({ from, to, customerId, customers }: { from: string; to: string; customerId: string; customers: { id: string; name: string }[] }) {
  const router = useRouter();
  return (
    <div className="relative">
      <select aria-label="Pelanggan" name="customerId" value={customerId} onChange={(e) => go(router, from, to, e.target.value)}
        className="h-11 min-w-52 appearance-none rounded-lg border border-line bg-surface pl-4 pr-10 text-[15px] text-ink shadow-sm hover:bg-hover focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20">
        <option value="">Semua Pelanggan</option>
        {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
    </div>
  );
}
