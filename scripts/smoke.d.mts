export interface SmokeCheck { name: string; status: "PASS" | "FAIL" | "WARN" | "INFO"; detail: string }
export function runSmoke(opts: { baseUrl: string; email?: string; password?: string; totpSecret?: string; timeoutMs?: number }): Promise<{ ok: boolean; checks: SmokeCheck[] }>;
