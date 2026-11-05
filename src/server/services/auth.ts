import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma, transaction } from "../db";
import { env } from "../env";
import { Errors } from "../errors";
import { writeAudit } from "../audit";
import type { Actor } from "../actor";
import type { RequestMeta } from "../request-context";
import { dummyHash, hashPassword, needsRehash, validatePasswordStrength, verifyPassword } from "../auth/password";
import { blockedSeconds, hashKey, recordFailure, resetBucket } from "../auth/rate-limit";
import { createSession, purgeOldSessions, revokeAllSessions, revokeSessionByToken } from "../auth/session";
import { mfaEnrollmentRequired } from "@/lib/totp";
import { assertTwoFactorNotBlocked, recordTwoFactorFailure, resetTwoFactorBucket, verifySecondFactor } from "./two-factor";

const GENERIC_FAIL = "Email atau password salah.";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function limits() {
  const e = env();
  return {
    email: { max: e.LOGIN_MAX_ATTEMPTS, windowMs: e.LOGIN_WINDOW_MINUTES * 60_000, blockMs: e.LOGIN_LOCKOUT_MINUTES * 60_000 },
    // Batas per-IP lebih longgar (banyak pengguna bisa berbagi satu IP kantor).
    ip: { max: e.LOGIN_MAX_ATTEMPTS * 6, windowMs: e.LOGIN_WINDOW_MINUTES * 60_000, blockMs: e.LOGIN_LOCKOUT_MINUTES * 60_000 },
  };
}

const CHALLENGE_TTL_MS = 5 * 60_000;
const CHALLENGE_MAX_ATTEMPTS = 5;
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export interface SessionLogin {
  kind: "session";
  token: string;
  expiresAt: Date;
  user: { id: string; email: string; name: string; role: "ADMIN" | "FINANCE" | "STAFF"; mustChangePassword: boolean; mfaSetupRequired: boolean };
  /** Hanya bila masuk dengan kode pemulihan: sisa kode (UI memperingatkan bila hampir habis). */
  recoveryRemaining?: number;
}
export interface TwoFactorChallenge { kind: "challenge"; challenge: string; expiresInSeconds: number }

type UserRow = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;

/** Buat sesi + catat login. Dipakai langkah password (tanpa 2FA) maupun langkah kedua (dengan 2FA). */
async function completeLogin(user: UserRow, meta: RequestMeta, method: "password" | "totp" | "recovery"): Promise<SessionLogin> {
  const { token, expiresAt } = await createSession(user.id, meta.ip, meta.userAgent);
  await transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await writeAudit(tx, { userId: user.id, email: user.email, name: user.name, role: user.role, ...meta }, {
      action: "auth.login", entityType: "User", entityId: user.id, summary: method === "password" ? "Masuk" : `Masuk dengan 2FA (${method === "totp" ? "kode autentikator" : "kode pemulihan"})`,
    });
  });
  void purgeOldSessions().catch(() => undefined);
  return {
    kind: "session", token, expiresAt,
    user: {
      id: user.id, email: user.email, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword,
      mfaSetupRequired: mfaEnrollmentRequired(user.role, user.twoFactorEnabled, env().MFA_REQUIRED_ROLES),
    },
  };
}

/**
 * Langkah 1: email + password. Bila akun memakai 2FA, TIDAK ada sesi yang dibuat — hanya tantangan berumur 5 menit
 * (token acak; hanya hash-nya disimpan) yang harus dilengkapi lewat `verifyLoginChallenge`.
 */
export async function beginLogin(input: { email: string; password: string }, meta: RequestMeta): Promise<SessionLogin | TwoFactorChallenge> {
  const email = normalizeEmail(input.email);
  const cfg = limits();
  const emailKey = `login:email:${hashKey(email)}`;
  const ipKey = meta.ip ? `login:ip:${hashKey(meta.ip)}` : null;

  const waits = await Promise.all([blockedSeconds(emailKey), ipKey ? blockedSeconds(ipKey) : Promise.resolve(0)]);
  const wait = Math.max(...waits);
  if (wait > 0) {
    throw Errors.rateLimited(`Terlalu banyak percobaan masuk. Coba lagi dalam ${Math.ceil(wait / 60)} menit.`, {
      retryAfterSeconds: wait,
    });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Selalu jalankan verifikasi (hash dummy bila user tidak ada) agar waktu respons seragam.
  const ok = await verifyPassword(input.password, user?.passwordHash ?? (await dummyHash()));

  if (!user || !ok || !user.isActive) {
    const [e] = await Promise.all([recordFailure(emailKey, cfg.email), ipKey ? recordFailure(ipKey, cfg.ip) : null]);
    if (user) {
      await writeAudit(prisma, null, {
        action: "auth.login_failed",
        entityType: "User",
        entityId: user.id,
        summary: user.isActive ? "Percobaan masuk gagal (password salah)" : "Percobaan masuk ke akun nonaktif",
        after: { email, ip: meta.ip, lockedOut: e.blocked },
      });
    }
    throw Errors.unauthenticated(GENERIC_FAIL);
  }

  // Naikkan parameter hash secara transparan bila kebijakan berubah (hanya di sini: password polos tersedia).
  if (needsRehash(user.passwordHash)) await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.password) } });

  if (user.twoFactorEnabled) {
    // Penghitung gagal-login TIDAK direset di sini: password benar saja belum membuktikan pemilik akun.
    const challenge = randomBytes(32).toString("base64url");
    await prisma.loginChallenge.create({ data: { userId: user.id, tokenHash: sha256(challenge), expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS), ip: meta.ip } });
    return { kind: "challenge", challenge, expiresInSeconds: CHALLENGE_TTL_MS / 1000 };
  }

  await resetBucket(emailKey);
  return completeLogin(user, meta, "password");
}

/**
 * Masuk khusus akun TANPA 2FA (dipakai tes & skrip). Bila akun memakai 2FA → ditolak: jalur aplikasi memakai `beginLogin` + `verifyLoginChallenge`.
 */
export async function login(input: { email: string; password: string }, meta: RequestMeta): Promise<SessionLogin> {
  const r = await beginLogin(input, meta);
  if (r.kind === "challenge") throw Errors.conflict("Akun ini memakai autentikasi dua langkah; gunakan beginLogin + verifyLoginChallenge.");
  return r;
}

const EXPIRED = "Sesi verifikasi berakhir. Silakan masuk ulang.";

/** Langkah 2: tantangan + kode TOTP / kode pemulihan → sesi. Sekali pakai, ≤ 5 percobaan per tantangan, plus batas per pengguna. */
export async function verifyLoginChallenge(input: { challenge: string; code: string }, meta: RequestMeta): Promise<SessionLogin> {
  const ch = await prisma.loginChallenge.findUnique({ where: { tokenHash: sha256(input.challenge) }, include: { user: true } });
  if (!ch || ch.consumedAt || ch.expiresAt.getTime() <= Date.now() || ch.attempts >= CHALLENGE_MAX_ATTEMPTS || !ch.user.isActive || !ch.user.twoFactorEnabled) {
    throw Errors.unauthenticated(EXPIRED);
  }
  await assertTwoFactorNotBlocked(ch.userId);

  const v = await verifySecondFactor(ch.userId, input.code);
  if (!v.ok) {
    const [{ attempts }] = await Promise.all([
      prisma.loginChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } }, select: { attempts: true } }),
      recordTwoFactorFailure(ch.userId),
    ]);
    if (attempts >= CHALLENGE_MAX_ATTEMPTS) await prisma.loginChallenge.update({ where: { id: ch.id }, data: { consumedAt: new Date() } });
    await writeAudit(prisma, null, { action: "auth.2fa_failed", entityType: "User", entityId: ch.userId, summary: "Kode 2FA salah saat masuk", after: { email: ch.user.email, ip: meta.ip, attempts } });
    throw Errors.unauthenticated(attempts >= CHALLENGE_MAX_ATTEMPTS ? EXPIRED : "Kode salah atau sudah dipakai.");
  }

  // Tantangan hanya dapat dipakai sekali (pembaruan bersyarat → aman terhadap permintaan paralel).
  const used = await prisma.loginChallenge.updateMany({ where: { id: ch.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (used.count !== 1) throw Errors.unauthenticated(EXPIRED);
  await Promise.all([resetBucket(`login:email:${hashKey(ch.user.email)}`), resetTwoFactorBucket(ch.userId)]);
  const session = await completeLogin(ch.user, meta, v.method!);
  if (v.method === "recovery") {
    await writeAudit(prisma, { userId: ch.user.id, email: ch.user.email, name: ch.user.name, role: ch.user.role, ...meta }, {
      action: "auth.2fa_recovery_used", entityType: "User", entityId: ch.user.id, summary: `Kode pemulihan 2FA dipakai (sisa ${v.recoveryRemaining})`,
    });
    session.recoveryRemaining = v.recoveryRemaining;
  }
  return session;
}

export async function logout(token: string | undefined, actor: Actor | null): Promise<void> {
  if (token) await revokeSessionByToken(token);
  if (actor) {
    await writeAudit(prisma, actor, { action: "auth.logout", entityType: "User", entityId: actor.userId, summary: "Keluar" });
  }
}

export async function changeOwnPassword(
  actor: Actor & { sessionId?: string },
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: actor.userId } });
  if (!user) throw Errors.notFound("Pengguna");
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw Errors.validation("Password saat ini salah.", { currentPassword: "Password saat ini salah." });
  }
  const weak = validatePasswordStrength(input.newPassword, { email: user.email, name: user.name });
  if (weak) throw Errors.validation(weak, { newPassword: weak });
  if (input.newPassword === input.currentPassword) {
    throw Errors.validation("Password baru harus berbeda.", { newPassword: "Password baru harus berbeda." });
  }
  const passwordHash = await hashPassword(input.newPassword);
  await transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });
    await writeAudit(tx, actor, { action: "auth.password_changed", entityType: "User", entityId: user.id, summary: "Password diganti" });
  });
  // Cabut sesi lain; sesi saat ini tetap aktif.
  await revokeAllSessions(user.id, actor.sessionId);
}
