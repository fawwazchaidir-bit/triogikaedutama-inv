import "server-only";
import { createHash } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { prisma, transaction, type Tx } from "../db";
import { Errors } from "../errors";
import { env } from "../env";
import { parseInput } from "../validate";
import { assertCan, type Actor } from "../actor";
import { writeAudit } from "../audit";
import { decryptField, encryptField, encryptionEnabled } from "../crypto";
import { verifyPassword } from "../auth/password";
import { blockedSeconds, recordFailure, resetBucket } from "../auth/rate-limit";
import { revokeAllSessions } from "../auth/session";
import { generateRecoveryCode, generateTotpSecret, looksLikeRecoveryCode, normalizeRecoveryCode, otpauthUri, verifyTotp } from "@/lib/totp";

/**
 * Autentikasi dua langkah (TOTP RFC 6238) + kode pemulihan sekali pakai.
 *  • Rahasia TOTP dienkripsi AES-256-GCM; kode pemulihan hanya disimpan sebagai hash.
 *  • Kode TOTP sekali pakai (anti-replay atomik di database); kode pemulihan sekali pakai (UPDATE bersyarat, aman paralel).
 *  • Percobaan salah dibatasi per pengguna (sama dengan batas login) — berlaku untuk login, enrol, nonaktifkan, dan buat-ulang kode.
 *  • Tindakan sensitif (mulai, nonaktifkan, buat ulang kode) meminta password (+ kode) lagi, walau sesi sudah aktif.
 */
export const RECOVERY_CODE_COUNT = 10;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export const twoFactorBucketKey = (userId: string) => `twofa:user:${userId}`;

function limitCfg() {
  const e = env();
  return { max: e.LOGIN_MAX_ATTEMPTS, windowMs: e.LOGIN_WINDOW_MINUTES * 60_000, blockMs: e.LOGIN_LOCKOUT_MINUTES * 60_000 };
}

export async function assertTwoFactorNotBlocked(userId: string): Promise<void> {
  const wait = await blockedSeconds(twoFactorBucketKey(userId));
  if (wait > 0) throw Errors.rateLimited(`Terlalu banyak percobaan salah. Coba lagi dalam ${Math.ceil(wait / 60)} menit.`, { retryAfterSeconds: wait });
}
export const resetTwoFactorBucket = (userId: string) => resetBucket(twoFactorBucketKey(userId));
export const recordTwoFactorFailure = (userId: string) => recordFailure(twoFactorBucketKey(userId), limitCfg());

export interface SecondFactorResult { ok: boolean; method?: "totp" | "recovery"; recoveryRemaining?: number }

/**
 * Verifikasi faktor kedua: kode TOTP 6 digit ATAU kode pemulihan. Pemanggil bertanggung jawab atas pembatasan percobaan.
 */
export async function verifySecondFactor(userId: string, code: string): Promise<SecondFactorResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorEnabled: true, twoFactorSecretEnc: true, twoFactorLastStep: true } });
  if (!user?.twoFactorEnabled || !user.twoFactorSecretEnc) return { ok: false };
  if (looksLikeRecoveryCode(code)) {
    const r = await prisma.twoFactorRecoveryCode.updateMany({ where: { userId, codeHash: sha256(normalizeRecoveryCode(code)), usedAt: null }, data: { usedAt: new Date() } });
    if (r.count !== 1) return { ok: false };
    return { ok: true, method: "recovery", recoveryRemaining: await prisma.twoFactorRecoveryCode.count({ where: { userId, usedAt: null } }) };
  }
  const v = verifyTotp(decryptField(user.twoFactorSecretEnc), code, { lastStep: user.twoFactorLastStep });
  if (!v.ok || v.step === undefined) return { ok: false };
  // Klaim langkah secara atomik: hanya satu permintaan yang dapat memajukan langkah terakhir.
  const claimed = await prisma.$executeRaw`UPDATE users SET "twoFactorLastStep" = ${v.step} WHERE id = ${userId}::uuid AND ("twoFactorLastStep" IS NULL OR "twoFactorLastStep" < ${v.step})`;
  return claimed === 1 ? { ok: true, method: "totp" } : { ok: false };
}

/** Periksa password + (bila diminta) faktor kedua untuk tindakan sensitif pada akun sendiri. */
async function reauthenticate(actor: Actor, password: string, code: string | null): Promise<void> {
  await assertTwoFactorNotBlocked(actor.userId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
  if (!(await verifyPassword(password, user.passwordHash))) {
    await recordTwoFactorFailure(actor.userId);
    throw Errors.validation("Password salah.", { password: "Password salah." });
  }
  if (code !== null) {
    const v = await verifySecondFactor(actor.userId, code);
    if (!v.ok) {
      await recordTwoFactorFailure(actor.userId);
      throw Errors.validation("Kode verifikasi salah atau sudah dipakai.", { code: "Kode salah atau sudah dipakai" });
    }
  }
}

export interface TwoFactorStatus {
  /** Server dapat menyimpan rahasia 2FA (DATA_ENCRYPTION_KEY terisi). */
  available: boolean;
  enabled: boolean;
  enabledAt: string | null;
  recoveryRemaining: number;
  /** Peran ini diwajibkan memakai 2FA oleh konfigurasi server → tidak dapat dimatikan. */
  required: boolean;
}

export async function getTwoFactorStatus(actor: Actor): Promise<TwoFactorStatus> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { twoFactorEnabled: true, twoFactorEnabledAt: true } });
  const remaining = u.twoFactorEnabled ? await prisma.twoFactorRecoveryCode.count({ where: { userId: actor.userId, usedAt: null } }) : 0;
  return {
    available: encryptionEnabled(), enabled: u.twoFactorEnabled, enabledAt: u.twoFactorEnabledAt?.toISOString() ?? null,
    recoveryRemaining: remaining, required: env().MFA_REQUIRED_ROLES.includes(actor.role),
  };
}

const passwordSchema = z.object({ password: z.string().min(1, "Password wajib diisi").max(256) });
const codeSchema = z.object({ code: z.string().trim().min(6, "Masukkan kode 6 digit").max(20) });
const reauthSchema = passwordSchema.merge(codeSchema);

export interface TwoFactorSetup { secret: string; otpauthUri: string; qrDataUrl: string }

/** Langkah 1: buat rahasia baru (belum aktif). Memerlukan password. Memanggil ulang membuat rahasia baru. */
export async function beginTwoFactorSetup(actor: Actor, raw: unknown): Promise<TwoFactorSetup> {
  const { password } = parseInput(passwordSchema, raw);
  if (!encryptionEnabled()) throw Errors.validation("2FA belum dapat diaktifkan: DATA_ENCRYPTION_KEY belum diatur di server. Hubungi administrator sistem.");
  await reauthenticate(actor, password, null);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { twoFactorEnabled: true, email: true } });
  if (user.twoFactorEnabled) throw Errors.conflict("Autentikasi dua langkah sudah aktif.");
  const secret = generateTotpSecret();
  // Rahasia tertunda disimpan terenkripsi tetapi BELUM aktif (twoFactorEnabled tetap false) sampai kode pertama dikonfirmasi.
  await prisma.user.update({ where: { id: actor.userId }, data: { twoFactorSecretEnc: encryptField(secret) } });
  const brand = (await prisma.companySettings.findUnique({ where: { id: 1 }, select: { name: true } }))?.name ?? "Financial Management System";
  const uri = otpauthUri({ issuer: brand, account: user.email, secret });
  const svg = await QRCode.toString(uri, { type: "svg", margin: 1, width: 220, errorCorrectionLevel: "M" });
  return { secret, otpauthUri: uri, qrDataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` };
}

async function newRecoveryCodes(tx: Tx, userId: string): Promise<string[]> {
  await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateRecoveryCode());
  await tx.twoFactorRecoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: sha256(normalizeRecoveryCode(c)) })) });
  return codes;
}

/** Langkah 2: konfirmasi dengan kode dari aplikasi autentikator → aktif. Mengembalikan kode pemulihan SATU KALI. */
export async function enableTwoFactor(actor: Actor & { sessionId?: string }, raw: unknown): Promise<{ recoveryCodes: string[] }> {
  const { code } = parseInput(codeSchema, raw);
  await assertTwoFactorNotBlocked(actor.userId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
  if (user.twoFactorEnabled) throw Errors.conflict("Autentikasi dua langkah sudah aktif.");
  if (!user.twoFactorSecretEnc) throw Errors.validation("Mulai pengaturan dari awal (rahasia belum dibuat).");
  const v = verifyTotp(decryptField(user.twoFactorSecretEnc), code);
  if (!v.ok || v.step === undefined) {
    await recordTwoFactorFailure(actor.userId);
    throw Errors.validation("Kode tidak cocok. Pastikan jam ponsel akurat, lalu coba kode berikutnya.", { code: "Kode tidak cocok" });
  }
  const codes = await transaction(async (tx) => {
    const r = await tx.user.updateMany({ where: { id: actor.userId, twoFactorEnabled: false }, data: { twoFactorEnabled: true, twoFactorEnabledAt: new Date(), twoFactorLastStep: v.step } });
    if (r.count === 0) throw Errors.conflict("Autentikasi dua langkah sudah aktif.");
    const c = await newRecoveryCodes(tx, actor.userId);
    await writeAudit(tx, actor, { action: "auth.2fa_enabled", entityType: "User", entityId: actor.userId, summary: "Autentikasi dua langkah diaktifkan" });
    return c;
  });
  await resetBucket(twoFactorBucketKey(actor.userId));
  await revokeAllSessions(actor.userId, actor.sessionId); // sesi lain (mungkin milik penyerang) tidak lagi sah
  return { recoveryCodes: codes };
}

/** Matikan 2FA sendiri: perlu password + kode. Ditolak bila konfigurasi server mewajibkannya untuk peran ini. */
export async function disableTwoFactor(actor: Actor & { sessionId?: string }, raw: unknown): Promise<void> {
  const { password, code } = parseInput(reauthSchema, raw);
  if (env().MFA_REQUIRED_ROLES.includes(actor.role)) throw Errors.forbidden("Peran Anda diwajibkan memakai autentikasi dua langkah oleh kebijakan; tidak dapat dimatikan.");
  await reauthenticate(actor, password, code);
  await transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.userId }, data: { twoFactorEnabled: false, twoFactorSecretEnc: null, twoFactorEnabledAt: null, twoFactorLastStep: null } });
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userId: actor.userId } });
    await writeAudit(tx, actor, { action: "auth.2fa_disabled", entityType: "User", entityId: actor.userId, summary: "Autentikasi dua langkah dimatikan" });
  });
  await resetBucket(twoFactorBucketKey(actor.userId));
  await revokeAllSessions(actor.userId, actor.sessionId);
}

/** Buat ulang kode pemulihan (yang lama hangus). Perlu password + kode. */
export async function regenerateRecoveryCodes(actor: Actor, raw: unknown): Promise<{ recoveryCodes: string[] }> {
  const { password, code } = parseInput(reauthSchema, raw);
  if (!(await getTwoFactorStatus(actor)).enabled) throw Errors.validation("Autentikasi dua langkah belum aktif.");
  await reauthenticate(actor, password, code);
  const codes = await transaction(async (tx) => {
    const c = await newRecoveryCodes(tx, actor.userId);
    await writeAudit(tx, actor, { action: "auth.2fa_recovery_regenerated", entityType: "User", entityId: actor.userId, summary: "Kode pemulihan 2FA dibuat ulang" });
    return c;
  });
  await resetBucket(twoFactorBucketKey(actor.userId));
  return { recoveryCodes: codes };
}

/**
 * Administrator mengatur ulang 2FA akun LAIN (ponsel hilang & kode pemulihan habis). Tidak dapat untuk akun sendiri.
 * Semua sesi akun itu dicabut; bila peran itu wajib 2FA, ia harus mengaktifkan ulang saat masuk berikutnya.
 */
export async function resetUserTwoFactor(actor: Actor, userId: string): Promise<void> {
  assertCan(actor, "user:manage");
  if (userId === actor.userId) throw Errors.validation("Gunakan kode pemulihan untuk akun Anda sendiri; reset hanya untuk akun lain.");
  await transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: userId }, select: { email: true, twoFactorEnabled: true } });
    if (!u) throw Errors.notFound("Pengguna");
    if (!u.twoFactorEnabled) throw Errors.conflict("Akun ini tidak memakai autentikasi dua langkah.");
    await tx.user.update({ where: { id: userId }, data: { twoFactorEnabled: false, twoFactorSecretEnc: null, twoFactorEnabledAt: null, twoFactorLastStep: null } });
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
    await tx.loginChallenge.deleteMany({ where: { userId } });
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(tx, actor, { action: "auth.2fa_reset", entityType: "User", entityId: userId, summary: `2FA akun ${u.email} diatur ulang oleh administrator` });
  });
  await resetBucket(twoFactorBucketKey(userId));
}
