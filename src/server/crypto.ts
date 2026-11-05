import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { env } from "./env";
import { Errors } from "./errors";

/**
 * Enkripsi field sensitif (rahasia TOTP) dengan AES-256-GCM. Format tersimpan: `v1:<iv>:<tag>:<ciphertext>` (base64url).
 * Kunci diturunkan (HKDF-SHA256) dari DATA_ENCRYPTION_KEY dengan label tujuan, jadi kunci yang sama aman dipakai untuk tujuan lain kelak.
 * Integritas dijamin tag GCM: data yang diubah di database gagal didekripsi (bukan menghasilkan nilai palsu).
 */
export const encryptionEnabled = (): boolean => Boolean(env().DATA_ENCRYPTION_KEY);

function key(purpose: string): Buffer {
  const k = env().DATA_ENCRYPTION_KEY;
  if (!k) throw Errors.validation("Fitur ini belum aktif: DATA_ENCRYPTION_KEY belum diatur di server (lihat docs/DEPLOYMENT.md).");
  return Buffer.from(hkdfSync("sha256", k, "fms-data-encryption", `field:${purpose}`, 32));
}

export function encryptField(plain: string, purpose = "totp"): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(purpose), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(":");
}

export function decryptField(stored: string, purpose = "totp"): string {
  const [v, iv, tag, ct] = stored.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Format data terenkripsi tidak dikenali");
  const d = createDecipheriv("aes-256-gcm", key(purpose), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}
