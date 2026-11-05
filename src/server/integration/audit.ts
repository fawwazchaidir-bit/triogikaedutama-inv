import "server-only";
import type { Tx } from "../db";
import { prisma } from "../db";
import { toJson } from "../json";
import type { AuditEntry } from "../audit";
import type { MachinePrincipal } from "./machine-route";

/**
 * Audit untuk perubahan yang dilakukan lewat API mesin: pelaku = kredensial (`api:<keyId>`), bukan pengguna manusia.
 * Panggil dengan `tx` yang sama dengan perubahan datanya (atomik), persis seperti `writeAudit`.
 */
export async function writeMachineAudit(tx: Tx | typeof prisma, p: MachinePrincipal, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: null,
      actorEmail: `api:${p.keyId}`,
      actorRole: null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: `[${p.name}] ${entry.summary ?? ""}`.trim(),
      before: entry.before === undefined ? undefined : toJson(entry.before),
      after: entry.after === undefined ? undefined : toJson(entry.after),
      reason: entry.reason ?? null,
      ip: p.ip,
      userAgent: p.userAgent?.slice(0, 300) ?? null,
    },
  });
}
