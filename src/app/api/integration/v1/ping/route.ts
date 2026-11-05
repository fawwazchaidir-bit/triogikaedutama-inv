import { machineRoute } from "@/server/integration/machine-route";

/** GET /api/integration/v1/ping — uji kredensial: sah → identitas kredensial + jam server (untuk memeriksa selisih jam). */
export const GET = machineRoute({}, async ({ principal }) => ({
  ok: true,
  spec: "FMS1-HMAC-SHA256",
  client: { name: principal.name, keyId: principal.keyId, scopes: principal.scopes },
  serverTime: new Date().toISOString(),
}));
