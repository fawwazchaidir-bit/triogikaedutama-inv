// Membuat CSV rekening koran DEMO dari buku kas "Bank Mandiri IDR" (DB uji). Keluaran: JSON + CSV di folder tujuan (argv[2]).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const out = process.argv[2] ?? ".";
mkdirSync(out, { recursive: true });
const { prisma } = await import("../../src/server/db.ts");
const { getAccountLedger } = await import("../../src/server/services/finance-statements.ts");
const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
const actor = { userId: admin.id, email: admin.email, name: admin.name, role: "ADMIN" as const };
const acc = await prisma.cashAccount.findFirstOrThrow({ where: { name: "Bank Mandiri IDR" } });
const start = acc.openingDate.toISOString().slice(0, 10);
const end = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
const led = await getAccountLedger(actor, { accountId: acc.id, from: start, to: end });
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
type L = { date: string; desc: string; amt: number };
let lines: L[] = led.rows.map((r) => ({ date: r.date, desc: r.description.replace(/;/g, ","), amt: r.signed }));
if (lines.length >= 3) {
  lines = lines.slice(0, -1); // transaksi terakhir di buku "beredar" (belum muncul di bank)
  const k = Math.max(0, lines.findIndex((l) => /Sewa kantor/i.test(l.desc)));
  lines[k] = { ...lines[k]!, date: addDays(lines[k]!.date, 20) > end ? end : addDays(lines[k]!.date, 20) }; // bergeser jauh → dicocokkan manual
}
lines.push({ date: end, desc: "BIAYA ADM BULANAN", amt: -15000 }, { date: end, desc: "BUNGA TABUNGAN", amt: 21000 });
lines.sort((a, b) => a.date.localeCompare(b.date));
const nf = (n: number) => String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + ",00";
let bal = led.opening;
const rows = lines.map((l) => { bal += l.amt; return `${dmy(l.date)};${l.desc};${l.amt < 0 ? nf(l.amt) : ""};${l.amt > 0 ? nf(l.amt) : ""};${nf(bal)}`; });
writeFileSync(join(out, "mutasi-mandiri.csv"), ["Tanggal;Keterangan;Debit;Kredit;Saldo", ...rows].join("\n") + "\n");
writeFileSync(join(out, "mutasi-mandiri.json"), JSON.stringify({ start, end, opening: led.opening, closing: bal, lines: lines.length }));
console.log(JSON.stringify({ start, end, opening: led.opening, closing: bal, lines: lines.length }));
await prisma.$disconnect();
