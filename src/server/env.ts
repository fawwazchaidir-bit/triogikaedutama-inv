import "server-only";
import { z } from "zod";

const bool = z.enum(["true", "false"]).transform((v) => v === "true");
const int = (def: number, min = 1, max = 1_000_000) =>
  z.coerce.number().int().min(min).max(max).default(def);

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_TIMEZONE: z.string().default("Asia/Jakarta"),
  TRUST_PROXY: bool.default(false),
  LOGIN_MAX_ATTEMPTS: int(5, 1, 100),
  LOGIN_WINDOW_MINUTES: int(15, 1, 1440),
  LOGIN_LOCKOUT_MINUTES: int(15, 1, 1440),
  SESSION_IDLE_HOURS: int(8, 1, 720),
  SESSION_ABSOLUTE_DAYS: int(7, 1, 90),
  MAX_UPLOAD_MB: int(3, 1, 20),
  /** Kunci induk untuk menurunkan rahasia kredensial integrasi (mesin-ke-mesin). Kosong = integrasi nonaktif. Minimal 32 karakter acak. */
  /** Kunci enkripsi data sensitif (rahasia TOTP). Kosong = 2FA tidak dapat diaktifkan. Minimal 32 karakter acak; JANGAN diganti setelah ada pengguna ber-2FA. */
  DATA_ENCRYPTION_KEY: z.string().trim().optional().transform((v) => v || undefined).pipe(z.string().min(32, "DATA_ENCRYPTION_KEY minimal 32 karakter").optional()),
  /** Peran yang WAJIB memakai 2FA (dipisah koma), mis. "ADMIN,FINANCE". Kosong = 2FA opsional untuk semua. */
  MFA_REQUIRED_ROLES: z.string().default("").transform((v) => v.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean)).pipe(z.array(z.enum(["ADMIN", "FINANCE", "STAFF"]), { message: "MFA_REQUIRED_ROLES hanya boleh berisi ADMIN, FINANCE, STAFF" })),
  INTEGRATION_MASTER_KEY: z.string().trim().optional().transform((v) => v || undefined).pipe(z.string().min(32, "INTEGRATION_MASTER_KEY minimal 32 karakter").optional()),
});

export type Env = z.infer<typeof schema>;

function crossCheck(e: Env): string | null {
  if (e.MFA_REQUIRED_ROLES.length > 0 && !e.DATA_ENCRYPTION_KEY) return "MFA_REQUIRED_ROLES diisi tetapi DATA_ENCRYPTION_KEY kosong — pengguna tidak akan dapat mengaktifkan 2FA (terkunci). Isi DATA_ENCRYPTION_KEY.";
  return null;
}

let cached: Env | null = null;

/** Env divalidasi sekali; kesalahan konfigurasi gagal CEPAT dengan pesan yang jelas. */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Konfigurasi environment tidak valid — ${msg}`);
    }
    const bad = crossCheck(parsed.data);
    if (bad) throw new Error(`Konfigurasi environment tidak valid — ${bad}`);
    cached = parsed.data;
  }
  return cached;
}

export function isSecureDeployment(): boolean {
  return env().APP_URL.startsWith("https://");
}
