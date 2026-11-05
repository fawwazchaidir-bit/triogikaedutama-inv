import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Pagar struktural: setiap route handler API WAJIB lewat `route()` (sesi + izin + pemeriksaan Origin/CSRF + error aman)
 * atau `publicRoute()` (hanya Origin). Mencegah endpoint baru "lupa" autentikasi.
 * Pengecualian terkendali: `integration/v1/**` (API mesin-ke-mesin) WAJIB memakai `machineRoute()` (tanda tangan HMAC) dan sebaliknya
 * `machineRoute()` TIDAK boleh dipakai di luar folder itu.
 */
const API_DIR = path.resolve(__dirname, "../../src/app/api");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : n === "route.ts" ? [p] : [];
  });
}

describe("route handler API", () => {
  const files = walk(API_DIR).map((f) => ({ file: path.relative(API_DIR, f), src: readFileSync(f, "utf8") }));

  it("ditemukan banyak endpoint", () => expect(files.length).toBeGreaterThan(30));

  it("setiap handler memakai route()/publicRoute() — kecuali health check yang memang publik & hanya GET", () => {
    const offenders = files.filter((f) => f.file !== "health/route.ts" && !f.file.startsWith("integration/v1/") && !/export const (GET|POST|PUT|PATCH|DELETE) = (route|publicRoute)(<[^>]*>)?\(/.test(f.src) && !/export const (GET|POST|PUT|PATCH|DELETE) = route</.test(f.src));
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("integration/v1/** hanya memakai machineRoute(); machineRoute tidak dipakai di tempat lain", () => {
    const machine = files.filter((f) => f.file.startsWith("integration/v1/"));
    expect(machine.length).toBeGreaterThan(0);
    const wrong = machine.filter((f) => !/export const (GET|POST|PUT|PATCH|DELETE) = machineRoute(<[^>]*>)?\(/.test(f.src) || /\b(route|publicRoute)\(/.test(f.src.replace(/machineRoute\(/g, "")));
    expect(wrong.map((f) => f.file)).toEqual([]);
    expect(files.filter((f) => !f.file.startsWith("integration/v1/") && /machineRoute\(/.test(f.src)).map((f) => f.file)).toEqual([]);
  });

  it("tidak ada handler yang diekspor sebagai function biasa (melewati wrapper)", () => {
    const raw = files.filter((f) => /export (async )?function (GET|POST|PUT|PATCH|DELETE)/.test(f.src)).map((f) => f.file);
    expect(raw).toEqual(["health/route.ts"]); // satu-satunya, dan hanya GET
    expect(files.find((f) => f.file === "health/route.ts")!.src).not.toMatch(/export (async )?function (POST|PUT|PATCH|DELETE)/);
  });

  it("publicRoute hanya dipakai oleh dua langkah login (password, lalu kode 2FA)", () => {
    const pub = files.filter((f) => /publicRoute\(/.test(f.src)).map((f) => f.file).sort();
    expect(pub).toEqual(["auth/2fa/route.ts", "auth/login/route.ts"]);
  });

  it("handler tidak mem-parse body sendiri (harus lewat readJson/readUpload yang membatasi ukuran & tipe)", () => {
    const offenders = files.filter((f) => /req\.json\(\)|request\.json\(\)/.test(f.src)).map((f) => f.file);
    expect(offenders).toEqual([]);
  });
});
