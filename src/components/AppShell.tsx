import Header from "@/components/Header";
import AppSidebar from "@/components/AppSidebar";
import { unstable_noStore as noStore } from "next/cache";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { getTokenBalance } from "@/lib/wallet";
import { PlatformContent, PlatformPageHeading, PlatformShell } from "@/components/ui/platform";

export default async function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  // Prevent Next from trying to prerender/cache DB-backed pages during `next build`
  // (important for Docker builds where the DB isn't reachable).
  noStore();

  const session = await getServerSession({ disableCookieCache: true });
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const initialWalletBalance = userId ? await getTokenBalance(db, userId) : null;

  return (
    <PlatformShell>
      <div className="flex flex-col md:flex-row min-h-screen">
        <AppSidebar />

        <main className="flex-1">
          <div className="px-4 pt-4 md:px-6 md:pt-5">
            <div className="max-w-6xl mx-auto platform-topbar-surface">
              <Header showSectionLinks={false} initialWalletBalance={initialWalletBalance} />
            </div>
          </div>

          <PlatformContent>
            <PlatformPageHeading title={title} />

            {children}
          </PlatformContent>
        </main>
      </div>
    </PlatformShell>
  );
}

