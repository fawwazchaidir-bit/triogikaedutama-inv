// Kerangka tangkapan layar panduan pengguna: gambar beranotasi (penanda angka merah) + legenda yang disimpan bersama skrip.
// Sumber tunggal: teks legenda ditulis di skenario (shots.mjs) tepat di samping elemen yang ditandai → tidak bisa tidak sinkron.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";

export const BASE = process.env.GUIDE_URL ?? "http://127.0.0.1:3100";
export const PASSWORD = "Sandi-Uji-Lokal-2026!";
export const OUT = path.resolve("docs/panduan");
export const IMG = path.join(OUT, "img");
mkdirSync(IMG, { recursive: true });

const FIG_FILE = path.join(OUT, "figures.json");
export const figures = existsSync(FIG_FILE) ? JSON.parse(readFileSync(FIG_FILE, "utf8")) : {};
export const saveFigures = () => writeFileSync(FIG_FILE, JSON.stringify(figures, null, 1));

export const W = 1280, H = 820;

export async function launch() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const mk = async (who) => {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.25, locale: "id-ID", timezoneId: "Asia/Jakarta", colorScheme: "light", acceptDownloads: true });
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    page.on("pageerror", (e) => console.log(`  [pageerror ${who}]`, e.message));
    return { ctx, page, who };
  };
  return { browser, mk };
}

export async function login(page, email, { totpSecret } = {}) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  if (totpSecret) {
    await page.getByLabel("Kode verifikasi").fill(totp(totpSecret, Date.now() + 30000));
    await page.getByRole("button", { name: "Verifikasi" }).click();
  }
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function totp(secret, now = Date.now()) {
  let bits = 0, v = 0; const bytes = [];
  for (const c of secret.replace(/\s/g, "")) { v = (v << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { bytes.push((v >>> (bits - 8)) & 255); bits -= 8; } }
  const m = Buffer.alloc(8); m.writeBigUInt64BE(BigInt(Math.floor(now / 30000)));
  const h = createHmac("sha1", Buffer.from(bytes)).update(m).digest(); const o = h[19] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, "0");
}

/** Hitung ulang tinggi viewport agar seluruh halaman muat (tanpa fullPage, supaya sidebar/header tetap proporsional). */
export async function fit(page, max = 2000) {
  await page.setViewportSize({ width: W, height: H });
  await page.waitForTimeout(150);
  const h = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  await page.setViewportSize({ width: W, height: Math.min(Math.max(h, H), max) });
  await page.waitForTimeout(250);
}

async function drawMarks(page, marks) {
  for (const [i, m] of marks.entries()) {
    const loc = (typeof m.at === "string" ? page.locator(m.at) : m.at).first();
    if (!(await loc.count())) throw new Error(`penanda #${i + 1} "${m.text}" tidak ditemukan`);
    await loc.evaluate((el, n) => {
      const dlg = el.closest("dialog[open]");
      const r = el.getBoundingClientRect();
      const d = dlg ? dlg.getBoundingClientRect() : null;
      const x = d ? r.left - d.left : r.left + scrollX, y = d ? r.top - d.top : r.top + scrollY;
      const host = dlg ?? document.body;
      const box = document.createElement("div");
      box.dataset.guideMark = "1";
      box.style.cssText = `position:absolute;left:${x - 3}px;top:${y - 3}px;width:${r.width + 6}px;height:${r.height + 6}px;border:2.5px solid #e11d48;border-radius:8px;pointer-events:none;z-index:2147483647;box-shadow:0 0 0 2px rgba(255,255,255,.75)`;
      const b = document.createElement("div");
      b.textContent = String(n);
      b.style.cssText = `position:absolute;left:${Math.max(2, x - 13)}px;top:${Math.max(2, y - 13)}px;width:24px;height:24px;border-radius:50%;background:#e11d48;color:#fff;font:700 13px/24px system-ui,sans-serif;text-align:center;border:2px solid #fff;pointer-events:none;z-index:2147483647;box-shadow:0 1px 3px rgba(0,0,0,.4)`;
      b.dataset.guideMark = "1";
      host.append(box, b);
    }, i + 1);
  }
}

export async function dumpUi(page) {
  return page.evaluate(() => {
    const root = document.querySelector("dialog[open]") ?? document.querySelector("main") ?? document.body;
    const vis = (e) => e.offsetParent !== null || getComputedStyle(e).position === "fixed";
    const txt = (e) => (e.innerText || e.getAttribute("aria-label") || e.value || "").replace(/\s+/g, " ").trim();
    const uniq = (a) => [...new Set(a.filter(Boolean))].slice(0, 60);
    return {
      judul: uniq([...root.querySelectorAll("h1,h2,h3")].filter(vis).map(txt)),
      tombol: uniq([...root.querySelectorAll("button,a[role=button],summary")].filter(vis).map(txt)),
      isian: uniq([...root.querySelectorAll("label")].filter(vis).map(txt)),
      kolom: uniq([...root.querySelectorAll("th")].filter(vis).map(txt)),
      pilihan: uniq([...root.querySelectorAll("select")].filter(vis).map((s) => `${s.getAttribute("aria-label") ?? s.name}: ${[...s.options].map((o) => o.text).join(" | ")}`)),
    };
  });
}

/**
 * Ambil satu gambar panduan.
 *  id      nama berkas (img/<id>.jpg) & kunci figur
 *  title   judul figur
 *  caption kalimat penjelasan di bawah gambar
 *  marks   [{ at: selector|Locator, text: "keterangan angka" }] — nomor otomatis 1..n
 *  fit     true → viewport disesuaikan tinggi halaman (maks 2000)
 *  clip    true → hanya area dialog terbuka
 */
export async function shot(page, id, { title, caption = "", marks = [], fit: doFit = false, dialog = false, h, w } = {}) {
  if (h || w) await page.setViewportSize({ width: w ?? W, height: h ?? H });
  else if (doFit) await fit(page);
  else await page.setViewportSize({ width: W, height: H });
  await page.waitForTimeout(300);
  await drawMarks(page, marks);
  const file = path.join(IMG, `${id}.jpg`);
  if (dialog) await page.locator("dialog[open]").first().screenshot({ path: file, type: "jpeg", quality: 84 });
  else await page.screenshot({ path: file, type: "jpeg", quality: 84 });
  const ui = await dumpUi(page);
  await page.evaluate(() => document.querySelectorAll("[data-guide-mark]").forEach((e) => e.remove()));
  figures[id] = { title, caption, marks: marks.map((m, i) => ({ n: i + 1, text: m.text })), ui };
  saveFigures();
  console.log(`  ✔ ${id}`);
  if (!w) await page.setViewportSize({ width: W, height: H });
}

/** Gambar dari berkas PDF (halaman 1) memakai pdftoppm — peramban headless tidak menampilkan penampil PDF. */
import { execFileSync } from "node:child_process";
export function pdfShot(pdfPath, id, { title, caption = "", marks = [] } = {}) {
  const base = path.join(IMG, id);
  execFileSync("pdftoppm", ["-jpeg", "-jpegopt", "quality=86", "-r", "110", "-f", "1", "-l", "1", "-singlefile", pdfPath, base]);
  figures[id] = { title, caption, marks: marks.map((m, i) => ({ n: i + 1, text: m.text })), ui: {} };
  saveFigures();
  console.log(`  ✔ ${id} (pdf)`);
}
