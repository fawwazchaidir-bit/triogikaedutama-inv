import { cookies } from "next/headers";
import { z } from "zod";
import { publicRoute, readJson } from "@/server/http";
import { verifyLoginChallenge } from "@/server/services/auth";
import { cookieOptions, SESSION_COOKIE_NAME } from "@/server/auth/session";

const schema = z.object({
  challenge: z.string().min(20, "Sesi verifikasi tidak valid").max(100),
  code: z.string().trim().min(6, "Masukkan kode 6 digit atau kode pemulihan").max(20),
});

/** Langkah 2 login: tantangan + kode TOTP / kode pemulihan → cookie sesi. */
export const POST = publicRoute(async ({ req, meta }) => {
  const r = await verifyLoginChallenge(await readJson(req, schema), meta);
  (await cookies()).set(SESSION_COOKIE_NAME(), r.token, cookieOptions(r.expiresAt));
  return { user: r.user, recoveryRemaining: r.recoveryRemaining ?? null };
});
