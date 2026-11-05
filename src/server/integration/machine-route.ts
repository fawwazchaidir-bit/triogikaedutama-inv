import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodType } from "zod";
import { prisma } from "../db";
import { AppError, Errors } from "../errors";
import { errorResponse, ApiResult } from "../http";
import { requestMeta } from "../request-context";
import { blockedSeconds, hashKey, recordFailure, type LimitConfig } from "../auth/rate-limit";
import {
  HEADER, IDEMPOTENCY_KEY_PATTERN, KEY_ID_PATTERN, MAX_CLOCK_SKEW_SECONDS, NONCE_PATTERN, SIGNATURE_PATTERN,
  canonicalQuery, canonicalString, safeEqualHex, sha256Hex, signCanonical,
} from "@/lib/integration/signing";
import { isScope, type IntegrationScope } from "@/lib/integration/scopes";
import { deriveSecret, integrationEnabled } from "./secrets";

/**
 * Pembungkus route untuk sistem lain (bukan browser): TANPA cookie/CSRF, otentikasi = tanda tangan HMAC per permintaan.
 * Urutan pemeriksaan (sengaja): batas gagal-otentikasi → format header → tanda tangan (waktu-konstan; kunci tak dikenal/dicabut
 * dijawab sama persis agar keberadaan kunci tidak bocor) → kesegaran jam → daftar IP → batas laju → nonce (anti-replay) → scope
 * → kunci idempotensi → handler. Spesifikasi: docs/INTEGRATION.md.
 */
export interface MachinePrincipal {
  clientId: string;
  keyId: string;
  name: string;
  scopes: IntegrationScope[];
  ip: string | null;
  userAgent: string | null;
  requestId: string;
}

export interface MachineHandlerArgs<P> {
  req: Request;
  principal: MachinePrincipal;
  /** Badan mentah persis seperti yang ditandatangani (jangan baca `req` lagi). */
  rawBody: string;
  params: P;
  /** Parse badan sebagai JSON + validasi Zod (422 bila tidak sesuai). */
  json: <T>(schema: ZodType<T>) => T;
}

export interface MachineRouteOptions {
  /** Scope yang wajib dimiliki kredensial. Tanpa scope = cukup kredensial sah (mis. ping). */
  scope?: IntegrationScope;
  /** Wajib Idempotency-Key untuk metode penulis (bawaan benar). Matikan hanya untuk endpoint yang memang murni-baca. */
  idempotent?: boolean;
}

const MAX_BODY_BYTES = 1_000_000;
const STALE_IN_PROGRESS_MS = 120_000;
const AUTH_FAIL_LIMIT: LimitConfig = { max: 20, windowMs: 5 * 60_000, blockMs: 10 * 60_000 };
const SAFE = new Set(["GET", "HEAD"]);
const DUMMY_SECRET = "fmss_" + "0".repeat(43);

class MachineError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly extra?: Record<string, unknown>, readonly headers?: Record<string, string>) { super(message); }
}
const authFailed = () => new MachineError(401, "AUTH_FAILED", "Autentikasi gagal.");

function jsonResponse(status: number, body: unknown, requestId: string, extra: Record<string, string> = {}): Response {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId, ...extra } });
}

type RouteContext<P> = { params: Promise<P> };

export function machineRoute<P = Record<string, never>>(opts: MachineRouteOptions, handler: (args: MachineHandlerArgs<P>) => Promise<unknown>) {
  return async (req: Request, ctx?: RouteContext<P>): Promise<Response> => {
    const requestId = randomUUID();
    try {
      return await process(req, ctx, requestId, opts, handler);
    } catch (e) {
      if (e instanceof MachineError) {
        return jsonResponse(e.status, { error: { code: e.code, message: e.message, requestId, ...e.extra } }, requestId, e.headers);
      }
      console.error("[integration] unhandled error:", requestId, e);
      return jsonResponse(500, { error: { code: "INTERNAL", message: "Terjadi kesalahan pada server.", requestId } }, requestId);
    }
  };
}

async function process<P>(
  req: Request, ctx: RouteContext<P> | undefined, requestId: string, opts: MachineRouteOptions,
  handler: (args: MachineHandlerArgs<P>) => Promise<unknown>,
): Promise<Response> {
  if (!integrationEnabled()) throw new MachineError(503, "INTEGRATION_DISABLED", "Integrasi belum diaktifkan di server ini.");
  const meta = requestMeta(req.headers);
  const url = new URL(req.url);
  const method = req.method.toUpperCase();

  // 1. Batas kegagalan otentikasi per IP (bila IP diketahui). Sengaja TIDAK per kunci: pihak luar yang menyebut key id korban
  //    tidak boleh bisa mengunci kredensial sah. (Menebak HMAC-SHA256 tidak layak; batas ini menahan bising & beban DB.)
  const ipKey = meta.ip ? `apiauth:ip:${hashKey(meta.ip)}` : null;
  if (ipKey) await assertNotBlocked(ipKey);

  // 2. Format header (kegagalan format dihitung sebagai kegagalan otentikasi).
  const h = req.headers;
  const keyId = h.get(HEADER.key) ?? "";
  const timestamp = h.get(HEADER.timestamp) ?? "";
  const nonce = h.get(HEADER.nonce) ?? "";
  const signature = (h.get(HEADER.signature) ?? "").toLowerCase();
  const failAuth = async (): Promise<never> => {
    if (ipKey) await recordFailure(ipKey, AUTH_FAIL_LIMIT);
    throw authFailed();
  };
  if (!KEY_ID_PATTERN.test(keyId) || !/^\d{9,12}$/.test(timestamp) || !NONCE_PATTERN.test(nonce) || !SIGNATURE_PATTERN.test(signature)) return failAuth();

  // 3. Badan mentah (dibaca SEKALI; ditandatangani apa adanya).
  const declared = Number(h.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) throw new MachineError(413, "PAYLOAD_TOO_LARGE", "Isi permintaan terlalu besar.");
  const rawBody = SAFE.has(method) ? "" : await req.text();
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) throw new MachineError(413, "PAYLOAD_TOO_LARGE", "Isi permintaan terlalu besar.");

  // 4. Tanda tangan. Kunci tak dikenal/dicabut tetap menghitung HMAC (waktu seragam) lalu gagal dengan jawaban yang sama.
  const client = await prisma.apiClient.findUnique({ where: { keyId } });
  const canonical = canonicalString({ method, path: url.pathname, query: url.searchParams, timestamp, nonce, body: rawBody });
  const now = Date.now();
  const secrets: string[] = [];
  if (client) {
    secrets.push(deriveSecret(client.id, client.secretVersion));
    if (client.prevSecretVersion && client.prevValidUntil && client.prevValidUntil.getTime() > now) secrets.push(deriveSecret(client.id, client.prevSecretVersion));
  } else secrets.push(DUMMY_SECRET);
  let ok = false;
  for (const s of secrets) ok = safeEqualHex(signCanonical(s, canonical), signature) || ok;
  if (!client || !client.isActive || !ok) return failAuth();

  // 5. Kesegaran jam (setelah tanda tangan sah, sehingga pesan galat tidak membocorkan apa pun ke pihak tak berhak).
  const skew = Math.abs(Math.floor(now / 1000) - Number(timestamp));
  if (skew > MAX_CLOCK_SKEW_SECONDS) throw new MachineError(401, "TIMESTAMP_SKEW", `Selisih waktu ${skew} detik melebihi batas ${MAX_CLOCK_SKEW_SECONDS} detik. Sinkronkan jam server pengirim (NTP).`, { serverTime: Math.floor(now / 1000) });

  // 6. Daftar IP (bila dikonfigurasi).
  if (client.allowedIps.length > 0 && (!meta.ip || !client.allowedIps.includes(meta.ip))) {
    throw new MachineError(403, "FORBIDDEN_IP", "Alamat IP pengirim tidak diizinkan untuk kredensial ini.");
  }

  // 7. Batas laju per kredensial.
  const rateKey = `api:${client.id}`;
  const wait = await blockedSeconds(rateKey);
  if (wait > 0) throw new MachineError(429, "RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi nanti.", { retryAfterSeconds: wait }, { "Retry-After": String(wait) });
  const rl = await recordFailure(rateKey, { max: client.rateLimitPerMinute, windowMs: 60_000, blockMs: 60_000 });
  if (rl.blocked && rl.count > client.rateLimitPerMinute) throw new MachineError(429, "RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi nanti.", { retryAfterSeconds: 60 }, { "Retry-After": "60" });

  // 8. Nonce: tiap tanda tangan hanya berlaku SEKALI (anti-replay). Hanya dicatat setelah tanda tangan sah → tabel tak bisa dibanjiri pihak luar.
  try {
    await prisma.apiNonce.create({ data: { clientId: client.id, nonce } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new MachineError(401, "NONCE_REPLAYED", "Nonce sudah pernah dipakai. Gunakan nonce baru untuk setiap permintaan.");
    throw e;
  }
  void maybePrune();

  // 9. Scope.
  const scopes = client.scopes.filter(isScope);
  if (opts.scope && !scopes.includes(opts.scope)) throw new MachineError(403, "FORBIDDEN", `Kredensial tidak memiliki scope "${opts.scope}".`);

  // 10. Catat pemakaian (dibatasi 1×/menit agar tidak menulis per permintaan).
  void prisma.apiClient.updateMany({
    where: { id: client.id, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: new Date(now - 60_000) } }] },
    data: { lastUsedAt: new Date(now), lastUsedIp: meta.ip },
  }).catch(() => undefined);

  const principal: MachinePrincipal = { clientId: client.id, keyId: client.keyId, name: client.name, scopes, ip: meta.ip, userAgent: meta.userAgent, requestId };
  const params = (ctx?.params ? await ctx.params : {}) as P;
  const run = async (): Promise<{ status: number; body: unknown }> => {
    try {
      const args: MachineHandlerArgs<P> = {
        req, principal, rawBody, params,
        json: <T,>(schema: ZodType<T>) => {
          if (!(h.get("content-type") ?? "").toLowerCase().includes("application/json")) throw Errors.badRequest("Content-Type harus application/json.");
          let parsed: unknown;
          try { parsed = JSON.parse(rawBody); } catch { throw Errors.badRequest("JSON tidak valid."); }
          return schema.parse(parsed);
        },
      };
      const out = await handler(args);
      if (out instanceof ApiResult) return { status: out.status, body: { data: out.data } };
      return { status: 200, body: { data: out ?? null } };
    } catch (e) {
      if (e instanceof AppError || e instanceof ZodError) {
        const res = errorResponse(e);
        return { status: res.status, body: await res.json() };
      }
      throw e;
    }
  };

  // 11. Idempotensi untuk metode penulis.
  const needsKey = !SAFE.has(method) && opts.idempotent !== false;
  if (!needsKey) {
    const r = await run();
    return jsonResponse(r.status, r.body, requestId);
  }
  const idemKey = h.get(HEADER.idempotency) ?? "";
  if (!idemKey) throw new MachineError(400, "IDEMPOTENCY_KEY_REQUIRED", "Header Idempotency-Key wajib untuk permintaan yang mengubah data.");
  if (!IDEMPOTENCY_KEY_PATTERN.test(idemKey)) throw new MachineError(400, "IDEMPOTENCY_KEY_INVALID", "Idempotency-Key harus 8–128 karakter [A-Za-z0-9_.:-].");
  const requestHash = sha256Hex(`${method}\n${url.pathname}\n${canonicalQuery(url.searchParams)}\n${sha256Hex(rawBody)}`);

  let rowId: string;
  try {
    rowId = (await prisma.apiIdempotency.create({ data: { clientId: client.id, key: idemKey, requestHash } })).id;
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    const prev = await prisma.apiIdempotency.findUnique({ where: { clientId_key: { clientId: client.id, key: idemKey } } });
    if (!prev) throw new MachineError(409, "IDEMPOTENCY_IN_PROGRESS", "Permintaan dengan kunci yang sama sedang diproses. Coba lagi sebentar.", undefined, { "Retry-After": "2" });
    if (prev.requestHash !== requestHash) throw new MachineError(422, "IDEMPOTENCY_KEY_REUSED", "Idempotency-Key ini sudah dipakai untuk permintaan yang isinya berbeda.");
    if (prev.state === "DONE") return jsonResponse(prev.responseStatus ?? 200, prev.responseBody, requestId, { "Idempotent-Replay": "true" });
    // Sedang berjalan: bila sudah lama macet (proses mati di tengah jalan), ambil alih secara atomik; selain itu minta coba lagi.
    const taken = await prisma.apiIdempotency.updateMany({
      where: { id: prev.id, state: "IN_PROGRESS", createdAt: { lt: new Date(Date.now() - STALE_IN_PROGRESS_MS) } },
      data: { createdAt: new Date() },
    });
    if (taken.count !== 1) throw new MachineError(409, "IDEMPOTENCY_IN_PROGRESS", "Permintaan dengan kunci yang sama sedang diproses. Coba lagi sebentar.", undefined, { "Retry-After": "2" });
    rowId = prev.id;
  }

  let result: { status: number; body: unknown };
  try {
    result = await run();
  } catch (e) {
    await prisma.apiIdempotency.deleteMany({ where: { id: rowId, state: "IN_PROGRESS" } }).catch(() => undefined); // galat tak terduga: izinkan percobaan ulang
    throw e;
  }
  await prisma.apiIdempotency.update({
    where: { id: rowId },
    data: { state: "DONE", responseStatus: result.status, responseBody: result.body as Prisma.InputJsonValue, completedAt: new Date() },
  });
  return jsonResponse(result.status, result.body, requestId);
}

async function assertNotBlocked(key: string): Promise<void> {
  const wait = await blockedSeconds(key);
  if (wait > 0) throw new MachineError(429, "RATE_LIMITED", "Terlalu banyak percobaan otentikasi gagal. Coba lagi nanti.", { retryAfterSeconds: wait }, { "Retry-After": String(wait) });
}

/** Bersihkan nonce (> 1 hari) & kunci idempotensi (> 7 hari) secara oportunistik (~0,5% permintaan); tak pernah menggagalkan permintaan. */
async function maybePrune(): Promise<void> {
  if (Math.random() > 0.005) return;
  await pruneIntegrationLogs().catch(() => undefined);
}

export async function pruneIntegrationLogs(now = new Date()): Promise<{ nonces: number; idempotency: number }> {
  const [n, i] = await Promise.all([
    prisma.apiNonce.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 86_400_000) } } }),
    prisma.apiIdempotency.deleteMany({ where: { state: "DONE", createdAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } } }),
  ]);
  return { nonces: n.count, idempotency: i.count };
}

