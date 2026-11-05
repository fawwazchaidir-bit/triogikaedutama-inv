// Klien contoh API integrasi Financial Management System (skema FMS1-HMAC-SHA256) — Node ≥ 18 (Portal HRIS / skrip uji).
// Tanpa dependensi. Spesifikasi: docs/INTEGRATION.md.
//
//   const c = new FmsClient({ baseUrl: "https://keuangan.example.id", keyId: "fmsk_…", secret: "fmss_…" });
//   await c.request("GET", "/api/integration/v1/ping");
//   await c.request("POST", "/api/integration/v1/…", { json: { a: 1 }, idempotencyKey: "kunci-unik-per-kejadian" });
import { createHash, createHmac, randomBytes } from "node:crypto";

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export function canonicalQuery(query = {}) {
  const pairs = [];
  for (const [k, v] of Object.entries(query)) for (const one of [].concat(v)) pairs.push([enc(String(k)), enc(String(one))]);
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  return pairs.map(([k, v]) => `${k}=${v}`).join("&");
}

export function sign(secret, { method, path, query = {}, timestamp, nonce, body = "" }) {
  const canonical = ["FMS1-HMAC-SHA256", method.toUpperCase(), path, canonicalQuery(query), String(timestamp), nonce, createHash("sha256").update(body).digest("hex")].join("\n");
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

export class FmsClient {
  constructor({ baseUrl, keyId, secret, timeoutMs = 15000 }) { Object.assign(this, { baseUrl: baseUrl.replace(/\/$/, ""), keyId, secret, timeoutMs }); }

  async request(method, path, { json, idempotencyKey, query = {} } = {}) {
    method = method.toUpperCase();
    const body = json === undefined ? "" : JSON.stringify(json); // badan MENTAH: kirim string yang sama persis dengan yang ditandatangani
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = randomBytes(16).toString("hex");
    const headers = {
      "X-FMS-Key": this.keyId, "X-FMS-Timestamp": String(timestamp), "X-FMS-Nonce": nonce,
      "X-FMS-Signature": sign(this.secret, { method, path, query, timestamp, nonce, body }), Accept: "application/json",
    };
    if (method !== "GET") {
      if (!idempotencyKey) throw new Error("Idempotency-Key wajib untuk permintaan selain GET.");
      headers["Idempotency-Key"] = idempotencyKey;
      headers["Content-Type"] = "application/json";
    }
    const qs = canonicalQuery(query);
    const res = await fetch(`${this.baseUrl}${path}${qs ? `?${qs}` : ""}`, { method, headers, body: method === "GET" ? undefined : body, signal: AbortSignal.timeout(this.timeoutMs) });
    return { status: res.status, body: await res.json().catch(() => null), headers: Object.fromEntries(res.headers) };
  }
}
