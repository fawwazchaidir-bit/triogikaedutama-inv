import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Ganti Password" };

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="fixed right-4 top-4"><ThemeToggle onDark={false} /></div>
      <ChangePasswordForm forced={user.mustChangePassword} />
    </div>
  );
}
