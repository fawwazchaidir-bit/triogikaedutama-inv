"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, KeyRound, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Notice } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { ApiClientDto, IntegrationStatus } from "@/server/services/integration-clients";

interface Form { id?: string; name: string; description: string; scopes: string[]; ips: string; rate: string }
const blank: Form = { name: "", description: "", scopes: [], ips: "", rate: "120" };

export function IntegrationManager({ status, items }: { status: IntegrationStatus; items: ApiClientDto[] }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<Form | null>(null);
  const [secret, setSecret] = useState<null | { name: string; keyId: string; secret: string; rotated: boolean }>(null);
  const [rotate, setRotate] = useState<null | { id: string; name: string; grace: string }>(null);
  const [revoke, setRevoke] = useState<null | { id: string; name: string; reason: string }>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const fail = (e: unknown) => { setError(errorMessage(e)); if (e instanceof ApiClientError) setFe(e.fieldErrors); };

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null); setFe({});
    try { await fn(); router.refresh(); } catch (e) { fail(e); } finally { setBusy(false); }
  }
  const body = (f: Form) => ({
    name: f.name, description: f.description || null, scopes: f.scopes,
    allowedIps: f.ips.split(/[\s,;]+/).filter(Boolean), rateLimitPerMinute: Number(f.rate),
  });
  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast.success("Disalin."), () => toast.error("Gagal menyalin; salin manual."));

  return (
    <Card>
      <CardHeader
        title="Integrasi sistem lain"
        description="Kredensial untuk website pendaftaran dan Portal (mesin-ke-mesin). Setiap permintaan ditandatangani HMAC, berlaku sekali (anti-replay), dan dibatasi per scope."
        actions={<Button variant="primary" disabled={!status.enabled} onClick={() => { setError(null); setFe({}); setForm({ ...blank }); }}><Plus className="size-4" />Buat kredensial</Button>}
      />
      <div className="space-y-4 p-5">
        {!status.enabled && (
          <Notice tone="warn"><strong>Integrasi belum aktif.</strong> Atur <code>INTEGRATION_MASTER_KEY</code> (minimal 32 karakter acak, mis. <code>openssl rand -hex 32</code>) pada environment server lalu jalankan ulang aplikasi. Lihat docs/INTEGRATION.md.</Notice>
        )}
        <p className="text-sm text-muted">Alamat dasar API: <code className="rounded bg-canvas px-1.5 py-0.5 text-ink">{status.baseUrl}</code></p>
      </div>
      <TableWrap>
        <Table>
          <thead><tr><Th>Nama</Th><Th>Key ID</Th><Th>Scope</Th><Th>Batas</Th><Th>Terakhir dipakai</Th><Th>Status</Th><Th align="right">Aksi</Th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">Belum ada kredensial.</td></tr>}
            {items.map((c) => (
              <tr key={c.id} data-testid={`client-${c.keyId}`}>
                <Td className="font-medium">{c.name}{c.description && <span className="block text-xs font-normal text-muted">{c.description}</span>}</Td>
                <Td mono>{c.keyId}</Td>
                <Td><div className="flex max-w-xs flex-wrap gap-1">{c.scopes.length ? c.scopes.map((s) => <Badge key={s} tone="blue">{s}</Badge>) : <span className="text-muted">—</span>}</div>{c.allowedIps.length > 0 && <span className="mt-1 block text-xs text-muted">IP: {c.allowedIps.join(", ")}</span>}</Td>
                <Td className="tabular whitespace-nowrap">{c.rateLimitPerMinute}/menit</Td>
                <Td className="whitespace-nowrap">{c.lastUsedAt ? <>{formatDateTime(c.lastUsedAt)}{c.lastUsedIp && <span className="block text-xs text-muted">{c.lastUsedIp}</span>}</> : <span className="text-muted">Belum pernah</span>}</Td>
                <Td>{c.isActive ? <Badge tone="green">Aktif</Badge> : <Badge tone="dark" >Dicabut</Badge>}{c.isActive && c.graceUntil && <Badge tone="amber" className="ml-1">Rotasi berjalan</Badge>}{!c.isActive && c.revokeReason && <span className="mt-1 block text-xs text-muted">{c.revokeReason}</span>}</Td>
                <Td align="right">{c.isActive && (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" onClick={() => { setError(null); setFe({}); setForm({ id: c.id, name: c.name, description: c.description ?? "", scopes: c.scopes, ips: c.allowedIps.join("\n"), rate: String(c.rateLimitPerMinute) }); }}>Ubah</Button>
                    <Button size="sm" disabled={!status.enabled} onClick={() => { setError(null); setRotate({ id: c.id, name: c.name, grace: "0" }); }}>Rotasi rahasia</Button>
                    <Button size="sm" variant="danger" onClick={() => { setError(null); setRevoke({ id: c.id, name: c.name, reason: "" }); }}>Cabut</Button>
                  </div>
                )}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>

      <Dialog open={!!form} onClose={() => !busy && setForm(null)} title={form?.id ? "Ubah kredensial" : "Buat kredensial"} size="md"
        footer={<><Button onClick={() => setForm(null)} disabled={busy}>Batal</Button>
          <Button variant="primary" loading={busy} onClick={() => form && void run(async () => {
            if (form.id) { await api(`/api/integration/clients/${form.id}`, { method: "PATCH", body: body(form) }); toast.success("Kredensial diperbarui."); setForm(null); }
            else { const r = await api<{ client: ApiClientDto; secret: string }>("/api/integration/clients", { body: body(form) }); setForm(null); setSecret({ name: r.client.name, keyId: r.client.keyId, secret: r.secret, rotated: false }); }
          })}>{form?.id ? "Simpan" : "Buat"}</Button></>}>
        {form && <div className="space-y-4">
          {error && <Notice tone="danger">{error}</Notice>}
          <TextField label="Nama" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={fe.name} hint="mis. Website pendaftaran, Portal HRIS" />
          <TextAreaField label="Keterangan" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} error={fe.description} />
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">Scope (izin)</legend>
            <div className="space-y-2">
              {status.scopes.map((s) => (
                <label key={s.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={form.scopes.includes(s.id)} onChange={(e) => setForm({ ...form, scopes: e.target.checked ? [...form.scopes, s.id] : form.scopes.filter((x) => x !== s.id) })} />
                  <span><code className="text-xs">{s.id}</code><span className="block text-muted">{s.label}</span></span>
                </label>
              ))}
            </div>
            {fe.scopes && <p role="alert" className="mt-1 text-xs text-brand-700">{fe.scopes}</p>}
          </fieldset>
          <TextAreaField label="Daftar IP yang diizinkan (opsional)" rows={2} value={form.ips} onChange={(e) => setForm({ ...form, ips: e.target.value })} error={fe.allowedIps} hint="Satu IP per baris. Kosong = semua IP (tetap wajib tanda tangan). Efektif bila server melihat IP asli pengirim." />
          <TextField label="Batas permintaan per menit" type="number" min={10} max={6000} value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} error={fe.rateLimitPerMinute} />
        </div>}
      </Dialog>

      <Dialog open={!!secret} onClose={() => setSecret(null)} title={secret?.rotated ? "Rahasia baru" : "Kredensial dibuat"} size="md"
        description="Simpan rahasia ini SEKARANG di tempat aman (mis. .env sistem pengirim). Rahasia tidak dapat ditampilkan lagi; bila hilang, lakukan rotasi."
        footer={<Button variant="primary" onClick={() => setSecret(null)}>Saya sudah menyimpannya</Button>}>
        {secret && <div className="space-y-4">
          <Notice tone="warn">Jangan kirim rahasia lewat chat atau email. Hanya sistem <strong>{secret.name}</strong> yang boleh memegangnya.</Notice>
          {([["Key ID", secret.keyId, "api-key-id"], ["Rahasia (Secret)", secret.secret, "api-secret"]] as const).map(([l, v, tid]) => (
            <div key={tid}>
              <span className="mb-1 block text-sm font-medium text-ink">{l}</span>
              <div className="flex gap-2">
                <input readOnly value={v} data-testid={tid} aria-label={l} onFocus={(e) => e.currentTarget.select()} className="h-10 w-full rounded-md border border-line bg-field px-3 font-mono text-sm text-ink" />
                <Button type="button" onClick={() => void copy(v)} aria-label={`Salin ${l}`}><Copy className="size-4" /></Button>
              </div>
            </div>
          ))}
          <p className="flex items-center gap-2 text-sm text-muted"><KeyRound className="size-4" aria-hidden />Alamat dasar: <code>{status.baseUrl}</code></p>
        </div>}
      </Dialog>

      <Dialog open={!!rotate} onClose={() => !busy && setRotate(null)} title={`Rotasi rahasia — ${rotate?.name ?? ""}`} size="sm"
        footer={<><Button onClick={() => setRotate(null)} disabled={busy}>Batal</Button>
          <Button variant="primary" loading={busy} onClick={() => rotate && void run(async () => {
            const r = await api<{ client: ApiClientDto; secret: string }>(`/api/integration/clients/${rotate.id}/rotate`, { body: { graceMinutes: Number(rotate.grace) } });
            setRotate(null); setSecret({ name: r.client.name, keyId: r.client.keyId, secret: r.secret, rotated: true });
          })}>Rotasi</Button></>}>
        {rotate && <div className="space-y-4">{error && <Notice tone="danger">{error}</Notice>}
          <SelectField label="Rahasia lama tetap berlaku" value={rotate.grace} onChange={(e) => setRotate({ ...rotate, grace: e.target.value })} hint="Beri waktu agar sistem pengirim sempat memasang rahasia baru tanpa henti layanan.">
            <option value="0">Tidak — langsung tidak berlaku</option><option value="15">15 menit</option><option value="60">1 jam</option><option value="1440">24 jam</option>
          </SelectField>
        </div>}
      </Dialog>

      <ConfirmDialog open={!!revoke} onClose={() => !busy && setRevoke(null)} loading={busy} tone="danger" confirmLabel="Cabut kredensial"
        title={`Cabut kredensial — ${revoke?.name ?? ""}?`} description="Seluruh permintaan dengan kredensial ini langsung ditolak. Tindakan ini tidak dapat dibatalkan; untuk memakai lagi, buat kredensial baru."
        onConfirm={() => revoke && void run(async () => { await api(`/api/integration/clients/${revoke.id}/revoke`, { body: { reason: revoke.reason } }); toast.success("Kredensial dicabut."); setRevoke(null); })}>
        {revoke && <div className="space-y-3">{error && <Notice tone="danger">{error}</Notice>}
          <TextAreaField label="Alasan" required rows={2} value={revoke.reason} onChange={(e) => setRevoke({ ...revoke, reason: e.target.value })} error={fe.reason} />
        </div>}
      </ConfirmDialog>
    </Card>
  );
}
