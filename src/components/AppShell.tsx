import AppSidebar from "@/components/AppSidebar";
import DashboardTopBar from "@/components/DashboardTopBar";
import { SidebarProvider } from "@/components/SidebarContext";
import { PlatformContent, PlatformShell } from "@/components/ui/platform";
import { db } from "@/db";
import { getAdminIndicatorCounts } from "@/lib/admin-indicators";
import { getServerSession } from "@/lib/server-session";
import { getTokenBalance } from "@/lib/wallet";

type SafeShellUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string | null;
};

function toSafeShellUser(value: unknown): SafeShellUser | null {
  if (!value || typeof value !== "object") return null;
  const row = value as {
    id?: unknown;
    name?: unknown;
    email?: unknown;
    image?: unknown;
    role?: unknown;
  };
  if (typeof row.id !== "string" || !row.id.trim()) return null;
  return {
    id: row.id,
    name: typeof row.name === "string" ? row.name : null,
    email: typeof row.email === "string" ? row.email : null,
    image: typeof row.image === "string" ? row.image : null,
    role: typeof row.role === "string" ? row.role : null,
  };
}

export default async function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const session = await getServerSession({ disableCookieCache: true });
  const shellUser = toSafeShellUser(session?.user ?? null);
  const [walletBalance, adminIndicators] = await Promise.all([
    shellUser ? getTokenBalance(db, shellUser.id) : null,
    shellUser?.role === "admin" ? getAdminIndicatorCounts(db) : null,
  ]);
  const walletFetchedAt = new Date().toISOString();

  return (
    <PlatformShell>
      <SidebarProvider>
        <div className="flex min-h-screen">
          <AppSidebar
            user={shellUser}
            initialWalletBalance={walletBalance}
            walletFetchedAt={walletFetchedAt}
            adminIndicators={adminIndicators}
          />

          <main className="flex-1 min-w-0">
            <DashboardTopBar title={title} />

            <PlatformContent className="pt-6 md:pt-8">
              {children}
            </PlatformContent>
          </main>
        </div>
      </SidebarProvider>
    </PlatformShell>
  );
}
