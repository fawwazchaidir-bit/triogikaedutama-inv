import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="fixed right-4 top-4"><ThemeToggle onDark={false} /></div>
      <LoginForm />
    </div>
  );
}
