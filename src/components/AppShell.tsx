import Header from "@/components/Header";
import AppSidebar from "@/components/AppSidebar";
import { unstable_noStore as noStore } from "next/cache";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { getTokenBalance } from "@/lib/wallet";

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
    <div className="min-h-screen bg-background">
      <div className="flex flex-col md:flex-row min-h-screen">
        <AppSidebar />

        <main className="flex-1">
          <Header showSectionLinks={false} initialWalletBalance={initialWalletBalance} />

          <div className="px-6 md:px-10 pb-20">
            <div className="max-w-6xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                  {title}
                </h1>
              </div>

              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}


