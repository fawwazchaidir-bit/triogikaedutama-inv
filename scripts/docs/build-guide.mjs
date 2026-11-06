// Membangun panduan pengguna: docs/panduan/bab/*.md + figures.json + img/ → docs/panduan/Panduan-Pengguna-FMS.{html,pdf}
// Pemakaian: node scripts/docs/build-guide.mjs [--no-pdf] [--embed]   (--embed = HTML mandiri, gambar di-inline base64)
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { marked } from "marked";
import sharp from "sharp";
import { chromium } from "playwright";

const ROOT = path.resolve("docs/panduan");
const OUT = path.join(ROOT, "dist");
const SMALL = path.join(OUT, "img");
mkdirSync(SMALL, { recursive: true });
const args = process.argv.slice(2);
const embed = args.includes("--embed");
const figs = JSON.parse(readFileSync(path.join(ROOT, "figures.json"), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const used = new Set();
let figNo = 0;
const missing = [];

// Gambar versi ringan untuk panduan (lebar 1100 px, JPEG q72)
async function small(id) {
  const dst = path.join(SMALL, `${id}.jpg`);
  await sharp(path.join(ROOT, "img", `${id}.jpg`)).resize({ width: 1100, withoutEnlargement: true }).jpeg({ quality: 72, mozjpeg: true }).toFile(dst);
  return dst;
}

const chapters = readdirSync(path.join(ROOT, "bab")).filter((f) => f.endsWith(".md")).sort();
let toc = [];
let body = "";
for (const f of chapters) {
  let md = readFileSync(path.join(ROOT, "bab", f), "utf8");
  const figHtml = [];
  md = md.replace(/^\{\{fig:([a-z0-9-]+)\}\}$/gm, (_, id) => {
    const fg = figs[id];
    if (!fg) { missing.push(`${f}: ${id}`); return ""; }
    used.add(id);
    figHtml.push(id);
    return `\n<!--FIG:${id}-->\n`;
  });
  let html = marked.parse(md, { gfm: true });
  for (const id of figHtml) {
    const fg = figs[id];
    figNo++;
    const src = embed ? `data:image/jpeg;base64,${(await sharp(await small(id)).toBuffer()).toString("base64")}` : `img/${id}.jpg`;
    if (!embed) await small(id);
    const legend = fg.marks.length ? `<ol class="legend">${fg.marks.map((m) => `<li value="${m.n}"><span class="n">${m.n}</span><span>${esc(m.text)}</span></li>`).join("")}</ol>` : "";
    html = html.replace(`<!--FIG:${id}-->`, `<figure id="fig-${id}"><figcaption class="ft">Gambar ${figNo} — ${esc(fg.title)}</figcaption><img src="${src}" alt="${esc(fg.title)}" ><p class="cap">${esc(fg.caption)}</p>${legend}</figure>`);
  }
  // anchor + TOC untuk h1/h2
  html = html.replace(/<h([12])>(.*?)<\/h\1>/g, (_, lv, t) => {
    const slug = `s-${toc.length}`;
    toc.push({ lv: Number(lv), t: t.replace(/<[^>]+>/g, ""), slug });
    return `<h${lv} id="${slug}">${t}</h${lv}>`;
  });
  body += `<section class="bab">${html}</section>\n`;
}

const unused = Object.keys(figs).filter((k) => !used.has(k));
if (missing.length) { console.error("Gambar tidak ditemukan di figures.json:\n" + missing.join("\n")); process.exit(1); }
if (unused.length) { console.error("Gambar belum dipakai di panduan (tidak lengkap):\n" + unused.join("\n")); process.exit(1); }

const tocHtml = `<nav class="toc"><h2 class="toc-h">Daftar Isi</h2><ul>${toc.filter((t) => t.lv <= 2).map((t) => `<li class="l${t.lv}"><a href="#${t.slug}">${t.t}</a></li>`).join("")}</ul></nav>`;
const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
const css = `
:root{--brand:#8a0f35;--ink:#1c1917;--muted:#57534e;--line:#e7e5e4}
*{box-sizing:border-box} body{font:14px/1.6 "Inter","Segoe UI",system-ui,sans-serif;color:var(--ink);margin:0;background:#fff}
main{max-width:900px;margin:0 auto;padding:24px}
.cover{min-height:92vh;display:flex;flex-direction:column;justify-content:center;border-left:10px solid var(--brand);padding-left:32px;page-break-after:always}
.cover h1{font-size:40px;margin:0 0 8px;color:var(--brand)} .cover p{font-size:18px;color:var(--muted);margin:4px 0}
h1{font-size:26px;color:var(--brand);border-bottom:2px solid var(--brand);padding-bottom:6px;margin-top:0;page-break-before:always}
.bab:first-of-type h1{page-break-before:auto}
h2{font-size:19px;margin-top:28px;border-bottom:1px solid var(--line);padding-bottom:3px} h3{font-size:16px;margin-top:22px}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:13px} th,td{border:1px solid var(--line);padding:6px 9px;text-align:left;vertical-align:top} th{background:#f5f5f4}
blockquote{margin:12px 0;padding:8px 14px;border-left:4px solid var(--brand);background:#fdf2f5;color:#44403c}
code,pre{background:#f5f5f4;border-radius:4px;font-size:12.5px} code{padding:1px 4px} pre{padding:10px;overflow:auto}
figure{margin:16px 0;border:1px solid var(--line);border-radius:8px;padding:10px;page-break-inside:avoid;background:#fafaf9}
figure img{width:100%;height:auto;border:1px solid var(--line);border-radius:4px;display:block}
.ft{font-weight:600;font-size:13px;color:var(--brand);margin-bottom:6px}
.cap{margin:8px 0 4px;color:var(--muted);font-size:12.5px}
.legend{list-style:none;padding:0;margin:6px 0 0;font-size:12.5px} .legend li{display:flex;gap:8px;margin:3px 0;align-items:flex-start}
.n{flex:none;width:19px;height:19px;border-radius:50%;background:#dc2626;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;margin-top:1px}
.toc ul{list-style:none;padding:0;columns:1} .toc li{margin:2px 0} .toc .l1{font-weight:600;margin-top:8px} .toc .l2{padding-left:18px;font-size:12.5px} .toc a{color:var(--ink);text-decoration:none}
.toc{page-break-after:always} .toc-h{border:0;margin-top:0}
@media print{main{max-width:none;padding:0} h2,h3{page-break-after:avoid}}
`;
const cover = `<header class="cover"><h1>Panduan Pengguna</h1><p><b>Trilogika Financial Management System</b></p><p>Untuk Pelaksana (Staf Administrasi Keuangan) dan Finance Manager</p><p>${figNo} tangkapan layar bernomor · ${chapters.length - 1} bab + lampiran</p><p>Versi ${today}</p></header>`;
const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Panduan Pengguna — Trilogika FMS</title><style>${css}</style></head><body><main>${cover}${tocHtml}${body}</main></body></html>`;
const htmlPath = path.join(OUT, embed ? "Panduan-Pengguna-FMS-mandiri.html" : "Panduan-Pengguna-FMS.html");
writeFileSync(htmlPath, html);
console.log(`HTML: ${htmlPath} (${figNo} gambar, ${toc.length} judul)`);

if (!args.includes("--no-pdf")) {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage();
  await page.goto("file://" + htmlPath, { waitUntil: "load" });
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))));
  const pdfPath = path.join(OUT, "Panduan-Pengguna-FMS.pdf");
  await page.pdf({ path: pdfPath, format: "A4", printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" }, displayHeaderFooter: true,
    headerTemplate: `<div style="font-size:8px;color:#78716c;width:100%;padding:0 14mm">Trilogika FMS — Panduan Pengguna</div>`,
    footerTemplate: `<div style="font-size:8px;color:#78716c;width:100%;text-align:right;padding:0 14mm">Halaman <span class="pageNumber"></span> / <span class="totalPages"></span></div>` });
  await browser.close();
  console.log(`PDF: ${pdfPath}`);
}
