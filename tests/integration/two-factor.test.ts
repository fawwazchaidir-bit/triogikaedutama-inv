import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { resetDb, seedFixtures, TEST_PASSWORD, type Fixtures } from "../helpers/db";
import { beginLogin, login, verifyLoginChallenge, type TwoFactorChallenge } from "@/server/services/auth";
import {
  beginTwoFactorSetup, disableTwoFactor, enableTwoFactor, getTwoFactorStatus, regenerateRecoveryCodes, resetUserTwoFactor,
} from "@/server/services/two-factor";
import { createSession, validateSession } from "@/server/auth/session";
import { decryptField, encryptField } from "@/server/crypto";
import { blockedSeconds, hashKey } from "@/server/auth/rate-limit";
import { totpAt } from "@/lib/totp";
import { AppError } from "@/server/errors";

// Untuk menguji requireApiUser / requirePageUser tanpa server Next.
const mockSession = vi.hoisted(() => ({ token: "" as string }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (mockSession.token ? { value: mockSession.token } : undefined) }),
  headers: async () => new Headers(),
}));

const meta = { ip: null, userAgent: "vitest" };
let fx: Fixtures;
const err = async (p: Promise<unknown>) => (await p.then(() => null, (e: unknown) => e)) as AppError;
const bi = (_k: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);
const STEP = 30_000;
/** Kode untuk `n` langkah ke depan dari sekarang (n=0 = langkah kini). Login memakai langkah > langkah enrol, jadi n ≥ 1. */
const codeIn = (secret: string, n = 1) => totpAt(secret, Date.now() + n * STEP);

async function enroll(a: Fixtures["finance"]): Promise<{ secret: string; recovery: string[] }> {
  const { secret } = await beginTwoFactorSetup(a, { password: TEST_PASSWORD });
  const { recoveryCodes } = await enableTwoFactor(a, { code: codeIn(secret, 0) });
  return { secret, recovery: recoveryCodes };
}
async function challengeFor(email: string): Promise<string> {
  const r = await beginLogin({ email, password: TEST_PASSWORD }, meta);
  expect(r.kind).toBe("challenge");
  return (r as TwoFactorChallenge).challenge;
}

beforeEach(async () => {
  await resetDb();
  fx = await seedFixtures();
  mockSession.token = "";
});

describe("aktivasi 2FA", () => {
  it("memulai wajib password; password salah ditolak; rahasia tersimpan TERENKRIPSI (bukan polos) dan belum aktif", async () => {
    expect((await err(beginTwoFactorSetup(fx.finance, { password: "salah-salah-salah" }))).status).toBe(422);
    const s = await beginTwoFactorSetup(fx.finance, { password: TEST_PASSWORD });
    expect(s.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(s.otpauthUri).toContain(`secret=${s.secret}`);
    expect(s.qrDataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: fx.finance.userId } });
    expect(row.twoFactorEnabled).toBe(false);
    expect(row.twoFactorSecretEnc).toMatch(/^v1:/);
    expect(row.twoFactorSecretEnc).not.toContain(s.secret);
    expect(decryptField(row.twoFactorSecretEnc!)).toBe(s.secret);
    // memulai ulang = rahasia baru (yang lama tidak berlaku)
    const s2 = await beginTwoFactorSetup(fx.finance, { password: TEST_PASSWORD });
    expect(s2.secret).not.toBe(s.secret);
    expect((await err(enableTwoFactor(fx.finance, { code: codeIn(s.secret, 0) }))).status).toBe(422);
  });

  it("konfirmasi dengan kode benar → aktif + 10 kode pemulihan (hanya hash di DB); kode salah ditolak; audit tanpa rahasia", async () => {
    const { secret } = await beginTwoFactorSetup(fx.finance, { password: TEST_PASSWORD });
    expect((await err(enableTwoFactor(fx.finance, { code: "000000" }))).status).toBe(422);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: fx.finance.userId } })).twoFactorEnabled).toBe(false);
    const { recoveryCodes } = await enableTwoFactor(fx.finance, { code: codeIn(secret, 0) });
    expect(recoveryCodes).toHaveLength(10);
    expect(new Set(recoveryCodes).size).toBe(10);
    const st = await getTwoFactorStatus(fx.finance);
    expect([st.available, st.enabled, st.recoveryRemaining, st.required]).toEqual([true, true, 10, false]);
    const stored = await prisma.twoFactorRecoveryCode.findMany({ where: { userId: fx.finance.userId } });
    expect(stored).toHaveLength(10);
    const dump = JSON.stringify(stored, bi) + JSON.stringify(await prisma.auditLog.findMany(), bi) + JSON.stringify(await prisma.user.findMany(), bi);
    for (const c of recoveryCodes) { expect(dump).not.toContain(c); expect(dump).not.toContain(c.replace("-", "")); }
    expect(dump).not.toContain(secret);
    expect((await prisma.auditLog.findMany({ where: { action: "auth.2fa_enabled" } })).length).toBe(1);
    expect((await err(enableTwoFactor(fx.finance, { code: codeIn(secret, 1) }))).status).toBe(409); // sudah aktif
    expect((await err(beginTwoFactorSetup(fx.finance, { password: TEST_PASSWORD }))).status).toBe(409);
  });

  it("sesi lain dicabut saat 2FA diaktifkan; sesi saat ini tetap", async () => {
    const a = await createSession(fx.finance.userId, null, null), b = await createSession(fx.finance.userId, null, null);
    const cur = await validateSession(a.token);
    const { secret } = await beginTwoFactorSetup(fx.finance, { password: TEST_PASSWORD });
    await enableTwoFactor({ ...fx.finance, sessionId: cur!.sessionId }, { code: codeIn(secret, 0) });
    expect(await validateSession(a.token)).not.toBeNull();
    expect(await validateSession(b.token)).toBeNull();
  });

  it("salah password/kode berulang saat enrol memicu blokir per pengguna", async () => {
    for (let i = 0; i < 5; i++) await err(beginTwoFactorSetup(fx.finance, { password: "salah-salah-salah" }));
    const r = await err(beginTwoFactorSetup(fx.finance, { password: TEST_PASSWORD }));
    expect(r.status).toBe(429);
  });
});

describe("login dua langkah", () => {
  it("password benar saja TIDAK membuat sesi; hanya tantangan", async () => {
    await enroll(fx.finance);
    const before = await prisma.session.count();
    const r = await beginLogin({ email: "finance@test.local", password: TEST_PASSWORD }, meta);
    expect(r.kind).toBe("challenge");
    expect(await prisma.session.count()).toBe(before);
    expect(JSON.stringify(r)).not.toContain("token");
    expect((await err(login({ email: "finance@test.local", password: TEST_PASSWORD }, meta))).status).toBe(409); // jalur non-2FA menolak
    // tantangan disimpan sebagai hash
    const ch = (r as TwoFactorChallenge).challenge;
    expect(JSON.stringify(await prisma.loginChallenge.findMany(), bi)).not.toContain(ch);
  });

  it("kode TOTP benar → sesi; wajib kode: password salah / tantangan tak dikenal ditolak", async () => {
    const { secret } = await enroll(fx.finance);
    const c = await challengeFor("finance@test.local");
    const s = await verifyLoginChallenge({ challenge: c, code: codeIn(secret, 1) }, meta);
    expect(s.user.email).toBe("finance@test.local");
    expect(await validateSession(s.token)).not.toBeNull();
    expect((await err(verifyLoginChallenge({ challenge: "x".repeat(43), code: codeIn(secret, 1) }, meta))).status).toBe(401);
    expect((await prisma.auditLog.findMany({ where: { action: "auth.login" }, orderBy: { id: "desc" } }))[0]!.summary).toMatch(/2FA \(kode autentikator\)/);
  });

  it("kode salah ditolak (401) tanpa membocorkan apa pun; 5 salah → tantangan hangus walau kode berikutnya benar", async () => {
    const { secret } = await enroll(fx.finance);
    const c = await challengeFor("finance@test.local");
    for (let i = 0; i < 4; i++) expect((await err(verifyLoginChallenge({ challenge: c, code: "000000" }, meta))).message).toBe("Kode salah atau sudah dipakai.");
    const last = await err(verifyLoginChallenge({ challenge: c, code: "000000" }, meta));
    expect(last.message).toMatch(/berakhir/);
    expect((await err(verifyLoginChallenge({ challenge: c, code: codeIn(secret, 1) }, meta))).status).toBe(401);
  });

  it("brute force lintas tantangan: setelah 5 salah, pengguna diblokir (429) walau kode benar & tantangan baru", async () => {
    const { secret } = await enroll(fx.finance);
    for (let k = 0; k < 5; k++) { const c = await challengeFor("finance@test.local"); await err(verifyLoginChallenge({ challenge: c, code: "000000" }, meta)); }
    const c = await challengeFor("finance@test.local");
    expect((await err(verifyLoginChallenge({ challenge: c, code: codeIn(secret, 1) }, meta))).status).toBe(429);
  });

  it("tantangan kedaluwarsa, terpakai, atau milik akun nonaktif ditolak", async () => {
    const { secret, recovery } = await enroll(fx.finance);
    const c1 = await challengeFor("finance@test.local");
    await prisma.loginChallenge.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await err(verifyLoginChallenge({ challenge: c1, code: codeIn(secret, 1) }, meta))).message).toMatch(/berakhir/);

    const c2 = await challengeFor("finance@test.local");
    await verifyLoginChallenge({ challenge: c2, code: codeIn(secret, 1) }, meta);
    // tantangan terpakai ditolak bahkan dengan faktor yang SAH (kode pemulihan) — hanya status tantangan yang menolak
    expect((await err(verifyLoginChallenge({ challenge: c2, code: recovery[0]! }, meta))).status).toBe(401);
    expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: fx.finance.userId, usedAt: null } })).toBe(10);

    // akun dinonaktifkan setelah tantangan dibuat → tidak boleh menghasilkan sesi (faktor SAH dipakai agar hanya status akun yang menolak)
    const c3 = await challengeFor("finance@test.local");
    await prisma.user.update({ where: { id: fx.finance.userId }, data: { isActive: false } });
    const before = await prisma.session.count();
    expect((await err(verifyLoginChallenge({ challenge: c3, code: recovery[1]! }, meta))).status).toBe(401);
    expect(await prisma.session.count()).toBe(before);
    expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: fx.finance.userId, usedAt: null } })).toBe(10); // kode tidak terbakar
  });

  it("balapan: 6 TANTANGAN BERBEDA memakai kode TOTP yang sama serentak → hanya satu berhasil (klaim langkah atomik)", async () => {
    const { secret } = await enroll(fx.finance);
    const cs = await Promise.all(Array.from({ length: 6 }, () => challengeFor("finance@test.local")));
    const code = codeIn(secret, 1);
    const rs = await Promise.allSettled(cs.map((c) => verifyLoginChallenge({ challenge: c, code }, meta)));
    expect(rs.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("balapan: SATU tantangan dipakai serentak dengan dua faktor sah berbeda (TOTP + kode pemulihan) → hanya satu sesi", async () => {
    const { secret, recovery } = await enroll(fx.finance);
    const c = await challengeFor("finance@test.local");
    const before = await prisma.session.count();
    const rs = await Promise.allSettled([
      verifyLoginChallenge({ challenge: c, code: codeIn(secret, 1) }, meta),
      verifyLoginChallenge({ challenge: c, code: recovery[0]! }, meta),
      verifyLoginChallenge({ challenge: c, code: recovery[1]! }, meta),
    ]);
    expect(rs.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.session.count()).toBe(before + 1);
  });

  it("kode pengguna B tidak dapat dipakai pada tantangan pengguna A", async () => {
    const a = await enroll(fx.finance);
    const b = await enroll(fx.admin);
    const cA = await challengeFor("finance@test.local");
    expect((await err(verifyLoginChallenge({ challenge: cA, code: codeIn(b.secret, 1) }, meta))).status).toBe(401);
    expect((await verifyLoginChallenge({ challenge: cA, code: codeIn(a.secret, 1) }, meta)).user.email).toBe("finance@test.local");
  });

  it("anti-replay: kode yang sudah dipakai (atau langkah lebih lama) ditolak; kode ±2 langkah ditolak", async () => {
    const { secret } = await enroll(fx.finance);
    const code = codeIn(secret, 1);
    await verifyLoginChallenge({ challenge: await challengeFor("finance@test.local"), code }, meta);
    expect((await err(verifyLoginChallenge({ challenge: await challengeFor("finance@test.local"), code }, meta))).status).toBe(401); // sama
    expect((await err(verifyLoginChallenge({ challenge: await challengeFor("finance@test.local"), code: codeIn(secret, 0) }, meta))).status).toBe(401); // lebih lama
    expect((await err(verifyLoginChallenge({ challenge: await challengeFor("finance@test.local"), code: codeIn(secret, 5) }, meta))).status).toBe(401); // terlalu jauh
  });

  it("balapan: 6 verifikasi PARALEL dengan kode & tantangan sama → tepat satu sesi", async () => {
    const { secret } = await enroll(fx.finance);
    const c = await challengeFor("finance@test.local");
    const code = codeIn(secret, 1);
    const before = await prisma.session.count();
    const rs = await Promise.allSettled(Array.from({ length: 6 }, () => verifyLoginChallenge({ challenge: c, code }, meta)));
    expect(rs.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.session.count()).toBe(before + 1);
  });

  it("password benar pada akun 2FA TIDAK mereset penghitung gagal-login (anti-akal-akalan)", async () => {
    await enroll(fx.finance);
    for (let i = 0; i < 4; i++) await err(beginLogin({ email: "finance@test.local", password: "salah-salah-salah" }, meta));
    await challengeFor("finance@test.local"); // password benar → tantangan, penghitung tetap 4
    await err(beginLogin({ email: "finance@test.local", password: "salah-salah-salah" }, meta)); // kegagalan ke-5
    expect(await blockedSeconds(`login:email:${hashKey("finance@test.local")}`)).toBeGreaterThan(0);
  });

  it("akun tanpa 2FA tidak berubah: langsung sesi", async () => {
    const r = await beginLogin({ email: "staff@test.local", password: TEST_PASSWORD }, meta);
    expect(r.kind).toBe("session");
  });
});

describe("kode pemulihan", () => {
  it("masuk dengan kode pemulihan (huruf kecil/tanpa strip diterima); sekali pakai; sisa dilaporkan; audit", async () => {
    const { recovery } = await enroll(fx.finance);
    const code = recovery[0]!;
    const s = await verifyLoginChallenge({ challenge: await challengeFor("finance@test.local"), code: code.toLowerCase().replace("-", "") }, meta);
    expect(s.recoveryRemaining).toBe(9);
    expect((await err(verifyLoginChallenge({ challenge: await challengeFor("finance@test.local"), code }, meta))).status).toBe(401);
    expect((await prisma.auditLog.findMany({ where: { action: "auth.2fa_recovery_used" } })).length).toBe(1);
    expect((await getTwoFactorStatus(fx.finance)).recoveryRemaining).toBe(9);
  });

  it("balapan: kode pemulihan yang sama dipakai 5 tantangan PARALEL → hanya satu berhasil", async () => {
    const { recovery } = await enroll(fx.finance);
    const cs = await Promise.all(Array.from({ length: 5 }, () => challengeFor("finance@test.local")));
    const rs = await Promise.allSettled(cs.map((c) => verifyLoginChallenge({ challenge: c, code: recovery[1]! }, meta)));
    expect(rs.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("buat ulang: kode lama hangus, 10 kode baru; wajib password + kode", async () => {
    const { secret, recovery } = await enroll(fx.finance);
    expect((await err(regenerateRecoveryCodes(fx.finance, { password: "salah-salah-salah", code: codeIn(secret, 1) }))).status).toBe(422);
    expect((await err(regenerateRecoveryCodes(fx.finance, { password: TEST_PASSWORD, code: "000000" }))).status).toBe(422);
    const r = await regenerateRecoveryCodes(fx.finance, { password: TEST_PASSWORD, code: codeIn(secret, 1) });
    expect(r.recoveryCodes).toHaveLength(10);
    expect((await err(verifyLoginChallenge({ challenge: await challengeFor("finance@test.local"), code: recovery[2]! }, meta))).status).toBe(401);
    expect((await verifyLoginChallenge({ challenge: await challengeFor("finance@test.local"), code: r.recoveryCodes[0]! }, meta)).recoveryRemaining).toBe(9);
  });
});

describe("menonaktifkan & reset", () => {
  it("nonaktifkan: wajib password + kode; setelahnya login biasa lagi; rahasia & kode terhapus; audit", async () => {
    const { secret } = await enroll(fx.finance);
    expect((await err(disableTwoFactor(fx.finance, { password: TEST_PASSWORD, code: "000000" }))).status).toBe(422);
    expect((await err(disableTwoFactor(fx.finance, { password: "salah-salah-salah", code: codeIn(secret, 1) }))).status).toBe(422);
    await disableTwoFactor(fx.finance, { password: TEST_PASSWORD, code: codeIn(secret, 1) });
    const row = await prisma.user.findUniqueOrThrow({ where: { id: fx.finance.userId } });
    expect([row.twoFactorEnabled, row.twoFactorSecretEnc, row.twoFactorLastStep]).toEqual([false, null, null]);
    expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: fx.finance.userId } })).toBe(0);
    expect((await beginLogin({ email: "finance@test.local", password: TEST_PASSWORD }, meta)).kind).toBe("session");
    expect((await prisma.auditLog.findMany({ where: { action: "auth.2fa_disabled" } })).length).toBe(1);
  });

  it("Administrator mereset 2FA akun lain: sesi dicabut, tantangan dihapus, bisa login biasa; bukan akun sendiri; hanya Admin", async () => {
    const { secret } = await enroll(fx.finance);
    const s = await createSession(fx.finance.userId, null, null);
    const c = await challengeFor("finance@test.local");
    for (const a of [fx.finance, fx.staff]) expect((await err(resetUserTwoFactor(a, fx.finance.userId))).status).toBe(403);
    expect((await err(resetUserTwoFactor(fx.admin, fx.admin.userId))).status).toBe(422);
    expect((await err(resetUserTwoFactor(fx.admin, fx.staff.userId))).status).toBe(409); // staf tidak memakai 2FA
    await resetUserTwoFactor(fx.admin, fx.finance.userId);
    expect(await validateSession(s.token)).toBeNull();
    expect((await err(verifyLoginChallenge({ challenge: c, code: codeIn(secret, 1) }, meta))).status).toBe(401);
    expect((await beginLogin({ email: "finance@test.local", password: TEST_PASSWORD }, meta)).kind).toBe("session");
    const log = (await prisma.auditLog.findMany({ where: { action: "auth.2fa_reset" } }))[0]!;
    expect([log.actorId, log.entityId]).toEqual([fx.admin.userId, fx.finance.userId]);
  });
});

describe("enkripsi & guard database", () => {
  it("AES-GCM: bolak-balik, IV acak, tag mendeteksi perubahan, kunci tujuan berbeda tidak dapat membuka", () => {
    const a = encryptField("RAHASIA"), b = encryptField("RAHASIA");
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe("RAHASIA");
    const [v, iv, tag, ct] = a.split(":");
    expect(() => decryptField([v, iv, tag, ct!.slice(0, -2) + (ct!.endsWith("AA") ? "BB" : "AA")].join(":"))).toThrow();
    expect(() => decryptField(a, "tujuan-lain")).toThrow();
    expect(() => decryptField("bukan-format")).toThrow();
  });

  it("SQL langsung: 2FA aktif tanpa rahasia ditolak; kode pemulihan terpakai tidak bisa 'dihidupkan' lagi atau diubah hash-nya", async () => {
    const sql = (q: string) => prisma.$executeRawUnsafe(q).then(() => null, (e: Error) => e.message);
    expect(await sql(`UPDATE users SET "twoFactorEnabled" = true WHERE id = '${fx.staff.userId}'`)).toMatch(/users_2fa_secret_chk/);
    await enroll(fx.finance);
    const rc = await prisma.twoFactorRecoveryCode.findFirstOrThrow({ where: { userId: fx.finance.userId } });
    await prisma.twoFactorRecoveryCode.update({ where: { id: rc.id }, data: { usedAt: new Date() } });
    expect(await sql(`UPDATE two_factor_recovery_codes SET "usedAt" = NULL WHERE id = '${rc.id}'`)).toMatch(/sudah dipakai/);
    expect(await sql(`UPDATE two_factor_recovery_codes SET "codeHash" = 'x' WHERE id = '${rc.id}'`)).toMatch(/tidak dapat diubah|sudah dipakai/);
    const fresh = await prisma.twoFactorRecoveryCode.findFirstOrThrow({ where: { userId: fx.finance.userId, usedAt: null } });
    expect(await sql(`UPDATE two_factor_recovery_codes SET "codeHash" = 'x' WHERE id = '${fresh.id}'`)).toMatch(/tidak dapat diubah/);
  });
});

describe("kewajiban 2FA per peran (MFA_REQUIRED_ROLES) & fitur nonaktif tanpa kunci", () => {
  async function withEnv<T>(vars: Record<string, string>, fn: () => Promise<T>): Promise<T> {
    const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
    vi.resetModules();
    Object.assign(process.env, vars);
    try { return await fn(); } finally {
      for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
      vi.resetModules();
    }
  }

  it("peran wajib & belum aktif: sesi bertanda mfaEnrollmentRequired; API (selain keamanan) 403; halaman → /security; setelah aktif normal", async () => {
    await withEnv({ MFA_REQUIRED_ROLES: "ADMIN,FINANCE" }, async () => {
      const cur = await import("@/server/auth/current");
      const ses = await import("@/server/auth/session");
      const twof = await import("@/server/services/two-factor");
      const a = await ses.createSession(fx.finance.userId, null, null);
      mockSession.token = a.token;
      const u = await ses.validateSession(a.token);
      expect(u).toMatchObject({ mfaEnrollmentRequired: true, twoFactorEnabled: false });
      expect((await err(cur.requireApiUser())).status).toBe(403);
      expect((await err(cur.requireApiUser())).message).toMatch(/wajib memakai autentikasi dua langkah/);
      await expect(cur.requireApiUser({ allowMfaSetup: true })).resolves.toMatchObject({ userId: fx.finance.userId });
      await expect(cur.requirePageUser()).rejects.toMatchObject({ digest: expect.stringContaining("/security") });
      // staf (tidak wajib) tidak terpengaruh
      const sa = await ses.createSession(fx.staff.userId, null, null);
      expect(await ses.validateSession(sa.token)).toMatchObject({ mfaEnrollmentRequired: false });

      const { secret } = await twof.beginTwoFactorSetup(fx.finance, { password: TEST_PASSWORD });
      await twof.enableTwoFactor({ ...fx.finance, sessionId: u!.sessionId }, { code: codeIn(secret, 0) });
      await expect(cur.requireApiUser()).resolves.toMatchObject({ mfaEnrollmentRequired: false, twoFactorEnabled: true });
      expect((await twof.getTwoFactorStatus(fx.finance)).required).toBe(true);
    });
  });

  it("peran wajib TIDAK dapat mematikan 2FA; peran lain boleh", async () => {
    const { secret } = await enroll(fx.finance);
    const s2 = await enroll(fx.staff);
    await withEnv({ MFA_REQUIRED_ROLES: "FINANCE" }, async () => {
      const twof = await import("@/server/services/two-factor");
      const e = (await twof.disableTwoFactor(fx.finance, { password: TEST_PASSWORD, code: codeIn(secret, 1) }).then(() => null, (x: unknown) => x)) as AppError;
      expect(e.status).toBe(403);
      await expect(twof.disableTwoFactor(fx.staff, { password: TEST_PASSWORD, code: codeIn(s2.secret, 1) })).resolves.toBeUndefined();
    });
  });

  it("konfigurasi salah gagal CEPAT: peran wajib tanpa DATA_ENCRYPTION_KEY, atau nama peran tidak dikenal", async () => {
    await withEnv({ MFA_REQUIRED_ROLES: "ADMIN", DATA_ENCRYPTION_KEY: "" }, async () => {
      const { env } = await import("@/server/env");
      expect(() => env()).toThrow(/DATA_ENCRYPTION_KEY/);
    });
    await withEnv({ MFA_REQUIRED_ROLES: "ADMIN,BOSS" }, async () => {
      const { env } = await import("@/server/env");
      expect(() => env()).toThrow(/MFA_REQUIRED_ROLES/);
    });
    await withEnv({ DATA_ENCRYPTION_KEY: "terlalu-pendek" }, async () => {
      const { env } = await import("@/server/env");
      expect(() => env()).toThrow(/minimal 32/);
    });
  });

  it("tanpa DATA_ENCRYPTION_KEY: status 'tidak tersedia' dan memulai ditolak dengan petunjuk", async () => {
    await withEnv({ DATA_ENCRYPTION_KEY: "" }, async () => {
      const twof = await import("@/server/services/two-factor");
      expect((await twof.getTwoFactorStatus(fx.finance)).available).toBe(false);
      const e = (await twof.beginTwoFactorSetup(fx.finance, { password: TEST_PASSWORD }).then(() => null, (x: unknown) => x)) as AppError;
      expect(e.message).toMatch(/DATA_ENCRYPTION_KEY/);
    });
  });
});
