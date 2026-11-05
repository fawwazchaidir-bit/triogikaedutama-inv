import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { env } from "../env";
import { Errors } from "../errors";

/**
 * Rahasia kredensial TIDAK disimpan di database: diturunkan dari INTEGRATION_MASTER_KEY, id klien, dan versi.
 * Kebocoran database saja tidak membocorkan rahasia; rotasi = menaikkan versi. Ditampilkan ke admin SEKALI (saat dibuat/dirotasi).
 */
export function integrationEnabled(): boolean {
  return Boolean(env().INTEGRATION_MASTER_KEY);
}

export function requireMasterKey(): string {
  const key = env().INTEGRATION_MASTER_KEY;
  if (!key) throw Errors.validation("Integrasi belum aktif: INTEGRATION_MASTER_KEY belum diatur di server (lihat docs/INTEGRATION.md).");
  return key;
}

export function deriveSecret(clientId: string, version: number, masterKey = requireMasterKey()): string {
  const raw = createHmac("sha256", masterKey).update(`fms-api-secret:v1:${clientId}:${version}`).digest("base64url");
  return `fmss_${raw}`;
}

export const newKeyId = (): string => `fmsk_${randomBytes(10).toString("hex")}`;
