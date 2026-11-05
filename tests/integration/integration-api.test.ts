import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { prisma } from "@/server/db";
import { resetDb, seedFixtures, type Fixtures } from "../helpers/db";

// IP pengirim dibaca dari header uji (di produksi: X-Forwarded-For bila TRUST_PROXY).
vi.mock("@/server/request-context", () => ({
  requestMeta: (h: Headers) => ({ ip: h.get("x-test-ip"), userAgent: h.get("user-agent") }),
}));

import { machineRoute, pruneIntegrationLogs } from "@/server/integration/machine-route";
import { writeMachineAudit } from "@/server/integration/audit";
import { created } from "@/server/http";
import { deriveSecret } from "@/server/integration/secrets";
import {
  createApiClient, listApiClients, revokeApiClient, rotateApiClientSecret, updateApiClient, getIntegrationStatus,
} from "@/server/services/integration-clients";
import { HEADER, signedHeaders, sha256Hex } from "@/lib/integration/signing";
import { AppError } from "@/server/errors";

let fx: Fixtures;
let runs = 0;
const BASE = "http://app.test";

const writeHandler = machineRoute({ scope: "reimbursements:write" }, async ({ json, principal }) => {
  runs++;
  const b = json(z.object({ n: z.number().int().min(0), fail: z.boolean().optional(), crash: z.boolean().optional() }));
  if (b.crash) throw new Error("meledak");
  await prisma.$transaction(async (tx) => { await writeMachineAudit(tx, principal, { action: "test.write", entityType: "Test", summary: `n=${b.n}` }); });
  return created({ echo: b.n, by: principal.name });
});
const readHandler = machineRoute({}, async ({ principal }) => ({ ok: true, name: principal.name, scopes: principal.scopes }));
const getScoped = machineRoute({ scope: "reimbursements:read" }, async () => ({ secretStuff: true }));

interface Creds { keyId: string; secret: string; id: string }
async function mkClient(over: Record<string, unknown> = {}): Promise<Creds> {
  const { client, secret } = await createApiClient(fx.admin, { name: `Klien ${Math.random().toString(36).slice(2, 8)}`, scopes: ["reimbursements:write"], ...over });
  return { keyId: client.keyId, secret, id: client.id };
}

interface Opts { method?: string; path?: string; query?: string; json?: unknown; rawBody?: string; idem?: string | null; ip?: string; now?: number; nonce?: string; sigOverride?: Partial<Record<string, string>>; signAs?: { method?: string; path?: string; query?: string; body?: string }; extra?: Record<string, string> }
function build(c: Creds, o: Opts = {}) {
  const method = o.method ?? "POST";
  const path = o.path ?? "/api/integration/v1/test";
  const body = method === "GET" ? "" : (o.rawBody ?? (o.json === undefined ? "" : JSON.stringify(o.json)));
  const sig = signedHeaders({
    keyId: c.keyId, secret: c.secret, method: o.signAs?.method ?? method, path: o.signAs?.path ?? path, query: o.signAs?.query ?? o.query ?? "", body: o.signAs?.body ?? body,
    now: o.now, nonce: o.nonce,
  });
  const headers: Record<string, string> = { ...sig, ...(o.sigOverride as Record<string, string>), ...o.extra };
  if (method !== "GET") { headers["content-type"] = "application/json"; if (o.idem !== null) headers[HEADER.idempotency] = o.idem ?? `idem-${Math.random().toString(36).slice(2, 12)}`; }
  if (o.ip) headers["x-test-ip"] = o.ip;
  return new Request(`${BASE}${path}${o.query ? `?${o.query}` : ""}`, { method, headers, body: method === "GET" ? undefined : body });
}
const call = async (h: (r: Request) => Promise<Response>, c: Creds, o: Opts = {}) => {
  const res = await h(build(c, o));
  return { res, status: res.status, body: (await res.json()) as { data?: unknown; error?: { code: string; message: string; [k: string]: unknown } } };
};
const bi = (_k: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);
const err = async (p: Promise<unknown>) => (await p.then(() => null, (e: unknown) => e)) as AppError;

beforeEach(async () => {
  await resetDb();
  fx = await seedFixtures();
  runs = 0;
});

describe("otentikasi tanda tangan", () => {
  it("permintaan sah → 200; respons tidak di-cache & membawa X-Request-Id; pemakaian tercatat", async () => {
    const c = await mkClient();
    const r = await call(readHandler, c, { method: "GET" });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ ok: true, scopes: ["reimbursements:write"] });
    expect(r.res.headers.get("cache-control")).toBe("no-store");
    expect(r.res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    await vi.waitFor(async () => expect((await prisma.apiClient.findUniqueOrThrow({ where: { id: c.id } })).lastUsedAt).not.toBeNull());
  });

  it.each([
    ["badan diubah setelah ditandatangani", { json: { n: 1 }, signAs: { body: JSON.stringify({ n: 2 }) } }],
    ["path berbeda", { json: { n: 1 }, signAs: { path: "/api/integration/v1/lain" } }],
    ["query berbeda", { json: { n: 1 }, query: "a=1", signAs: { query: "a=2" } }],
    ["metode berbeda", { json: { n: 1 }, signAs: { method: "PUT" } }],
    ["tanda tangan salah", { json: { n: 1 }, sigOverride: { [HEADER.signature]: "0".repeat(64) } }],
    ["tanda tangan kosong", { json: { n: 1 }, sigOverride: { [HEADER.signature]: "" } }],
    ["timestamp diubah", { json: { n: 1 }, sigOverride: { [HEADER.timestamp]: String(Math.floor(Date.now() / 1000) + 1) } }],
    ["nonce diubah", { json: { n: 1 }, sigOverride: { [HEADER.nonce]: "z".repeat(20) } }],
    ["key id format salah", { json: { n: 1 }, sigOverride: { [HEADER.key]: "bukan-key" } }],
    ["key id tak dikenal", { json: { n: 1 }, sigOverride: { [HEADER.key]: "fmsk_00000000000000000000" } }],
  ] as [string, Opts][])("ditolak 401 AUTH_FAILED seragam: %s — dan handler TIDAK berjalan", async (_n, o) => {
    const c = await mkClient();
    const r = await call(writeHandler, c, o);
    expect(r.status).toBe(401);
    expect(r.body.error!.code).toBe("AUTH_FAILED");
    expect(r.body.error!.message).toBe("Autentikasi gagal."); // tidak membedakan sebab (tidak membocorkan keberadaan kunci)
    expect(runs).toBe(0);
  });

  it("rahasia milik klien lain / rahasia salah → ditolak; kunci tak dikenal & tanda tangan salah menghasilkan jawaban identik", async () => {
    const a = await mkClient(), b = await mkClient();
    const wrong = await call(writeHandler, { ...a, secret: b.secret }, { json: { n: 1 } });
    const unknown = await call(writeHandler, { ...a, keyId: "fmsk_ffffffffffffffffffff" }, { json: { n: 1 } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect({ ...wrong.body.error, requestId: 0 }).toEqual({ ...unknown.body.error, requestId: 0 });
  });

  it("kredensial dicabut → langsung ditolak (walau tanda tangan benar)", async () => {
    const c = await mkClient();
    expect((await call(readHandler, c, { method: "GET" })).status).toBe(200);
    await revokeApiClient(fx.admin, c.id, { reason: "Uji pencabutan" });
    const r = await call(readHandler, c, { method: "GET" });
    expect(r.status).toBe(401);
    expect(r.body.error!.code).toBe("AUTH_FAILED");
  });

  it("tanda tangan huruf besar diterima (dinormalkan); header hilang → 401", async () => {
    const c = await mkClient();
    const req = build(c, { method: "GET" });
    const up = new Request(req, { headers: { ...Object.fromEntries(req.headers), [HEADER.signature]: req.headers.get(HEADER.signature)!.toUpperCase() } });
    expect((await readHandler(up)).status).toBe(200);
    const bare = new Request(`${BASE}/api/integration/v1/test`, { method: "GET" });
    expect((await readHandler(bare)).status).toBe(401);
  });
});

describe("kesegaran jam & anti-replay", () => {
  it("selisih jam: ±299 detik diterima; ±301 detik ditolak TIMESTAMP_SKEW (dengan jam server)", async () => {
    const c = await mkClient();
    for (const d of [-299, 299]) expect((await call(readHandler, c, { method: "GET", now: Date.now() + d * 1000 })).status).toBe(200);
    for (const d of [-301, 301, -86_400, 86_400]) {
      const r = await call(readHandler, c, { method: "GET", now: Date.now() + d * 1000 });
      expect(r.status).toBe(401);
      expect(r.body.error!.code).toBe("TIMESTAMP_SKEW");
      expect(typeof r.body.error!.serverTime).toBe("number");
    }
  });

  it("permintaan yang sama persis dikirim ulang → NONCE_REPLAYED; nonce baru → diterima", async () => {
    const c = await mkClient();
    const first = build(c, { method: "GET", nonce: "nonce-pertama-abcdef" });
    const copy = first.clone();
    expect((await readHandler(first)).status).toBe(200);
    const r = await readHandler(copy);
    expect(r.status).toBe(401);
    expect((await r.json()).error.code).toBe("NONCE_REPLAYED");
    expect((await call(readHandler, c, { method: "GET", nonce: "nonce-kedua-abcdefgh" })).status).toBe(200);
  });

  it("nonce yang sama dipakai klien BERBEDA tidak bentrok (nonce per kredensial)", async () => {
    const a = await mkClient(), b = await mkClient();
    expect((await call(readHandler, a, { method: "GET", nonce: "nonce-bersama-abcdef" })).status).toBe(200);
    expect((await call(readHandler, b, { method: "GET", nonce: "nonce-bersama-abcdef" })).status).toBe(200);
  });

  it("10 pengiriman PARALEL permintaan yang sama persis → tepat satu berhasil (balapan nonce)", async () => {
    const c = await mkClient();
    const req = build(c, { json: { n: 7 }, idem: "paralel-idem-0001", nonce: "nonce-paralel-abcdef" });
    const rs = await Promise.all(Array.from({ length: 10 }, () => writeHandler(req.clone())));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    expect(runs).toBe(1);
  });

  it("nonce hanya dicatat untuk tanda tangan SAH (pihak luar tak bisa membanjiri tabel)", async () => {
    const c = await mkClient();
    for (let i = 0; i < 5; i++) await call(readHandler, c, { method: "GET", sigOverride: { [HEADER.signature]: "1".repeat(64) } });
    expect(await prisma.apiNonce.count()).toBe(0);
  });
});

describe("scope, IP, dan laju", () => {
  it("tanpa scope yang dibutuhkan → 403 FORBIDDEN; endpoint tanpa scope cukup kredensial sah", async () => {
    const c = await mkClient({ scopes: ["reimbursements:read"] });
    const w = await call(writeHandler, c, { json: { n: 1 } });
    expect(w.status).toBe(403);
    expect(w.body.error!.code).toBe("FORBIDDEN");
    expect(runs).toBe(0);
    expect((await call(getScoped, c, { method: "GET" })).status).toBe(200);
    const none = await mkClient({ scopes: [] });
    expect((await call(readHandler, none, { method: "GET" })).status).toBe(200);
    expect((await call(getScoped, none, { method: "GET" })).status).toBe(403);
  });

  it("daftar IP: IP terdaftar diterima; IP lain atau IP tak diketahui → 403 FORBIDDEN_IP", async () => {
    const c = await mkClient({ allowedIps: ["203.0.113.5", "2001:db8::1"] });
    expect((await call(readHandler, c, { method: "GET", ip: "203.0.113.5" })).status).toBe(200);
    expect((await call(readHandler, c, { method: "GET", ip: "2001:db8::1" })).status).toBe(200);
    for (const ip of ["198.51.100.9", undefined]) {
      const r = await call(readHandler, c, { method: "GET", ip });
      expect(r.status).toBe(403);
      expect(r.body.error!.code).toBe("FORBIDDEN_IP");
    }
  });

  it("batas per menit per kredensial: lewat batas → 429 + Retry-After; kredensial lain tidak terpengaruh", async () => {
    const slow = await mkClient({ rateLimitPerMinute: 10 }), other = await mkClient();
    const statuses: number[] = [];
    for (let i = 0; i < 14; i++) statuses.push((await call(readHandler, slow, { method: "GET" })).status);
    expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(10);
    expect(statuses.at(-1)).toBe(429);
    const blocked = await call(readHandler, slow, { method: "GET" });
    expect(blocked.res.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(blocked.body.error!.code).toBe("RATE_LIMITED");
    expect((await call(readHandler, other, { method: "GET" })).status).toBe(200);
  });

  it("lonjakan PARALEL tidak menembus batas (penghitung atomik): 30 permintaan serentak, batas 10 → paling banyak 10 lolos", async () => {
    const c = await mkClient({ rateLimitPerMinute: 10 });
    const rs = await Promise.all(Array.from({ length: 30 }, () => readHandler(build(c, { method: "GET" }))));
    const ok = rs.filter((r) => r.status === 200).length;
    expect(ok).toBeGreaterThanOrEqual(1);
    expect(ok).toBeLessThanOrEqual(10);
    expect(rs.filter((r) => r.status === 429).length).toBe(30 - ok);
  });

  it("kegagalan otentikasi beruntun dari satu IP → IP itu diblokir (bahkan untuk permintaan sah); IP lain tetap dilayani; kredensial TIDAK terkunci", async () => {
    const c = await mkClient();
    for (let i = 0; i < 20; i++) await call(readHandler, c, { method: "GET", ip: "198.51.100.77", sigOverride: { [HEADER.signature]: "2".repeat(64) } });
    const blocked = await call(readHandler, c, { method: "GET", ip: "198.51.100.77" });
    expect(blocked.status).toBe(429);
    expect((await call(readHandler, c, { method: "GET", ip: "203.0.113.10" })).status).toBe(200);
    expect((await call(readHandler, c, { method: "GET" })).status).toBe(200); // tanpa IP: tidak ada kunci per-kredensial yang bisa dipicu pihak luar
  });

  it("badan terlalu besar → 413 (juga bila Content-Length dipalsukan kecil)", async () => {
    const c = await mkClient();
    const big = JSON.stringify({ n: 1, pad: "x".repeat(1_100_000) });
    expect((await call(writeHandler, c, { rawBody: big })).status).toBe(413);
    expect((await call(writeHandler, c, { rawBody: big, extra: { "content-length": "10" } })).status).toBe(413);
    expect(runs).toBe(0);
  });
});

describe("idempotensi", () => {
  it("metode penulis wajib Idempotency-Key bermutu; GET tidak butuh", async () => {
    const c = await mkClient();
    const none = await call(writeHandler, c, { json: { n: 1 }, idem: null });
    expect([none.status, none.body.error!.code]).toEqual([400, "IDEMPOTENCY_KEY_REQUIRED"]);
    for (const bad of ["pendek", "spasi tidak boleh disini", "x".repeat(129)]) {
      const r = await call(writeHandler, c, { json: { n: 1 }, idem: bad });
      expect([r.status, r.body.error!.code]).toEqual([400, "IDEMPOTENCY_KEY_INVALID"]);
    }
    expect(runs).toBe(0);
    expect((await call(readHandler, c, { method: "GET" })).status).toBe(200);
  });

  it("kunci & isi sama (nonce baru) → respons tersimpan diputar ulang tanpa menjalankan handler lagi", async () => {
    const c = await mkClient();
    const a = await call(writeHandler, c, { json: { n: 5 }, idem: "order-0001-abc" });
    const b = await call(writeHandler, c, { json: { n: 5 }, idem: "order-0001-abc" });
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(b.body).toEqual(a.body);
    expect(b.res.headers.get("idempotent-replay")).toBe("true");
    expect(a.res.headers.get("idempotent-replay")).toBeNull();
    expect(runs).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "test.write" } })).toBe(1);
  });

  it("kunci sama tetapi isi berbeda → 422 IDEMPOTENCY_KEY_REUSED (handler tidak berjalan)", async () => {
    const c = await mkClient();
    await call(writeHandler, c, { json: { n: 5 }, idem: "order-0002-abc" });
    const r = await call(writeHandler, c, { json: { n: 6 }, idem: "order-0002-abc" });
    expect([r.status, r.body.error!.code]).toEqual([422, "IDEMPOTENCY_KEY_REUSED"]);
    expect(runs).toBe(1);
  });

  it("kunci sama tetapi query atau path berbeda → juga dianggap permintaan berbeda (422)", async () => {
    const c = await mkClient();
    await call(writeHandler, c, { json: { n: 5 }, idem: "order-0003-abc", query: "a=1" });
    expect((await call(writeHandler, c, { json: { n: 5 }, idem: "order-0003-abc", query: "a=2" })).status).toBe(422);
    expect((await call(writeHandler, c, { json: { n: 5 }, idem: "order-0003-abc", query: "a=1", path: "/api/integration/v1/lain" })).status).toBe(422);
    expect(runs).toBe(1);
  });

  it("kunci sama dipakai klien berbeda tidak saling mengganggu", async () => {
    const a = await mkClient(), b = await mkClient();
    expect((await call(writeHandler, a, { json: { n: 1 }, idem: "kunci-bersama-1" })).status).toBe(201);
    expect((await call(writeHandler, b, { json: { n: 2 }, idem: "kunci-bersama-1" })).status).toBe(201);
    expect(runs).toBe(2);
  });

  it("8 permintaan PARALEL dengan kunci sama (tanda tangan berbeda) → handler berjalan sekali; sisanya 409 atau diputar ulang", async () => {
    const c = await mkClient();
    const rs = await Promise.all(Array.from({ length: 8 }, () => writeHandler(build(c, { json: { n: 9 }, idem: "paralel-kunci-1" }))));
    const codes = rs.map((r) => r.status);
    expect(runs).toBe(1);
    expect(codes.filter((s) => s === 201).length).toBeGreaterThanOrEqual(1);
    expect(codes.every((s) => s === 201 || s === 409)).toBe(true);
    // setelah selesai, pengulangan = putar ulang
    const again = await call(writeHandler, c, { json: { n: 9 }, idem: "paralel-kunci-1" });
    expect(again.status).toBe(201);
    expect(runs).toBe(1);
  });

  it("galat validasi (4xx) juga deterministik: diputar ulang; galat tak terduga (500) TIDAK disimpan sehingga boleh dicoba ulang", async () => {
    const c = await mkClient();
    const bad = await call(writeHandler, c, { json: { n: -1 }, idem: "validasi-0001" });
    expect(bad.status).toBe(422);
    const replay = await call(writeHandler, c, { json: { n: -1 }, idem: "validasi-0001" });
    expect([replay.status, replay.res.headers.get("idempotent-replay")]).toEqual([422, "true"]);
    expect(runs).toBe(1);

    const crash1 = await call(writeHandler, c, { json: { n: 1, crash: true }, idem: "crash-0000001" });
    expect([crash1.status, crash1.body.error!.code]).toEqual([500, "INTERNAL"]);
    expect(JSON.stringify(crash1.body)).not.toContain("meledak"); // detail internal tidak bocor
    expect(await prisma.apiIdempotency.count({ where: { key: "crash-0000001" } })).toBe(0);
    await call(writeHandler, c, { json: { n: 1, crash: true }, idem: "crash-0000001" });
    expect(runs).toBe(3);
  });

  it("IN_PROGRESS yang macet > 2 menit diambil alih; yang masih baru → 409 IDEMPOTENCY_IN_PROGRESS", async () => {
    const c = await mkClient();
    const body = { n: 3 };
    // Hash permintaan sama dengan yang dihitung server.
    const hash = sha256Hex(`POST\n/api/integration/v1/test\n\n${sha256Hex(JSON.stringify(body))}`);
    await prisma.apiIdempotency.create({ data: { clientId: c.id, key: "macet-0000001", requestHash: hash } });
    const fresh = await call(writeHandler, c, { json: body, idem: "macet-0000001" });
    expect([fresh.status, fresh.body.error!.code]).toEqual([409, "IDEMPOTENCY_IN_PROGRESS"]);
    expect(fresh.res.headers.get("retry-after")).toBe("2");
    expect(runs).toBe(0);
    await prisma.apiIdempotency.updateMany({ where: { key: "macet-0000001" }, data: { createdAt: new Date(Date.now() - 3 * 60_000) } });
    expect((await call(writeHandler, c, { json: body, idem: "macet-0000001" })).status).toBe(201);
    expect(runs).toBe(1);
  });

  it("pembersihan berkala: nonce > 1 hari dan idempotensi selesai > 7 hari dihapus; yang baru & yang masih berjalan dipertahankan", async () => {
    const c = await mkClient();
    const old = (days: number) => new Date(Date.now() - days * 86_400_000);
    await prisma.apiNonce.createMany({ data: [{ clientId: c.id, nonce: "nonce-lama-aaaaaaaaaa", createdAt: old(2) }, { clientId: c.id, nonce: "nonce-baru-aaaaaaaaaa" }] });
    await prisma.apiIdempotency.create({ data: { clientId: c.id, key: "lama-selesai-1", requestHash: "h", state: "DONE", responseStatus: 200, completedAt: old(8), createdAt: old(8) } });
    await prisma.apiIdempotency.create({ data: { clientId: c.id, key: "lama-berjalan-1", requestHash: "h", createdAt: old(8) } });
    await prisma.apiIdempotency.create({ data: { clientId: c.id, key: "baru-selesai-1", requestHash: "h", state: "DONE", responseStatus: 200, completedAt: new Date() } });
    expect(await pruneIntegrationLogs()).toEqual({ nonces: 1, idempotency: 1 });
    expect((await prisma.apiNonce.findMany()).map((n) => n.nonce)).toEqual(["nonce-baru-aaaaaaaaaa"]);
    expect((await prisma.apiIdempotency.findMany({ orderBy: { key: "asc" } })).map((r) => r.key)).toEqual(["baru-selesai-1", "lama-berjalan-1"]);
  });
});

describe("rotasi rahasia", () => {
  it("tanpa masa tenggang: rahasia lama langsung mati, baru langsung hidup", async () => {
    const c = await mkClient();
    const r = await rotateApiClientSecret(fx.admin, c.id, {});
    expect(r.secret).not.toBe(c.secret);
    expect((await call(readHandler, c, { method: "GET" })).status).toBe(401);
    expect((await call(readHandler, { ...c, secret: r.secret }, { method: "GET" })).status).toBe(200);
  });

  it("dengan masa tenggang: keduanya berlaku; setelah habis hanya yang baru", async () => {
    const c = await mkClient();
    const r = await rotateApiClientSecret(fx.admin, c.id, { graceMinutes: 15 });
    expect((await call(readHandler, c, { method: "GET" })).status).toBe(200);
    expect((await call(readHandler, { ...c, secret: r.secret }, { method: "GET" })).status).toBe(200);
    await prisma.apiClient.update({ where: { id: c.id }, data: { prevValidUntil: new Date(Date.now() - 1000) } });
    expect((await call(readHandler, c, { method: "GET" })).status).toBe(401);
    expect((await call(readHandler, { ...c, secret: r.secret }, { method: "GET" })).status).toBe(200);
  });

  it("rotasi dua kali dengan tenggang: versi paling lama tidak ikut hidup kembali", async () => {
    const c = await mkClient();
    const r2 = await rotateApiClientSecret(fx.admin, c.id, { graceMinutes: 60 });
    const r3 = await rotateApiClientSecret(fx.admin, c.id, { graceMinutes: 60 });
    expect((await call(readHandler, c, { method: "GET" })).status).toBe(401); // v1
    expect((await call(readHandler, { ...c, secret: r2.secret }, { method: "GET" })).status).toBe(200); // v2 (tenggang)
    expect((await call(readHandler, { ...c, secret: r3.secret }, { method: "GET" })).status).toBe(200); // v3
  });
});

describe("integrasi dinonaktifkan tanpa kunci induk", () => {
  it("tanpa INTEGRATION_MASTER_KEY: API mesin 503, pembuatan kredensial ditolak dengan petunjuk", async () => {
    const saved = process.env.INTEGRATION_MASTER_KEY;
    vi.resetModules();
    process.env.INTEGRATION_MASTER_KEY = "";
    try {
      const mr = await import("@/server/integration/machine-route");
      const svc = await import("@/server/services/integration-clients");
      const h = mr.machineRoute({}, async () => ({ ok: true }));
      const res = await h(new Request(`${BASE}/api/integration/v1/test`, { method: "GET" }));
      expect(res.status).toBe(503);
      expect((await res.json()).error.code).toBe("INTEGRATION_DISABLED");
      expect(svc.getIntegrationStatus(fx.admin).enabled).toBe(false);
      const e = (await svc.createApiClient(fx.admin, { name: "Tanpa kunci", scopes: [] }).then(() => null, (x: unknown) => x)) as AppError;
      expect(e.message).toMatch(/INTEGRATION_MASTER_KEY/);
    } finally {
      process.env.INTEGRATION_MASTER_KEY = saved;
      vi.resetModules();
    }
  });
});

describe("manajemen kredensial (hanya Administrator) & audit", () => {
  it("hanya ADMIN: Finance Manager dan Staf ditolak untuk semua operasi", async () => {
    const c = await mkClient();
    for (const a of [fx.finance, fx.staff]) {
      expect((await err(listApiClients(a))).status).toBe(403);
      expect((await err(createApiClient(a, { name: "Coba coba", scopes: [] }))).status).toBe(403);
      expect((await err(updateApiClient(a, c.id, { name: "Diubah paksa" }))).status).toBe(403);
      expect((await err(rotateApiClientSecret(a, c.id, {}))).status).toBe(403);
      expect((await err(revokeApiClient(a, c.id, { reason: "Tidak berhak" }))).status).toBe(403);
      expect(() => getIntegrationStatus(a)).toThrow();
    }
    expect((await prisma.apiClient.findUniqueOrThrow({ where: { id: c.id } })).isActive).toBe(true);
  });

  it("validasi: nama, scope di luar katalog, IP tidak valid, batas laju di luar rentang, nama aktif ganda", async () => {
    expect((await err(createApiClient(fx.admin, { name: "ab", scopes: [] }))).status).toBe(422);
    expect((await err(createApiClient(fx.admin, { name: "Valid", scopes: ["admin:*"] }))).status).toBe(422);
    expect((await err(createApiClient(fx.admin, { name: "Valid", scopes: [], allowedIps: ["bukan-ip"] }))).status).toBe(422);
    expect((await err(createApiClient(fx.admin, { name: "Valid", scopes: [], rateLimitPerMinute: 5 }))).status).toBe(422);
    expect((await err(createApiClient(fx.admin, { name: "Valid", scopes: [], rateLimitPerMinute: 7000 }))).status).toBe(422);
    await createApiClient(fx.admin, { name: "Website Utama", scopes: [] });
    expect((await err(createApiClient(fx.admin, { name: "website utama", scopes: [] }))).status).toBe(409);
  });

  it("rahasia: tidak tersimpan di database, deterministik per versi, berbeda antar klien/versi/kunci induk, ditampilkan hanya saat dibuat/dirotasi", async () => {
    const a = await mkClient(), b = await mkClient();
    expect(a.secret).toMatch(/^fmss_[A-Za-z0-9_-]{43}$/);
    expect(a.secret).not.toBe(b.secret);
    expect(deriveSecret(a.id, 1)).toBe(a.secret);
    expect(deriveSecret(a.id, 2)).not.toBe(a.secret);
    expect(deriveSecret(a.id, 1, "kunci-induk-lain-yang-panjang-0123456789")).not.toBe(a.secret);
    const dump = JSON.stringify(await prisma.$queryRawUnsafe(`SELECT * FROM api_clients`), bi) + JSON.stringify(await prisma.auditLog.findMany(), bi);
    expect(dump).not.toContain(a.secret);
    expect(dump).not.toContain(a.secret.slice(5));
    const listed = JSON.stringify(await listApiClients(fx.admin));
    expect(listed).not.toContain("fmss_");
  });

  it("setiap perubahan tercatat di audit log (tanpa rahasia); perubahan nihil tidak membuat audit", async () => {
    const c = await mkClient();
    await updateApiClient(fx.admin, c.id, { name: "Nama baru klien", scopes: ["reimbursements:read"], rateLimitPerMinute: 60 });
    await updateApiClient(fx.admin, c.id, { rateLimitPerMinute: 60 }); // tanpa perubahan
    const r = await rotateApiClientSecret(fx.admin, c.id, { graceMinutes: 15 });
    await revokeApiClient(fx.admin, c.id, { reason: "Perangkat hilang" });
    const logs = await prisma.auditLog.findMany({ where: { entityType: "ApiClient", entityId: c.id }, orderBy: { id: "asc" } });
    expect(logs.map((l) => l.action)).toEqual(["integration.client.create", "integration.client.update", "integration.client.rotate", "integration.client.revoke"]);
    expect(logs.every((l) => l.actorId === fx.admin.userId)).toBe(true);
    expect(logs[3]!.reason).toBe("Perangkat hilang");
    expect(JSON.stringify(logs, bi)).not.toContain(r.secret);
  });

  it("kredensial dicabut: tidak dapat diubah/dirotasi/dicabut ulang; aksi mesin tercatat atas nama kredensial", async () => {
    const c = await mkClient();
    await call(writeHandler, c, { json: { n: 1 }, idem: "audit-mesin-001", ip: "203.0.113.9" });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "test.write" } });
    expect([log.actorId, log.actorEmail, log.actorRole, log.ip]).toEqual([null, `api:${c.keyId}`, null, "203.0.113.9"]);
    await revokeApiClient(fx.admin, c.id, { reason: "Uji pencabutan" });
    for (const op of [updateApiClient(fx.admin, c.id, { name: "Hidupkan lagi" }), rotateApiClientSecret(fx.admin, c.id, {}), revokeApiClient(fx.admin, c.id, { reason: "Sekali lagi" })]) {
      expect((await err(op)).status).toBe(409);
    }
    expect((await err(revokeApiClient(fx.admin, c.id, { reason: "x" }))).status).toBe(422); // alasan minimal 5 karakter
  });

  it("guard database (SQL langsung): tidak bisa dihapus, diaktifkan kembali, ganti key id, atau menurunkan versi rahasia", async () => {
    const c = await mkClient();
    const sql = (q: string) => prisma.$executeRawUnsafe(q).then(() => null, (e: Error) => e.message);
    expect(await sql(`DELETE FROM api_clients WHERE id = '${c.id}'`)).toMatch(/tidak boleh dihapus/);
    expect(await sql(`UPDATE api_clients SET "keyId" = 'fmsk_00000000000000000001' WHERE id = '${c.id}'`)).toMatch(/tidak dapat diubah/);
    await rotateApiClientSecret(fx.admin, c.id, {});
    expect(await sql(`UPDATE api_clients SET "secretVersion" = 1 WHERE id = '${c.id}'`)).toMatch(/tidak boleh turun/);
    expect(await sql(`UPDATE api_clients SET "rateLimitPerMinute" = 0 WHERE id = '${c.id}'`)).toMatch(/api_clients_rate_chk/);
    await revokeApiClient(fx.admin, c.id, { reason: "Uji guard database" });
    expect(await sql(`UPDATE api_clients SET "isActive" = true, "revokedAt" = NULL WHERE id = '${c.id}'`)).toMatch(/tidak dapat diaktifkan kembali/);
    expect(await sql(`UPDATE api_clients SET "revokedAt" = NULL WHERE id = '${c.id}'`)).toMatch(/api_clients_revoked_chk/);
  });
});
