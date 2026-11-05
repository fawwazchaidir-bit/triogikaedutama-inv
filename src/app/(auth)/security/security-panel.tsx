"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Download, ShieldCheck } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import type { TwoFactorStatus, TwoFactorSetup } from "@/server/services/two-factor";

type Mode = "idle" | "setup" | "disable" | "regen";

export function SecurityPanel({ initial, email, forced, lowRecovery }: { initial: TwoFactorStatus; email: string; forced: boolean; lowRecovery: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [mode, setMode] = useState<Mode>("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});

  const reset = (m: Mode = "idle") => { setMode(m); setPassword(""); setCode(""); setSetup(null); setError(null); setFe({}); };
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null); setFe({});
    try { await fn(); } catch (e) { setError(errorMessage(e)); if (e instanceof ApiClientError) setFe(e.fieldErrors); } finally { setBusy(false); }
  }
  const refresh = async () => setStatus(await api<TwoFactorStatus>("/api/account/2fa"));
  const copy = (t: string) => navigator.clipboard?.writeText(t).catch(() => undefined);
  const download = () => {
    const blob = new Blob([`Kode pemulihan Financial Management System — ${email}\nSimpan di tempat aman. Setiap kode hanya berlaku sekali.\n\n${codes!.join("\n")}\n`], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "kode-pemulihan-2fa.txt"; a.click(); URL.revokeObjectURL(a.href);
  };
  const leave = () => { router.replace("/"); router.refresh(); };

  // Kode pemulihan ditampilkan SEKALI setelah aktivasi / pembuatan ulang.
  if (codes) {
    return (
      <section className="w-full max-w-md space-y-5 rounded-xl border border-line bg-surface p-8 shadow-sm" aria-label="Kode pemulihan">
        <div>
          <h1 className="text-xl font-semibold text-ink">Simpan kode pemulihan</h1>
          <p className="mt-1 text-sm text-muted">Jika ponsel hilang, setiap kode ini dapat dipakai <strong>sekali</strong> untuk masuk. Kode tidak akan ditampilkan lagi.</p>
        </div>
        <ul className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-canvas p-4 font-mono text-sm" data-testid="recovery-codes">
          {codes.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <div className="flex gap-2">
          <Button type="button" onClick={() => void copy(codes.join("\n"))}><Copy className="size-4" />Salin</Button>
          <Button type="button" onClick={download}><Download className="size-4" />Unduh .txt</Button>
        </div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={saved} onChange={(e) => setSaved(e.target.checked)} />Saya sudah menyimpan kode ini di tempat aman.</label>
        <Button variant="primary" className="w-full" disabled={!saved} onClick={() => { setCodes(null); setSaved(false); if (forced || !status.enabled) leave(); else { reset(); router.refresh(); } }}>Selesai</Button>
      </section>
    );
  }

  return (
    <section className="w-full max-w-md space-y-5 rounded-xl border border-line bg-surface p-8 shadow-sm" aria-label="Keamanan akun">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 size-6 shrink-0 text-accent" aria-hidden />
        <div>
          <h1 className="text-xl font-semibold text-ink">Autentikasi dua langkah (2FA)</h1>
          <p className="mt-1 text-sm text-muted">Selain password, masuk memerlukan kode 6 digit dari aplikasi autentikator di ponsel Anda (Google/Microsoft Authenticator, Aegis, dll). Gratis dan bekerja tanpa internet.</p>
        </div>
      </div>

      {forced && <Notice tone="warn"><strong>Wajib untuk peran Anda.</strong> Aktifkan 2FA untuk melanjutkan memakai aplikasi.</Notice>}
      {lowRecovery && status.enabled && <Notice tone="warn">Kode pemulihan Anda hampir habis ({status.recoveryRemaining} tersisa). Buat ulang kode baru di bawah.</Notice>}
      {!status.available && <Notice tone="danger">Fitur ini belum aktif di server (DATA_ENCRYPTION_KEY belum diatur). Hubungi administrator sistem.</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}

      {mode === "idle" && (
        <>
          <div className="flex items-center justify-between rounded-lg border border-line p-4">
            <div>
              <p className="text-sm font-medium text-ink">Status</p>
              {status.enabled ? <p className="text-xs text-muted">Aktif sejak {formatDateTime(status.enabledAt)} · {status.recoveryRemaining} kode pemulihan tersisa</p> : <p className="text-xs text-muted">Belum diaktifkan</p>}
            </div>
            {status.enabled ? <Badge tone="green">Aktif</Badge> : <Badge>Nonaktif</Badge>}
          </div>
          {!status.enabled && <Button variant="primary" className="w-full" disabled={!status.available} onClick={() => reset("setup")}>Aktifkan 2FA</Button>}
          {status.enabled && (
            <div className="flex flex-col gap-2">
              <Button onClick={() => reset("regen")}>Buat ulang kode pemulihan</Button>
              {status.required ? <p className="text-xs text-muted">Peran Anda diwajibkan memakai 2FA, sehingga tidak dapat dimatikan.</p> : <Button variant="danger" onClick={() => reset("disable")}>Nonaktifkan 2FA</Button>}
            </div>
          )}
        </>
      )}

      {mode === "setup" && !setup && (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(async () => setSetup(await api<TwoFactorSetup>("/api/account/2fa/setup", { body: { password } }))); }}>
          <p className="text-sm text-ink-soft">Konfirmasi password Anda untuk memulai.</p>
          <PasswordField label="Password" autoComplete="current-password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} error={fe.password} />
          <div className="flex gap-2"><Button type="submit" variant="primary" loading={busy} className="flex-1">Lanjut</Button><Button type="button" onClick={() => reset()} disabled={busy}>Batal</Button></div>
        </form>
      )}

      {mode === "setup" && setup && (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(async () => { const r = await api<{ recoveryCodes: string[] }>("/api/account/2fa/enable", { body: { code } }); setCodes(r.recoveryCodes); await refresh(); reset(); }); }}>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">
            <li>Buka aplikasi autentikator → <em>Tambah akun</em> → pindai kode QR ini.</li>
            <li>Masukkan kode 6 digit yang muncul di aplikasi.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qrDataUrl} alt="Kode QR untuk aplikasi autentikator" width={220} height={220} className="mx-auto rounded-lg border border-line bg-white p-2" data-testid="totp-qr" />
          <div>
            <p className="text-xs text-muted">Tidak bisa memindai? Masukkan kunci ini secara manual:</p>
            <code className="mt-1 block break-all rounded bg-canvas px-2 py-1.5 text-center font-mono text-sm tracking-wider text-ink" data-testid="totp-secret">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</code>
          </div>
          <TextField label="Kode 6 digit" inputMode="numeric" autoComplete="one-time-code" required autoFocus maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} error={fe.code} />
          <div className="flex gap-2"><Button type="submit" variant="primary" loading={busy} className="flex-1">Aktifkan</Button><Button type="button" onClick={() => reset()} disabled={busy}>Batal</Button></div>
        </form>
      )}

      {(mode === "disable" || mode === "regen") && (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(async () => {
          if (mode === "disable") { await api("/api/account/2fa/disable", { body: { password, code } }); reset(); await refresh(); router.refresh(); }
          else { const r = await api<{ recoveryCodes: string[] }>("/api/account/2fa/recovery", { body: { password, code } }); setCodes(r.recoveryCodes); reset(); await refresh(); }
        }); }}>
          <p className="text-sm text-ink-soft">{mode === "disable" ? "Mematikan 2FA menurunkan keamanan akun. Konfirmasi dengan password dan kode dari autentikator." : "Kode pemulihan lama akan hangus. Konfirmasi dengan password dan kode dari autentikator."}</p>
          <PasswordField label="Password" autoComplete="current-password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} error={fe.password} />
          <TextField label="Kode 6 digit (atau kode pemulihan)" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} error={fe.code} />
          <div className="flex gap-2"><Button type="submit" variant={mode === "disable" ? "danger" : "primary"} loading={busy} className="flex-1">{mode === "disable" ? "Nonaktifkan" : "Buat ulang"}</Button><Button type="button" onClick={() => reset()} disabled={busy}>Batal</Button></div>
        </form>
      )}

      {!forced && mode === "idle" && <Link href="/" className="block text-center text-sm text-muted hover:underline">← Kembali ke aplikasi</Link>}
      {forced && mode === "idle" && <p className="text-center text-xs text-muted">Salah akun? <button type="button" className="underline" onClick={() => void api("/api/auth/logout", { body: {} }).finally(() => { router.replace("/login"); router.refresh(); })}>Keluar</button></p>}
    </section>
  );
}
