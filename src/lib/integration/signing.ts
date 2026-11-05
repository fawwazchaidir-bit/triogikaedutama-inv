import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Tanda tangan permintaan mesin-ke-mesin (skema "FMS1-HMAC-SHA256"). MURNI: tanpa DB/env, dipakai server, klien contoh, dan tes.
 *
 * String kanonik (dipisah "\n", tanpa baris tambahan di akhir):
 *   FMS1-HMAC-SHA256 · METHOD (huruf besar) · PATH (apa adanya, tanpa host) · QUERY kanonik · TIMESTAMP (detik Unix) · NONCE · sha256-hex(BADAN MENTAH)
 * Tanda tangan = hex(HMAC-SHA256(secret, string kanonik)). Badan mentah = byte persis yang dikirim (GET: string kosong).
 * Spesifikasi lengkap beserta contoh PHP/Node: docs/INTEGRATION.md.
 */
export const SIGNING_SCHEME = "FMS1-HMAC-SHA256";
export const HEADER = {
  key: "x-fms-key",
  timestamp: "x-fms-timestamp",
  nonce: "x-fms-nonce",
  signature: "x-fms-signature",
  idempotency: "idempotency-key",
} as const;

/** Selisih waktu maksimum antara jam klien & server (detik). */
export const MAX_CLOCK_SKEW_SECONDS = 300;

export const KEY_ID_PATTERN = /^fmsk_[0-9a-f]{20}$/;
export const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,128}$/;
export const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;

export const sha256Hex = (data: string | Uint8Array): string => createHash("sha256").update(data).digest("hex");

/** Pengodean persen gaya RFC 3986 (encodeURIComponent + karakter !'()* ikut dikodekan). */
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** Query kanonik: pasangan (nama, nilai) dikodekan lalu diurutkan menurut nama, kemudian nilai; digabung "&". Tanpa query → "". */
export function canonicalQuery(search: string | URLSearchParams): string {
  const params = typeof search === "string" ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search) : search;
  return [...params.entries()]
    .map(([k, v]) => [enc(k), enc(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

export interface SignInput {
  method: string;
  /** Hanya path, mis. "/api/integration/v1/ping" (tanpa host & query). */
  path: string;
  query?: string | URLSearchParams;
  timestamp: number | string;
  nonce: string;
  body?: string | Uint8Array;
}

export function canonicalString(i: SignInput): string {
  return [SIGNING_SCHEME, i.method.toUpperCase(), i.path, canonicalQuery(i.query ?? ""), String(i.timestamp), i.nonce, sha256Hex(i.body ?? "")].join("\n");
}

export const signCanonical = (secret: string, canonical: string): string => createHmac("sha256", secret).update(canonical).digest("hex");

export const sign = (secret: string, i: SignInput): string => signCanonical(secret, canonicalString(i));

/** Perbandingan hex waktu-konstan; panjang berbeda → false (tanpa melempar). */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || !SIGNATURE_PATTERN.test(a) || !SIGNATURE_PATTERN.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/** Header lengkap untuk satu permintaan (dipakai klien contoh & tes). `idempotencyKey` wajib untuk metode selain GET. */
export function signedHeaders(opts: { keyId: string; secret: string; idempotencyKey?: string; now?: number; nonce?: string; timestamp?: number | string } & Omit<SignInput, "timestamp" | "nonce">): Record<string, string> {
  const timestamp = opts.timestamp ?? Math.floor((opts.now ?? Date.now()) / 1000);
  const nonce = opts.nonce ?? createHash("sha256").update(`${Math.random()}${process.hrtime.bigint()}`).digest("hex").slice(0, 32);
  const headers: Record<string, string> = {
    [HEADER.key]: opts.keyId,
    [HEADER.timestamp]: String(timestamp),
    [HEADER.nonce]: nonce,
    [HEADER.signature]: sign(opts.secret, { method: opts.method, path: opts.path, query: opts.query, body: opts.body, timestamp, nonce }),
  };
  if (opts.idempotencyKey) headers[HEADER.idempotency] = opts.idempotencyKey;
  return headers;
}
