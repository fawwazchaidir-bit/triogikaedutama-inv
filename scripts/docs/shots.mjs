#!/usr/bin/env node
// Pembuat gambar panduan pengguna. Jalankan terhadap server DENGAN data demo bersih (lihat docs/panduan/README.md):
//   GUIDE_URL=http://127.0.0.1:3100 node scripts/docs/shots.mjs [--only ch01,ch05]
// Setiap bab berada di scripts/docs/ch/NN-*.mjs dan mengekspor `run(env)`. Urutan bab penting (data dibuat bertahap lewat UI).
import { readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { launch, login, saveFigures, figures, BASE } from "./lib.mjs";

const oi = process.argv.indexOf("--only");
const only = (process.argv.find((a) => a.startsWith("--only="))?.slice(7) ?? (oi >= 0 ? process.argv[oi + 1] : "") ?? "").split(",").filter(Boolean);
const { browser, mk } = await launch();
const A = await mk("admin"), F = await mk("finance"), S = await mk("staff");
await Promise.all([login(A.page, "admin@trilogika.test"), login(F.page, "finance@trilogika.test"), login(S.page, "staff@trilogika.test")]);
const env = { A, F, S, mk, base: BASE, browser };

const dir = path.resolve("scripts/docs/ch");
for (const f of readdirSync(dir).filter((x) => x.endsWith(".mjs")).sort()) {
  const id = f.slice(0, 4);
  if (only.length && !only.includes(id)) continue;
  console.log(`\n== ${f}`);
  const mod = await import(pathToFileURL(path.join(dir, f)).href);
  try { await mod.run(env); } catch (e) {
    for (const w of [S, F, A]) await w.page.screenshot({ path: `${process.env.GUIDE_DEBUG_DIR ?? "/tmp"}/gagal-${w.who}.png` }).catch(() => {});
    console.error(`\nGAGAL pada ${f}: ${e.message.split("\n").slice(0, 9).join("\n")}\n${(e.stack||"").split("\n").find((l) => l.includes("scripts/docs/ch")) ?? ""}`); await browser.close(); process.exit(1);
  }
}
saveFigures();
await browser.close();
console.log(`\nSelesai: ${Object.keys(figures).length} figur.`);
