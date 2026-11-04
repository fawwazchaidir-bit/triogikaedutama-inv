import { requirePageUser } from "@/server/auth/current";
import { getBrand } from "@/server/services/settings";
import { getNotifications } from "@/server/services/notifications";
import { visibleNav } from "@/lib/permissions";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const [brand, notifications] = await Promise.all([getBrand(), getNotifications(user)]);
  const nav = visibleNav(user.role).map(({ href, label }) => ({ href, label }));
  return (
    <AppShell user={{ name: user.name, email: user.email, role: user.role }} nav={nav} company={brand} notifications={notifications}>
      {children}
    </AppShell>
  );
}
