#!/usr/bin/env node
// Smoke test pasca-deploy untuk Financial Management System — cek cepat (± 5 detik) bahwa instalasi sehat DAN aman.
// Tanpa dependensi (Node ≥ 18). Tidak mengubah data apa pun; percobaan login salah memakai email palsu (tidak mengunci akun asli).
//
//   SMOKE_URL=https://fms-staging.example.id node scripts/smoke.mjs
//   SMOKE_URL=… SMOKE_EMAIL=finance@… SMOKE_PASSWORD=… [SMOKE_TOTP_SECRET=BASE32…] node scripts/smoke.mjs   # + cek sesi & cookie
//
// Kode keluar: 0 = semua LULUS (peringatan boleh ada), 1 = ada yang GAGAL.
import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function totp(secretB32, now = Date.now()) {
  let bits = 0, v = 0; const bytes = [];
  for (const c of secretB32.toUpperCase().replace(/[\s=-]/g, "")) { v = (v << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { bytes.push((v >>> (bits - 8)) & 255); bits -= 8; } }
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(now / 30000)));
  const h = createHmac("sha1", Buffer.from(bytes)).update(msg).digest(); const o = h[19] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, "0");
}

/** @returns {Promise<{ ok: boolean, checks: { name: string, status: "PASS"|"FAIL"|"WARN"|"INFO", detail: string }[] }>} */
export async function runSmoke({ baseUrl, email, password, totpSecret, timeoutMs = 15000 }) {
  const base = new URL(baseUrl);
  const origin = base.origin;
  const isHttps = base.protocol === "https:";
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(base.hostname);
  const checks = [];
  const add = (name, status, detail = "") => checks.push({ name, status, detail });
  const check = (name, cond, detail = "", failStatus = "FAIL") => add(name, cond ? "PASS" : failStatus, detail);
  const req = (path, init = {}) => fetch(new URL(path, origin), { redirect: "manual", signal: AbortSignal.timeout(timeoutMs), ...init });
  const post = (path, body, headers = {}) => req(path, { method: "POST", headers: { "content-type": "application/json", origin, ...headers }, body: JSON.stringify(body) });

  // 1. Transport
  if (!isHttps && !isLocal) add("HTTPS", "FAIL", `${origin} memakai HTTP. Staging/produksi WAJIB HTTPS (cookie sesi Secure & HSTS).`);
  else add("HTTPS", isHttps ? "PASS" : "INFO", isHttps ? "" : "HTTP pada localhost (hanya untuk uji lokal)");

  // 2. Health
  let health;
  try {
    health = await req("/api/health");
    const j = await health.json().catch(() => ({}));
    check("Health check (aplikasi + database)", health.status === 200 && j.status === "ok", `HTTP ${health.status} ${JSON.stringify(j)}`);
    check("Health: tidak di-cache", /no-store/.test(health.headers.get("cache-control") ?? ""));
  } catch (e) {
    add("Health check (aplikasi + database)", "FAIL", `tidak terhubung: ${e.message}`);
    return { ok: false, checks }; // tanpa koneksi, pemeriksaan lain tak berarti
  }

  // 3. Jam server vs jam lokal (selisih besar merusak TOTP & tanda tangan integrasi)
  const serverDate = Date.parse(health.headers.get("date") ?? "");
  if (Number.isFinite(serverDate)) {
    const skew = Math.abs(Date.now() - serverDate) / 1000;
    add("Selisih jam server ↔ pemeriksa", skew <= 120 ? "PASS" : "WARN", `${skew.toFixed(0)} detik${skew > 120 ? " — periksa NTP (TOTP & API integrasi bergantung pada jam)" : ""}`);
  }

  // 4. Halaman login & header keamanan
  const login = await req("/login");
  check("Halaman login terbuka", login.status === 200 && /text\/html/.test(login.headers.get("content-type") ?? ""), `HTTP ${login.status}`);
  const h = login.headers;
  check("Header: Content-Security-Policy (frame-ancestors, object-src)", /frame-ancestors/.test(h.get("content-security-policy") ?? ""));
  check("Header: X-Content-Type-Options: nosniff", (h.get("x-content-type-options") ?? "").toLowerCase() === "nosniff");
  check("Header: X-Frame-Options", Boolean(h.get("x-frame-options")));
  check("Header: Referrer-Policy", Boolean(h.get("referrer-policy")));
  check("Header: tidak membocorkan X-Powered-By", !h.get("x-powered-by"));
  if (isHttps) check("Header: Strict-Transport-Security (HSTS)", /max-age=\d{7,}/.test(h.get("strict-transport-security") ?? ""));

  // 5. Halaman terlindungi & API tanpa sesi
  const dash = await req("/dashboard");
  check("/dashboard tanpa login → diarahkan ke /login", [301, 302, 303, 307, 308].includes(dash.status) && /\/login/.test(dash.headers.get("location") ?? ""), `HTTP ${dash.status} → ${dash.headers.get("location")}`);
  const me = await req("/api/me");
  check("/api/me tanpa login → 401", me.status === 401, `HTTP ${me.status}`);
  const inv = await req("/api/invoices");
  check("/api/invoices tanpa login → 401", inv.status === 401, `HTTP ${inv.status}`);

  // 6. CSRF: asal lintas-situs ditolak
  const evil = await post("/api/auth/login", { email: "x@x.id", password: "x" }, { origin: "https://evil.example" });
  check("CSRF: Origin asing ditolak (403)", evil.status === 403, `HTTP ${evil.status}`);

  // 7. Login salah: pesan generik, tanpa cookie, memakai email palsu
  const bad = await post("/api/auth/login", { email: "smoke-check@invalid.example", password: "salah-salah-salah-1" });
  const badJson = await bad.json().catch(() => ({}));
  check("Login salah → 401 dengan pesan generik", bad.status === 401 && badJson?.error?.message === "Email atau password salah.", `HTTP ${bad.status} "${badJson?.error?.message}"`);
  check("Login salah → tanpa cookie sesi", bad.headers.getSetCookie().length === 0);

  // 8. API integrasi
  const ping = await req("/api/integration/v1/ping");
  if (ping.status === 503) add("API integrasi", "INFO", "nonaktif (INTEGRATION_MASTER_KEY kosong) — benar untuk staging awal");
  else check("API integrasi tanpa tanda tangan → 401", ping.status === 401, `HTTP ${ping.status}`);

  // 9. Sesi nyata (opsional)
  if (email && password) {
    const r = await post("/api/auth/login", { email, password });
    const j = await r.json().catch(() => ({}));
    if (r.status !== 200) add("Login akun uji", "FAIL", `HTTP ${r.status} ${j?.error?.message ?? ""}`);
    else {
      let cookies, user = j.data?.user;
      if (j.data?.requiresTwoFactor) {
        if (!totpSecret) add("Login akun uji", "WARN", "akun memakai 2FA; isi SMOKE_TOTP_SECRET untuk menguji sesi — pemeriksaan sesi dilewati");
        else {
          const r2 = await post("/api/auth/2fa", { challenge: j.data.challenge, code: totp(totpSecret, Date.now() + 30000) }); // langkah berikutnya: aman bila kode saat ini sudah terpakai
          const j2 = await r2.json().catch(() => ({}));
          if (r2.status !== 200) add("Login 2FA akun uji", "FAIL", `HTTP ${r2.status} ${j2?.error?.message ?? ""}`);
          else { cookies = r2.headers.getSetCookie(); user = j2.data?.user; }
        }
      } else cookies = r.headers.getSetCookie();
      if (cookies) {
        const c = cookies.find((x) => /session/.test(x)) ?? "";
        const name = c.split("=")[0];
        check("Cookie sesi: HttpOnly", /;\s*httponly/i.test(c), name);
        check("Cookie sesi: SameSite=Lax/Strict", /;\s*samesite=(lax|strict)/i.test(c));
        if (isHttps) { check("Cookie sesi: Secure", /;\s*secure/i.test(c)); check("Cookie sesi: awalan __Host-", name.startsWith("__Host-")); }
        const cookie = c.split(";")[0];
        const meR = await req("/api/me", { headers: { cookie } });
        const meJ = await meR.json().catch(() => ({}));
        check("Sesi sah: /api/me → 200", meR.status === 200 || (user?.mustChangePassword && meR.status === 403), `HTTP ${meR.status} ${meJ?.data?.email ?? ""}`);
        if (user?.mustChangePassword) add("Akun uji", "WARN", "masih wajib ganti password (mustChangePassword)");
        if (user?.mfaSetupRequired) add("Akun uji", "WARN", "peran ini wajib 2FA tetapi belum diaktifkan");
        const lo = await post("/api/auth/logout", {}, { cookie });
        check("Logout berhasil", lo.status === 200, `HTTP ${lo.status}`);
        const after = await req("/api/me", { headers: { cookie } });
        check("Sesi dicabut setelah logout → 401", after.status === 401, `HTTP ${after.status}`);
      }
    }
  } else add("Pemeriksaan sesi", "INFO", "dilewati (isi SMOKE_EMAIL & SMOKE_PASSWORD untuk menguji login, cookie, dan logout)");

  return { ok: !checks.some((c) => c.status === "FAIL"), checks };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const baseUrl = process.env.SMOKE_URL ?? process.argv[2];
  if (!baseUrl) { console.error("Pakai: SMOKE_URL=https://domain node scripts/smoke.mjs"); process.exit(2); }
  const { ok, checks } = await runSmoke({ baseUrl, email: process.env.SMOKE_EMAIL, password: process.env.SMOKE_PASSWORD, totpSecret: process.env.SMOKE_TOTP_SECRET });
  const icon = { PASS: "✔", FAIL: "✘", WARN: "!", INFO: "·" };
  for (const c of checks) console.log(`${icon[c.status]} [${c.status}] ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  const n = (s) => checks.filter((c) => c.status === s).length;
  console.log(`\n${ok ? "SMOKE TEST LULUS" : "SMOKE TEST GAGAL"} — ${n("PASS")} lulus, ${n("FAIL")} gagal, ${n("WARN")} peringatan, ${n("INFO")} info`);
  process.exit(ok ? 0 : 1);
}
