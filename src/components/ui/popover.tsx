"use client";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Popover kecil untuk bilah atas (lonceng, menu pengguna): klik di luar / Esc menutup; fokus kembali ke tombol.
 * `button` menerima props yang harus disebar ke elemen tombol (aria + onClick).
 */
export function Popover({ button, children, align = "right", panelClassName }: {
  button: (p: { open: boolean; props: { "aria-haspopup": "menu"; "aria-expanded": boolean; "aria-controls": string; onClick: () => void } }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); ref.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus(); } };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {button({ open, props: { "aria-haspopup": "menu", "aria-expanded": open, "aria-controls": id, onClick: () => setOpen((o) => !o) } })}
      {open && (
        <div id={id} className={cn("absolute z-50 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-xl", align === "right" ? "right-0" : "left-0", panelClassName)}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
