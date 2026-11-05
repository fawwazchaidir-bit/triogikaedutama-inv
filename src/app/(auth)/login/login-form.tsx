"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Langkah 2 (hanya akun ber-2FA): tantangan dari server + kode dari aplikasi autentikator / kode pemulihan.
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");

  type LoginUser = { mustChangePassword: boolean; mfaSetupRequired?: boolean };
  function done(user: LoginUser, recoveryRemaining?: number | null) {
    const lowRecovery = typeof recoveryRemaining === "number" && recoveryRemaining <= 2;
    router.replace(user.mustChangePassword ? "/change-password" : user.mfaSetupRequired || lowRecovery ? `/security${lowRecovery ? "?recovery=low" : ""}` : "/");
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (challenge) {
        const res = await api<{ user: LoginUser; recoveryRemaining: number | null }>("/api/auth/2fa", { body: { challenge, code } });
        done(res.user, res.recoveryRemaining);
        return;
      }
      const res = await api<{ user?: LoginUser; requiresTwoFactor?: boolean; challenge?: string }>("/api/auth/login", { body: { email, password } });
      if (res.requiresTwoFactor && res.challenge) {
        setChallenge(res.challenge);
        setPassword("");
        setLoading(false);
        return;
      }
      done(res.user!);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Gagal masuk. Coba lagi.";
      setError(msg);
      // Tantangan habis/terpakai → kembali ke langkah 1 agar pengguna tidak terjebak.
      if (challenge && err instanceof ApiClientError && /berakhir/i.test(err.message)) { setChallenge(null); setCode(""); }
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-xl border border-line bg-surface p-8 shadow-sm" aria-label="Form masuk">
      <div className="flex flex-col items-center gap-3 text-center">
        <Image src="/brand/logo.png" alt="Trilogika Edutama" width={72} height={72} priority unoptimized />
        <div>
          <h1 className="text-xl font-semibold text-ink">Trilogika Edutama</h1>
          <p className="text-sm text-muted">Financial Management System</p>
        </div>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {challenge ? (
        <>
          <p className="text-sm text-ink-soft">Masukkan kode 6 digit dari aplikasi autentikator Anda, atau salah satu kode pemulihan.</p>
          <TextField label="Kode verifikasi" name="code" autoComplete="one-time-code" inputMode="text" required autoFocus value={code} onChange={(e) => setCode(e.target.value)} hint="Contoh: 123456 atau XXXXX-XXXXX" />
          <Button type="submit" variant="primary" loading={loading} className="w-full">Verifikasi</Button>
          <button type="button" onClick={() => { setChallenge(null); setCode(""); setError(null); }} className="w-full text-center text-sm text-muted hover:underline">Kembali</button>
        </>
      ) : (
        <>
          <TextField label="Email" type="email" name="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          <PasswordField label="Password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" variant="primary" loading={loading} className="w-full">Masuk</Button>
        </>
      )}
    </form>
  );
}
