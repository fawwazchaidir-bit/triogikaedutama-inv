"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, Bell, BookCheck, BookOpen, ChevronDown, FileText, KeyRound, Landmark, LayoutDashboard, LogOut, Menu, Package, Percent, Receipt, RefreshCw,
  ScrollText, Search, Settings, TrendingUp, Users, Wallet, X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api-client";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import type { NotificationItem } from "@/lib/notifications";
import { ToastProvider } from "@/components/ui/toast";
import { Popover } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/theme-toggle";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/dashboard": LayoutDashboard,
  "/invoices": FileText,
  "/payments": Wallet,
  "/customers": Users,
  "/products": Package,
  "/expenses": Receipt,
  "/cash": Landmark,
  "/journals": BookOpen,
  "/reconciliation": RefreshCw,
  "/reports": BarChart3,
  "/statements": TrendingUp,
  "/taxes": Percent,
  "/closing": BookCheck,
  "/audit-log": ScrollText,
  "/settings": Settings,
};

export interface ShellProps {
  user: { name: string; email: string; role: Role };
  nav: { href: string; label: string }[];
  company: { name: string; logoUrl: string };
  notifications: NotificationItem[];
  children: React.ReactNode;
}

const TONE_DOT: Record<NotificationItem["tone"], string> = { red: "bg-brand-500", amber: "bg-amber-600", blue: "bg-sky-800" };

function NotificationBell({ items }: { items: NotificationItem[] }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <Popover
      button={({ props }) => (
        <button type="button" {...props} aria-label={total ? `Notifikasi, ${total} butir menunggu` : "Notifikasi, tidak ada yang menunggu"} data-testid="bell"
          className="relative inline-flex size-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10">
          <Bell className="size-6" aria-hidden />
          {total > 0 && <span data-testid="bell-dot" aria-hidden className="absolute right-1.5 top-1.5 size-3 rounded-full bg-[#ff3b5c] ring-2 ring-header" />}
        </button>
      )}
    >
      {(close) => (
        <div role="menu" aria-label="Notifikasi">
          <p className="border-b border-line px-4 py-3 text-sm font-semibold">Perlu tindakan</p>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Tidak ada yang menunggu. Semua beres 👍</p>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link role="menuitem" href={n.href} onClick={close} className="flex items-start gap-3 px-4 py-3 text-sm hover:bg-hover">
                    <span aria-hidden className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", TONE_DOT[n.tone])} />
                    <span className="min-w-0">
                      <span className="block font-medium"><span className="tabular">{n.count}</span> {n.label}</span>
                      {n.detail && <span className="block text-xs text-muted">{n.detail}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Popover>
  );
}

function UserMenu({ user, company, busy, onLogout }: { user: ShellProps["user"]; company: string; busy: boolean; onLogout: () => void }) {
  return (
    <Popover
      button={({ open, props }) => (
        <button type="button" {...props} aria-label="Menu pengguna" data-testid="user-menu"
          className="inline-flex h-10 items-center gap-1 rounded-full px-1.5 text-[15px] font-medium text-white transition-colors hover:bg-white/10 sm:gap-2 sm:px-3">
          <span className="hidden max-w-44 truncate sm:inline">{company}</span>
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-white/15 text-xs font-bold sm:hidden" aria-hidden>{user.name.slice(0, 1).toUpperCase()}</span>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <div role="menu" aria-label="Menu pengguna">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <p className="mt-1.5 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">{ROLE_LABELS[user.role]}</p>
          </div>
          <Link role="menuitem" href="/change-password" onClick={close} className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-hover"><KeyRound className="size-4 text-muted" aria-hidden />Password</Link>
          <button type="button" role="menuitem" disabled={busy} onClick={() => { close(); onLogout(); }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-hover disabled:opacity-50">
            <LogOut className="size-4 text-muted" aria-hidden />Keluar
          </button>
        </div>
      )}
    </Popover>
  );
}

export function AppShell({ user, nav, company, notifications, children }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const brandWord = company.name.trim().split(/\s+/)[0] ?? company.name;

  async function logout() {
    setBusy(true);
    try { await api("/api/auth/logout", { method: "POST", body: {} }); } finally { router.push("/login"); router.refresh(); }
  }

  const navList = (
    <nav aria-label="Menu utama" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {nav.map((item) => {
        const Icon = ICONS[item.href] ?? FileText;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href} href={item.href} onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3.5 rounded-xl px-4 py-2.5 text-[15px] font-medium transition-colors",
              active ? "bg-sidebar-active text-white shadow-sm" : "text-sidebar-ink hover:bg-sidebar-hover",
            )}
          >
            <Icon className="size-5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen">
        {/* ── Bilah atas ── */}
        <header className="no-print sticky top-0 z-40 flex h-[68px] items-center bg-header text-white shadow-sm">
          <button type="button" aria-label="Buka menu" onClick={() => setOpen(true)} className="ml-2 inline-flex size-10 items-center justify-center rounded-full hover:bg-white/10 lg:hidden"><Menu className="size-5" /></button>
          <Link href={nav[0]?.href ?? "/"} className="flex w-auto min-w-0 shrink-0 flex-col justify-center px-2 leading-none sm:px-3 lg:w-[15.25rem] lg:px-7" aria-label={company.name}>
            <span className="text-lg font-extrabold uppercase tracking-wide sm:text-[22px]">{brandWord}</span>
            <span className="mt-1 hidden whitespace-nowrap text-[12px] font-medium leading-tight text-white/90 sm:block">Financial Management System</span>
          </Link>
          <span aria-hidden className="mr-4 hidden h-9 w-px bg-header-line lg:block" />
          <form action="/search" role="search" className="mx-2 hidden min-w-0 flex-1 md:block">
            <label className="sr-only" htmlFor="global-search">Cari invoice, pelanggan, atau transaksi</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-white/90" aria-hidden />
              <input id="global-search" name="q" type="search" autoComplete="off" minLength={2} maxLength={80} placeholder="Cari invoice, pelanggan, atau transaksi…"
                className="h-11 w-full rounded-full border border-white/35 bg-black/25 pl-12 pr-4 text-[15px] text-white placeholder:text-white/75 focus:border-white/80 focus:outline-none focus:ring-2 focus:ring-white/30" />
            </div>
          </form>
          <div className="ml-auto flex items-center gap-0.5 pr-2 sm:gap-1 sm:pr-6 md:ml-2">
            <Link href="/search" aria-label="Cari" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-white/10 md:hidden"><Search className="size-5" aria-hidden /></Link>
            <span aria-hidden className="mx-2 hidden h-9 w-px bg-header-line md:block" />
            <NotificationBell items={notifications} />
            <ThemeToggle />
            <UserMenu user={user} company={company.name} busy={busy} onLogout={logout} />
          </div>
        </header>

        <div className="lg:grid lg:grid-cols-[15.25rem_1fr]">
          <aside className="no-print sticky top-[68px] hidden h-[calc(100vh-68px)] flex-col border-r border-sidebar-line bg-sidebar lg:flex">{navList}</aside>

          {open && (
            <div className="no-print fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
              <button type="button" aria-label="Tutup menu" className="absolute inset-0 bg-black/55" onClick={() => setOpen(false)} />
              <div className="relative flex h-full w-72 max-w-[85%] flex-col bg-sidebar shadow-2xl">
                <button type="button" aria-label="Tutup" onClick={() => setOpen(false)} className="absolute right-2 top-2 z-10 rounded-full p-1.5 text-sidebar-ink hover:bg-sidebar-hover"><X className="size-5" /></button>
                <p className="px-5 pb-1 pt-5 text-lg font-extrabold uppercase tracking-wide text-sidebar-ink">{brandWord}</p>
                {navList}
              </div>
            </div>
          )}

          <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
