/**
 * Katalog scope kredensial mesin. Scope = izin SEMPIT per kredensial (least privilege): kredensial website tidak dapat
 * memakai jalur reimbursement dan sebaliknya. Tambah scope baru HANYA bersama endpoint yang memakainya.
 */
export const INTEGRATION_SCOPES = {
  "participant-payments:write": "Website: mengirim pembayaran peserta (Midtrans) yang sudah terverifikasi",
  "reimbursements:write": "Portal: mengajukan klaim reimbursement yang sudah disetujui atasan",
  "reimbursements:read": "Portal: membaca status klaim reimbursement",
} as const;

export type IntegrationScope = keyof typeof INTEGRATION_SCOPES;
export const SCOPE_IDS = Object.keys(INTEGRATION_SCOPES) as [IntegrationScope, ...IntegrationScope[]];
export const isScope = (v: string): v is IntegrationScope => v in INTEGRATION_SCOPES;
