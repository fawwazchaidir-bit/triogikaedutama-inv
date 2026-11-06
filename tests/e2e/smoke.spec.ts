import { expect, test } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { runSmoke as RunSmoke } from "../../scripts/smoke.mjs";
import { E2E_PASSWORD } from "./global-setup";

/**
 * Menjaga skrip smoke test pasca-deploy tetap benar: dijalankan terhadap server E2E sungguhan (build produksi).
 * Bila ada pemeriksaan keamanan yang berubah (header, cookie, CSRF, pesan login), tes ini gagal → skrip diperbarui bersama kodenya.
 */
// Playwright mengubah TS menjadi CJS; skrip operasional berupa ESM murni (import.meta) → dimuat lewat import() asli.
const loadSmoke = async () =>
  (await (new Function("u", "return import(u)") as (u: string) => Promise<{ runSmoke: typeof RunSmoke }>)(pathToFileURL(path.resolve(__dirname, "../../scripts/smoke.mjs")).href)).runSmoke;

test.describe("smoke test pasca-deploy (scripts/smoke.mjs)", () => {
  test("semua pemeriksaan LULUS pada instalasi sehat (tanpa & dengan akun uji)", async () => {
    const runSmoke = await loadSmoke();
    const anon = await runSmoke({ baseUrl: "http://127.0.0.1:3100" });
    expect(anon.checks.filter((c: { status: string }) => c.status === "FAIL"), JSON.stringify(anon.checks.filter((c: { status: string }) => c.status === "FAIL"))).toEqual([]);
    expect(anon.ok).toBe(true);
    expect(anon.checks.length).toBeGreaterThanOrEqual(15);

    const full = await runSmoke({ baseUrl: "http://127.0.0.1:3100", email: "finance@trilogika.test", password: E2E_PASSWORD });
    expect(full.checks.filter((c: { status: string }) => c.status === "FAIL")).toEqual([]);
    for (const name of ["Ikon tab: /favicon.ico tersedia", "Cookie sesi: HttpOnly", "Sesi sah: /api/me → 200", "Logout berhasil", "Sesi dicabut setelah logout → 401"]) {
      expect(full.checks.find((c: { name: string }) => c.name === name)?.status, name).toBe("PASS");
    }
  });

  test("mendeteksi masalah nyata: server tak terjangkau → GAGAL; HTTP non-lokal → GAGAL; kredensial salah → GAGAL", async () => {
    const runSmoke = await loadSmoke();
    const down = await runSmoke({ baseUrl: "http://127.0.0.1:1", timeoutMs: 2000 });
    expect(down.ok).toBe(false);
    const http = await runSmoke({ baseUrl: "http://staging.example.invalid", timeoutMs: 2000 });
    expect(http.ok).toBe(false);
    expect(http.checks.find((c: { name: string }) => c.name === "HTTPS")?.status).toBe("FAIL");
    const badLogin = await runSmoke({ baseUrl: "http://127.0.0.1:3100", email: "finance@trilogika.test", password: "bukan-password-yang-benar" });
    expect(badLogin.ok).toBe(false);
    expect(badLogin.checks.find((c: { name: string }) => c.name === "Login akun uji")?.status).toBe("FAIL");
  });
});
