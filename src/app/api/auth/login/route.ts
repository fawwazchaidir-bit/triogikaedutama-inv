import { cookies } from "next/headers";
import { z } from "zod";
import { publicRoute, readJson } from "@/server/http";
import { beginLogin } from "@/server/services/auth";
import { cookieOptions, SESSION_COOKIE_NAME } from "@/server/auth/session";

const schema = z.object({
  email: z.string().trim().min(1, "Email wajib diisi").max(200),
  password: z.string().min(1, "Password wajib diisi").max(256),
});

/** Langkah 1. Akun ber-2FA → `{ requiresTwoFactor: true, challenge }` TANPA cookie sesi; selain itu sesi dibuat seperti biasa. */
export const POST = publicRoute(async ({ req, meta }) => {
  const input = await readJson(req, schema);
  const r = await beginLogin(input, meta);
  if (r.kind === "challenge") return { requiresTwoFactor: true, challenge: r.challenge, expiresInSeconds: r.expiresInSeconds };
  (await cookies()).set(SESSION_COOKIE_NAME(), r.token, cookieOptions(r.expiresAt));
  return { user: r.user };
});
