import "server-only";
import { isIP } from "node:net";
import { z } from "zod";
import { prisma, transaction } from "../db";
import { env } from "../env";
import { Errors } from "../errors";
import { parseInput } from "../validate";
import { assertCan, type Actor } from "../actor";
import { writeAudit, diffFields } from "../audit";
import { deriveSecret, integrationEnabled, newKeyId, requireMasterKey } from "../integration/secrets";
import { INTEGRATION_SCOPES, SCOPE_IDS, type IntegrationScope } from "@/lib/integration/scopes";

/** Manajemen kredensial integrasi (hanya Administrator). Rahasia hanya dikembalikan SEKALI: saat dibuat atau dirotasi. */

const scopesSchema = z.array(z.enum(SCOPE_IDS)).max(SCOPE_IDS.length).transform((a) => [...new Set(a)]);
const ipsSchema = z.array(z.string().trim().refine((v) => isIP(v) !== 0, "Alamat IP tidak valid")).max(20).transform((a) => [...new Set(a)]);

export const apiClientCreateSchema = z.object({
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(80),
  description: z.string().trim().max(300).optional().nullable().transform((v) => v || null),
  scopes: scopesSchema,
  allowedIps: ipsSchema.default([]),
  rateLimitPerMinute: z.coerce.number().int().min(10, "Minimal 10 per menit").max(6000).default(120),
});
export const apiClientUpdateSchema = apiClientCreateSchema.partial();
export const rotateSchema = z.object({ graceMinutes: z.coerce.number().int().min(0).max(1440).default(0) });
export const revokeSchema = z.object({ reason: z.string().trim().min(5, "Alasan minimal 5 karakter").max(300) });

export interface ApiClientDto {
  id: string;
  keyId: string;
  name: string;
  description: string | null;
  scopes: IntegrationScope[];
  allowedIps: string[];
  rateLimitPerMinute: number;
  secretVersion: number;
  graceUntil: string | null;
  isActive: boolean;
  revokedAt: string | null;
  revokeReason: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
}

type Row = Awaited<ReturnType<typeof prisma.apiClient.findFirstOrThrow>>;
const toDto = (c: Row): ApiClientDto => ({
  id: c.id, keyId: c.keyId, name: c.name, description: c.description,
  scopes: c.scopes.filter((s): s is IntegrationScope => s in INTEGRATION_SCOPES),
  allowedIps: c.allowedIps, rateLimitPerMinute: c.rateLimitPerMinute, secretVersion: c.secretVersion,
  graceUntil: c.prevValidUntil && c.prevValidUntil.getTime() > Date.now() ? c.prevValidUntil.toISOString() : null,
  isActive: c.isActive, revokedAt: c.revokedAt?.toISOString() ?? null, revokeReason: c.revokeReason,
  createdAt: c.createdAt.toISOString(), lastUsedAt: c.lastUsedAt?.toISOString() ?? null, lastUsedIp: c.lastUsedIp,
});

export interface IntegrationStatus { enabled: boolean; baseUrl: string; scopes: { id: IntegrationScope; label: string }[] }

export function getIntegrationStatus(actor: Actor): IntegrationStatus {
  assertCan(actor, "integration:manage");
  return {
    enabled: integrationEnabled(),
    baseUrl: `${env().APP_URL.replace(/\/$/, "")}/api/integration/v1`,
    scopes: SCOPE_IDS.map((id) => ({ id, label: INTEGRATION_SCOPES[id] })),
  };
}

export async function listApiClients(actor: Actor): Promise<ApiClientDto[]> {
  assertCan(actor, "integration:manage");
  return (await prisma.apiClient.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] })).map(toDto);
}

export async function createApiClient(actor: Actor, raw: unknown): Promise<{ client: ApiClientDto; secret: string }> {
  assertCan(actor, "integration:manage");
  requireMasterKey();
  const input = parseInput(apiClientCreateSchema, raw);
  if (await prisma.apiClient.findFirst({ where: { name: { equals: input.name, mode: "insensitive" }, isActive: true } })) {
    throw Errors.conflict("Sudah ada kredensial aktif dengan nama itu.");
  }
  const row = await transaction(async (tx) => {
    const c = await tx.apiClient.create({
      data: { keyId: newKeyId(), name: input.name, description: input.description, scopes: input.scopes, allowedIps: input.allowedIps, rateLimitPerMinute: input.rateLimitPerMinute, createdById: actor.userId },
    });
    await writeAudit(tx, actor, { action: "integration.client.create", entityType: "ApiClient", entityId: c.id, summary: `Kredensial integrasi "${c.name}" dibuat (${c.keyId})`, after: { name: c.name, keyId: c.keyId, scopes: c.scopes, allowedIps: c.allowedIps, rateLimitPerMinute: c.rateLimitPerMinute } });
    return c;
  });
  return { client: toDto(row), secret: deriveSecret(row.id, row.secretVersion) };
}

async function loadActive(id: string) {
  const c = await prisma.apiClient.findUnique({ where: { id } });
  if (!c) throw Errors.notFound("Kredensial");
  if (!c.isActive) throw Errors.conflict("Kredensial sudah dicabut dan tidak dapat diubah.");
  return c;
}

export async function updateApiClient(actor: Actor, id: string, raw: unknown): Promise<ApiClientDto> {
  assertCan(actor, "integration:manage");
  const input = parseInput(apiClientUpdateSchema, raw);
  const before = await loadActive(id);
  const patch = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.scopes !== undefined ? { scopes: input.scopes } : {}),
    ...(input.allowedIps !== undefined ? { allowedIps: input.allowedIps } : {}),
    ...(input.rateLimitPerMinute !== undefined ? { rateLimitPerMinute: input.rateLimitPerMinute } : {}),
  };
  const d = diffFields({ name: before.name, description: before.description, scopes: before.scopes, allowedIps: before.allowedIps, rateLimitPerMinute: before.rateLimitPerMinute }, patch);
  if (d.changed.length === 0) return toDto(before);
  return transaction(async (tx) => {
    const c = await tx.apiClient.update({ where: { id }, data: patch });
    await writeAudit(tx, actor, { action: "integration.client.update", entityType: "ApiClient", entityId: id, summary: `Kredensial "${c.name}" diubah: ${d.changed.join(", ")}`, before: d.before, after: d.after });
    return toDto(c);
  });
}

/** Rotasi rahasia: versi naik. `graceMinutes` > 0 = versi lama tetap sah selama itu (rotasi tanpa henti layanan). */
export async function rotateApiClientSecret(actor: Actor, id: string, raw: unknown): Promise<{ client: ApiClientDto; secret: string }> {
  assertCan(actor, "integration:manage");
  requireMasterKey();
  const { graceMinutes } = parseInput(rotateSchema, raw ?? {});
  const before = await loadActive(id);
  const row = await transaction(async (tx) => {
    const c = await tx.apiClient.update({
      where: { id },
      data: {
        secretVersion: before.secretVersion + 1,
        prevSecretVersion: graceMinutes > 0 ? before.secretVersion : null,
        prevValidUntil: graceMinutes > 0 ? new Date(Date.now() + graceMinutes * 60_000) : null,
      },
    });
    await writeAudit(tx, actor, { action: "integration.client.rotate", entityType: "ApiClient", entityId: id, summary: `Rahasia "${c.name}" dirotasi ke versi ${c.secretVersion}${graceMinutes > 0 ? ` (versi lama berlaku ${graceMinutes} menit lagi)` : " (versi lama langsung tidak berlaku)"}`, before: { secretVersion: before.secretVersion }, after: { secretVersion: c.secretVersion, graceMinutes } });
    return c;
  });
  return { client: toDto(row), secret: deriveSecret(row.id, row.secretVersion) };
}

export async function revokeApiClient(actor: Actor, id: string, raw: unknown): Promise<ApiClientDto> {
  assertCan(actor, "integration:manage");
  const { reason } = parseInput(revokeSchema, raw);
  await loadActive(id);
  return transaction(async (tx) => {
    const c = await tx.apiClient.update({ where: { id }, data: { isActive: false, revokedAt: new Date(), revokedById: actor.userId, revokeReason: reason, prevSecretVersion: null, prevValidUntil: null } });
    await writeAudit(tx, actor, { action: "integration.client.revoke", entityType: "ApiClient", entityId: id, summary: `Kredensial "${c.name}" dicabut`, reason });
    return toDto(c);
  });
}
