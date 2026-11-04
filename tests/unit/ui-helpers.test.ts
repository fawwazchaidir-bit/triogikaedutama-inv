import { describe, expect, it } from "vitest";
import { DERIVED_STATUS_LABEL, DERIVED_STATUS_ORDER, derivedStatus } from "@/lib/invoice-status";
import { compactRupiah, niceScale } from "@/components/trend-chart";
import { formatDateCompact, monthLabel } from "@/lib/format";
import { isTheme, THEME_INIT_SCRIPT, THEME_KEY } from "@/lib/theme";
import { visibleNav } from "@/lib/permissions";

type Inv = Parameters<typeof derivedStatus>[0];
const inv = (o: Partial<Inv>): Inv => ({ status: "ISSUED", paymentStatus: "UNPAID", isOverdue: false, ...o });

describe("derivedStatus — satu invoice, satu status", () => {
  it("status dokumen mengalahkan status pembayaran", () => {
    expect(derivedStatus(inv({ status: "DRAFT" }))).toBe("DRAFT");
    expect(derivedStatus(inv({ status: "SUBMITTED" }))).toBe("PENDING");
    expect(derivedStatus(inv({ status: "CANCELLED", paymentStatus: "PAID" }))).toBe("CANCELLED");
  });
  it("invoice terbit: lunas > jatuh tempo > sebagian > belum dibayar", () => {
    expect(derivedStatus(inv({ paymentStatus: "PAID", isOverdue: true }))).toBe("PAID");
    expect(derivedStatus(inv({ paymentStatus: "PARTIALLY_PAID", isOverdue: true }))).toBe("OVERDUE");
    expect(derivedStatus(inv({ paymentStatus: "UNPAID", isOverdue: true }))).toBe("OVERDUE");
    expect(derivedStatus(inv({ paymentStatus: "PARTIALLY_PAID" }))).toBe("PARTIAL");
    expect(derivedStatus(inv({ paymentStatus: "UNPAID" }))).toBe("UNPAID");
  });
  it("urutan & label lengkap untuk tujuh status", () => {
    expect(DERIVED_STATUS_ORDER).toHaveLength(7);
    expect(new Set(DERIVED_STATUS_ORDER).size).toBe(7);
    expect(DERIVED_STATUS_ORDER.map((k) => DERIVED_STATUS_LABEL[k])).toEqual(["Belum dibayar", "Sebagian", "Lunas", "Jatuh tempo", "Menunggu verifikasi", "Draft", "Dibatalkan"]);
  });
});

describe("sumbu grafik tren", () => {
  it("label ringkas gaya Indonesia", () => {
    expect([0, 999, 1_000, 500_000, 10_000_000, 12_500_000, 1_500_000_000].map(compactRupiah)).toEqual(["0", "999", "1 Rb", "500 Rb", "10 Jt", "12,5 Jt", "1,5 M"]);
  });
  it("skala 'bulat': kelipatan 1/2/5 × 10^k, puncak data selalu tercakup, tanpa label desimal aneh", () => {
    for (const max of [1, 750_000, 3_200_000, 9_990_000, 47_350_000, 120_000_000, 2_300_000_000]) {
      const { top, ticks } = niceScale(max);
      expect(top).toBeGreaterThanOrEqual(max);
      expect(ticks[0]).toBe(0);
      expect(ticks.at(-1)).toBe(top);
      const step = ticks[1]! - ticks[0]!;
      expect(ticks.every((t, i) => t === i * step)).toBe(true);
      expect(ticks.length).toBeGreaterThanOrEqual(3);
      expect(ticks.length).toBeLessThanOrEqual(6);
      expect([1, 2, 5]).toContain(+(step / 10 ** Math.floor(Math.log10(step))).toFixed(6));
    }
  });
  it("tanpa data → skala bawaan Rp1–4 jt", () => {
    expect(niceScale(0)).toEqual({ top: 4_000_000, ticks: [0, 1_000_000, 2_000_000, 3_000_000, 4_000_000] });
  });
});

describe("format tanggal ringkas", () => {
  it("formatDateCompact & monthLabel", () => {
    expect(formatDateCompact("2025-08-01")).toBe("1 Agu 2025");
    expect(formatDateCompact("2026-11-04T10:00:00Z")).toBe("4 Nov 2026");
    expect(formatDateCompact(null)).toBe("-");
    expect(monthLabel("2025-01", true)).toBe("Jan 2025");
  });
});

describe("tema terang/gelap", () => {
  it("nilai tema valid hanya light|dark", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    for (const v of ["", "auto", "DARK", null, undefined, 1]) expect(isTheme(v)).toBe(false);
  });
  it("skrip pra-render: membaca localStorage, jatuh ke preferensi OS, tidak pernah melempar, menulis data-theme", () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_KEY);
    expect(THEME_INIT_SCRIPT).toContain("prefers-color-scheme");
    expect(THEME_INIT_SCRIPT).toContain("data-theme");
    expect(THEME_INIT_SCRIPT).toMatch(/try\s*\{/);
    expect(THEME_INIT_SCRIPT).toMatch(/catch/);
  });
  it("eval skrip: preferensi tersimpan menang; tanpa simpanan mengikuti OS; storage rusak tidak memutus halaman", () => {
    const run = (store: Record<string, string> | "throw", osDark: boolean) => {
      const attrs: Record<string, string> = {};
      const doc = { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } } };
      const win = {
        localStorage: store === "throw" ? { getItem: () => { throw new Error("blocked"); } } : { getItem: (k: string) => store[k] ?? null },
        matchMedia: () => ({ matches: osDark }),
      };
      new Function("document", "window", "localStorage", "matchMedia", THEME_INIT_SCRIPT)(doc, win, win.localStorage, win.matchMedia);
      return attrs["data-theme"];
    };
    expect(run({ [THEME_KEY]: "dark" }, false)).toBe("dark");
    expect(run({ [THEME_KEY]: "light" }, true)).toBe("light");
    expect(run({}, true)).toBe("dark");
    expect(run({}, false)).toBe("light");
    expect(run({ [THEME_KEY]: "rusak" }, true)).toBe("dark");
    expect(run("throw", true)).toBe("dark");
  });
});

describe("urutan menu sesuai desain baru", () => {
  it("Dashboard, Invoice, Pembayaran, Pelanggan, Produk, Pengeluaran, Kas, Jurnal, Rekonsiliasi, Laporan … Pengaturan", () => {
    expect(visibleNav("FINANCE").map((i) => i.label)).toEqual(["Dashboard", "Invoice", "Pembayaran", "Pelanggan", "Produk & Layanan", "Pengeluaran", "Kas & Bank", "Jurnal", "Rekonsiliasi", "Laporan", "Laporan Keuangan", "Pajak", "Tutup Buku", "Pengaturan"]);
  });
});
