import { expect, test, type Page } from "@playwright/test";
import { login, logout, openUserMenu } from "./helpers";

/** Warna latar <body> terhitung (bukan token mentah) → membuktikan tema benar-benar mengubah tampilan. */
const bodyBg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

test.describe("tema terang/gelap", () => {
  test("tombol di halaman login; mengikuti preferensi OS bila belum memilih; pilihan bertahan setelah muat ulang & lintas halaman", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/login");
    expect(await theme(page)).toBe("dark"); // tanpa pilihan tersimpan → ikut OS, sudah terpasang sebelum hidrasi (tanpa kedip)
    await expect.poll(() => bodyBg(page)).toBe("rgb(18, 17, 20)");

    const toggle = page.getByTestId("theme-toggle");
    await expect(toggle).toHaveAccessibleName("Ganti ke tema terang");
    await toggle.click();
    expect(await theme(page)).toBe("light");
    await expect.poll(() => bodyBg(page)).toBe("rgb(247, 245, 246)"); // transisi 120 ms → tunggu hingga selesai
    await expect(toggle).toHaveAccessibleName("Ganti ke tema gelap");

    await page.reload(); // OS tetap gelap, tetapi pilihan eksplisit "terang" menang
    expect(await theme(page)).toBe("light");

    await login(page, "finance");
    expect(await theme(page)).toBe("light"); // bertahan lintas halaman
    await page.getByTestId("theme-toggle").click();
    expect(await theme(page)).toBe("dark");
    for (const path of ["/invoices", "/payments", "/statements"]) {
      await page.goto(path);
      expect(await theme(page)).toBe("dark");
      await expect.poll(() => bodyBg(page)).toBe("rgb(18, 17, 20)");
    }
    expect(await page.evaluate(() => localStorage.getItem("fms-theme"))).toBe("dark");
  });

  for (const t of ["light", "dark"] as const) {
    test(`tema ${t}: teks tetap terbaca di semua halaman utama (kontras ≥ 3:1 terhadap latar efektifnya, alfa dikomposit)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: t });
      await login(page, "finance");
      for (const path of ["/dashboard", "/invoices", "/payments", "/statements", "/settings", "/search?q=bima"]) {
        await page.goto(path);
        await page.evaluate((v) => document.documentElement.setAttribute("data-theme", v), t);
        await page.waitForTimeout(250); // transisi warna 120 ms
        const worst = await page.evaluate(() => {
          type RGBA = [number, number, number, number];
          const cv = document.createElement("canvas"); cv.width = cv.height = 1;
          const g = cv.getContext("2d", { willReadFrequently: true })!;
          // Kanvas menormalkan format warna apa pun (hex, rgb, oklch…) ke sRGB.
          const rgba = (c: string): RGBA => { g.clearRect(0, 0, 1, 1); g.fillStyle = "#000"; g.fillStyle = c; g.fillRect(0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; return [d[0]!, d[1]!, d[2]!, d[3]! / 255]; };
          const over = (top: RGBA, bottom: RGBA): RGBA => { const a = top[3] + bottom[3] * (1 - top[3]); return a === 0 ? [0, 0, 0, 0] : [0, 1, 2].map((i) => (top[i]! * top[3] + bottom[i]! * bottom[3] * (1 - top[3])) / a).concat(a) as RGBA; };
          const lum = ([r, gg, b]: RGBA) => { const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b); };
          const effectiveBg = (el: Element): RGBA => {
            const layers: RGBA[] = [];
            for (let e: Element | null = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) layers.push(c); if (c[3] === 1) break; }
            return layers.reduceRight<RGBA>((acc, l) => over(l, acc), rgba(getComputedStyle(document.body).backgroundColor));
          };
          const out: { text: string; ratio: number }[] = [];
          for (const el of document.querySelectorAll("main h1, main h2, main td, main th, main label, main input, main select, main button, main a, main p, main span, main li")) {
            const h = el as HTMLElement;
            const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
            if (!own || !h.offsetParent || getComputedStyle(h).visibility === "hidden") continue;
            const bg = effectiveBg(el);
            const fg = over(rgba(getComputedStyle(el).color), bg);
            const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
            out.push({ text: el.textContent!.trim().slice(0, 30), ratio: (hi! + 0.05) / (lo! + 0.05) });
          }
          return out.sort((x, y) => x.ratio - y.ratio).slice(0, 3);
        });
        expect(worst[0]?.ratio ?? 99, `${path} (${t}): teks "${worst[0]?.text}" kontras terendah`).toBeGreaterThan(3);
      }
    });
  }
});

test.describe("dashboard keuangan", () => {
  test("struktur sesuai desain: judul, filter, 3 KPI, 6 status, tren, invoice terbaru, ringkasan status — angka antar bagian konsisten", async ({ page }) => {
    await login(page, "finance");
    await expect(page.getByRole("heading", { name: "Dashboard Keuangan", level: 1 })).toBeVisible();
    await expect(page.getByText("Periode Tanggal", { exact: true })).toBeVisible();
    await expect(page.getByTestId("period-filter")).toContainText(/\d{1,2} \w{3} \d{4} – \d{1,2} \w{3} \d{4}/);
    await expect(page.getByLabel("Pelanggan", { exact: true })).toBeVisible();

    const kpi = page.getByRole("region", { name: "Ringkasan keuangan" });
    for (const label of ["Nilai Invoice Terbit", "Penerimaan Kas", "Piutang Belum Dibayar"]) await expect(kpi.getByText(label, { exact: true })).toBeVisible();
    await expect(kpi.getByText(/^Rp /)).toHaveCount(3);

    const strip = page.getByRole("region", { name: "Sebaran status" });
    await expect(strip.getByRole("link")).toHaveCount(6);
    for (const label of ["Belum dibayar", "Sebagian", "Lunas", "Jatuh tempo", "Menunggu verifikasi", "Draft"]) await expect(strip.getByText(label, { exact: true })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Tren per Bulan" })).toBeVisible();
    await expect(page.getByRole("img", { name: /Grafik garis nilai invoice terbit dan penerimaan kas per bulan/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "Legenda" })).toContainText("Invoice Terbit");
    await expect(page.getByRole("list", { name: "Legenda" })).toContainText("Penerimaan Kas");

    const recent = page.locator("section").filter({ has: page.getByRole("heading", { name: "Invoice Terbaru" }) });
    await expect(recent.getByRole("columnheader")).toHaveText(["No. Invoice", "Pelanggan", "Tanggal", "Jatuh Tempo", "Total", "Status"]);
    expect(await recent.getByRole("row").count()).toBeLessThanOrEqual(6); // header + maksimal 5 baris
    await expect(recent.getByRole("link", { name: "Lihat Semua →" })).toHaveAttribute("href", /^\/invoices\?/);

    const summary = page.locator("section").filter({ has: page.getByRole("heading", { name: "Ringkasan Status Invoice" }) });
    const rows = summary.locator("tbody tr");
    await expect(rows).toHaveCount(7);
    await expect(rows.locator("th")).toHaveText(["Belum dibayar", "Sebagian", "Lunas", "Jatuh tempo", "Menunggu verifikasi", "Draft", "Dibatalkan"]);
    const counts = (await rows.locator("td:nth-child(2)").allTextContents()).map(Number);
    const totalRow = Number(await summary.locator("tfoot td").first().textContent());
    expect(counts.reduce((a, b) => a + b, 0)).toBe(totalRow); // baris = total (saling lepas)

    // angka pada strip = angka pada tabel ringkasan (sumber data sama)
    const stripCounts = await strip.getByRole("link").evaluateAll((els) => els.map((e) => Number(e.querySelector("p span")?.textContent)));
    expect(stripCounts).toEqual(counts.slice(0, 6));
  });

  test("filter periode (preset & tanggal bebas) dan pelanggan mengubah URL serta seluruh angka; tautan status membuka daftar yang cocok", async ({ page }) => {
    const sumCounts = async () => (await page.locator("section").filter({ has: page.getByRole("heading", { name: "Ringkasan Status Invoice" }) }).locator("tbody tr td:nth-child(2)").allTextContents()).map(Number).reduce((a, b) => a + b, 0);
    await login(page, "finance");

    // preset → URL & label tombol
    await page.getByTestId("period-filter").click();
    await page.getByRole("button", { name: "Tahun lalu" }).click();
    const lastYear = String(new Date().getFullYear() - 1);
    await expect(page).toHaveURL(new RegExp(`from=${lastYear}-01-01&to=${lastYear}-12-31`));
    await expect(page.getByTestId("period-filter")).toContainText(`1 Jan ${lastYear} – 31 Des ${lastYear}`);

    // tanggal bebas: awal > akhir ditolak sebelum dikirim; periode tanpa transaksi → semua nol
    await page.getByTestId("period-filter").click();
    await page.getByLabel("Dari tanggal").fill("2000-12-31");
    await page.getByLabel("Sampai tanggal").fill("2000-01-01");
    await expect(page.getByRole("group", { name: "Pilih periode" }).getByRole("alert")).toContainText("Tanggal awal harus sebelum tanggal akhir");
    await expect(page.getByRole("button", { name: "Terapkan" })).toBeDisabled();
    await page.getByLabel("Dari tanggal").fill("2000-01-01");
    await page.getByLabel("Sampai tanggal").fill("2000-12-31");
    await page.getByRole("button", { name: "Terapkan" }).click();
    await expect(page).toHaveURL(/from=2000-01-01&to=2000-12-31/);
    await expect(page.getByTestId("period-filter")).toContainText("1 Jan 2000 – 31 Des 2000");
    await expect(page.getByRole("region", { name: "Sebaran status" }).getByText("0 invoice")).toHaveCount(6);
    await expect(page.getByText("Belum ada data pada periode ini.")).toBeVisible();
    await expect(page.getByText("Belum ada invoice pada periode ini")).toBeVisible();

    // seluruh riwayat demo, lalu saring pelanggan
    await page.getByTestId("period-filter").click();
    await expect(page.getByLabel("Dari tanggal")).toHaveValue("2000-01-01"); // isian mengikuti periode aktif (bukan sisa ketikan lama)
    await page.getByLabel("Dari tanggal").fill("2020-01-01");
    await page.getByLabel("Sampai tanggal").fill(new Date().toISOString().slice(0, 10));
    await page.getByRole("button", { name: "Terapkan" }).click();
    await expect(page).toHaveURL(/from=2020-01-01/);
    const all = await sumCounts();
    expect(all).toBeGreaterThan(3);
    const select = page.getByLabel("Pelanggan", { exact: true });
    await select.selectOption({ label: "CV Bima Satria Jaya" });
    await expect(page).toHaveURL(/customerId=[0-9a-f-]{36}/);
    await expect(page).toHaveURL(/from=2020-01-01/); // periode ikut terbawa saat pelanggan berubah
    await expect(select).toHaveValue(/[0-9a-f-]{36}/);
    const bima = await sumCounts();
    expect(bima).toBeGreaterThan(0);
    expect(bima).toBeLessThan(all);
    // periode tetap terbawa ketika pelanggan sedang dipilih
    await page.getByTestId("period-filter").click();
    await page.getByRole("button", { name: "Tahun ini" }).click();
    await expect(page).toHaveURL(/customerId=[0-9a-f-]{36}/);
    await select.selectOption({ label: "Semua Pelanggan" });
    await expect(page).not.toHaveURL(/customerId=/);

    // tautan status → daftar invoice dengan filter yang sama
    await page.getByTestId("status-PAID").click();
    await expect(page).toHaveURL(/\/invoices\?.*paymentStatus=PAID/);
    await expect(page.getByRole("heading", { name: "Invoice", level: 1 })).toBeVisible();
  });

  test("peran tanpa dashboard (staf) diarahkan dan tidak melihat menu Dashboard; admin & finance melihatnya", async ({ page }) => {
    await login(page, "staff");
    const nav = page.getByRole("navigation", { name: "Menu utama" });
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
    const res = await page.goto("/dashboard");
    expect(res?.status()).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: "Dashboard Keuangan" })).toHaveCount(0);
    await page.goto("/invoices");
    await logout(page);
    await login(page, "admin");
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dashboard Keuangan" })).toBeVisible();
  });
});

test.describe("bilah atas: pencarian, lonceng, menu pengguna", () => {
  test("pencarian global: dari bilah atas ke halaman hasil lintas modul; kata kunci pendek ditolak; hasil mengarah ke dokumen", async ({ page }) => {
    await login(page, "finance");
    const box = page.getByRole("search").getByRole("searchbox", { name: "Cari invoice, pelanggan, atau transaksi" });
    await box.fill("bima");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=bima/);
    await expect(page.getByRole("heading", { name: "Pencarian", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Invoice \(\d+\)$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Pelanggan \(1\)$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Pembayaran \(\d+\)$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /CV Bima Satria Jaya/ }).first()).toBeVisible();

    // klik hasil invoice → halaman detail invoice
    await page.getByRole("heading", { name: /^Invoice \(\d+\)$/ }).locator("xpath=ancestor::section[1]").locator("ul a").first().click();
    await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);

    // terlalu pendek & tidak ditemukan
    await page.goto("/search?q=a");
    await expect(page.getByText("Kata kunci minimal 2 karakter.")).toBeVisible();
    await page.goto("/search");
    await expect(page.getByText("Ketik kata kunci untuk mulai mencari.")).toBeVisible();
    await page.goto("/search?q=zzzz-tidak-ada");
    await expect(page.getByText("Tidak ada hasil untuk “zzzz-tidak-ada”")).toBeVisible();

    // tautan "Lihat semua N →" muncul bila hasil melebihi batas tampilan, dan membawa kata kunci yang sama
    await page.goto("/search?q=00"); // nomor invoice demo memuat "00" (lebih dari 6 buah)
    const all = page.getByRole("link", { name: /^Lihat semua \d+ →$/ }).first();
    await expect(all).toHaveAttribute("href", "/invoices?q=00");
  });

  test("pencarian dilindungi login & dapat dipakai staf; tanpa sesi → login; kunci tidak mengeksekusi markup", async ({ page, request }) => {
    const anon = await request.get("/api/search?q=bima", { maxRedirects: 0 });
    expect([401, 403, 302, 307]).toContain(anon.status());
    await page.goto("/search?q=bima");
    await expect(page).toHaveURL(/\/login/);
    await login(page, "staff");
    await page.goto(`/search?q=${encodeURIComponent('<img src=x onerror=alert(1)>')}`);
    await expect(page.getByRole("heading", { name: "Pencarian", level: 1 })).toBeVisible();
    await expect(page.locator("main img")).toHaveCount(0); // diperlakukan sebagai teks
  });

  test("lonceng: titik merah & daftar pekerjaan menurut izin; butir mengarah ke daftar terfilter", async ({ page }) => {
    await login(page, "finance");
    const bell = page.getByTestId("bell");
    await expect(bell).toHaveAccessibleName(/^Notifikasi, \d+ butir menunggu$/); // data demo punya invoice jatuh tempo
    await expect(page.getByTestId("bell-dot")).toBeVisible();
    await bell.click();
    const menu = page.getByRole("menu", { name: "Notifikasi" });
    await expect(menu).toBeVisible();
    await expect(menu.getByText("Perlu tindakan")).toBeVisible();
    const overdue = menu.getByRole("menuitem", { name: /invoice jatuh tempo belum lunas/ });
    await expect(overdue).toHaveAttribute("href", "/invoices?paymentStatus=OVERDUE");
    await page.keyboard.press("Escape"); // Esc menutup dan fokus kembali ke lonceng
    await expect(menu).toHaveCount(0);
    await expect(bell).toBeFocused();

    await bell.click();
    await menu.getByRole("menuitem", { name: /invoice jatuh tempo belum lunas/ }).click();
    await expect(page).toHaveURL(/\/invoices\?paymentStatus=OVERDUE/);
    await expect(menu).toHaveCount(0); // menutup setelah memilih
  });

  test("menu pengguna: identitas & peran, ganti password, klik di luar menutup, Keluar mencabut sesi", async ({ page }) => {
    await login(page, "finance");
    const trigger = page.getByTestId("user-menu");
    await expect(trigger).toContainText("TRILOGIKA EDUTAMA");
    await openUserMenu(page);
    const menu = page.getByRole("menu", { name: "Menu pengguna" });
    await expect(menu).toContainText("finance@trilogika.test");
    await expect(menu).toContainText("Finance Manager");
    await expect(menu.getByRole("menuitem", { name: "Password" })).toHaveAttribute("href", "/change-password");

    await page.getByRole("heading", { name: "Dashboard Keuangan" }).click(); // klik di luar
    await expect(menu).toHaveCount(0);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    await logout(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("tampilan ponsel", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("tanpa gulir horizontal pada halaman utama; menu laci & ikon cari berfungsi; kedua tema", async ({ page }) => {
    await login(page, "finance");
    for (const path of ["/dashboard", "/invoices", "/search?q=bima", "/payments"]) {
      for (const t of ["light", "dark"]) {
        await page.goto(path);
        await page.evaluate((v) => document.documentElement.setAttribute("data-theme", v), t);
        const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
        expect(sw, `${path} (${t}) melebar ${sw}px pada layar ${cw}px`).toBeLessThanOrEqual(cw);
      }
    }
    await page.goto("/dashboard");
    await expect(page.getByRole("navigation", { name: "Menu utama" })).toHaveCount(0); // sidebar tersembunyi di ponsel
    await page.getByRole("button", { name: "Buka menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer.getByRole("link")).toHaveCount(14);
    await drawer.getByRole("link", { name: "Pembayaran" }).click();
    await expect(page).toHaveURL(/\/payments/);
    await expect(drawer).toHaveCount(0);

    await page.getByRole("link", { name: "Cari" }).click();
    await expect(page).toHaveURL(/\/search/);
    await expect(page.getByRole("searchbox", { name: "Kata kunci" })).toBeFocused(); // fokus langsung ke kotak cari
  });
});
