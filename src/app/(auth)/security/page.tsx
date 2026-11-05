import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current";
import { getTwoFactorStatus } from "@/server/services/two-factor";
import { ThemeToggle } from "@/components/theme-toggle";
import { SecurityPanel } from "./security-panel";

export const metadata: Metadata = { title: "Keamanan Akun" };
export const dynamic = "force-dynamic";

/** Di luar kerangka aplikasi (grup `(auth)`) agar tetap dapat dibuka saat peran WAJIB 2FA dan belum mengaktifkannya. */
export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ recovery?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  const sp = await searchParams;
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="fixed right-4 top-4"><ThemeToggle onDark={false} /></div>
      <SecurityPanel initial={await getTwoFactorStatus(user)} email={user.email} forced={user.mfaEnrollmentRequired} lowRecovery={sp.recovery === "low"} />
    </div>
  );
}
