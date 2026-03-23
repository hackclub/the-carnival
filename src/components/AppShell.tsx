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
    <div className="relative min-h-screen overflow-x-clip text-[#5b1f0a]">
      <div className="carnival-paper-grid pointer-events-none fixed inset-0 -z-20 opacity-[0.12]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-20 h-[340px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.38)_0%,_transparent_70%)]" />

      <div className="mx-auto flex min-h-screen w-full max-w-[1700px] flex-col px-3 pb-8 pt-4 sm:px-4 lg:px-6 lg:pt-6">
        <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-start">
        <AppSidebar />

        <main className="min-w-0 flex-1">
          <Header showSectionLinks={false} initialWalletBalance={initialWalletBalance} />

          <div className="mt-4 rounded-[2rem] border-[4px] border-[#74210a] bg-[#fff7dc]/95 px-4 py-5 shadow-[0_8px_0_#d78b22,0_18px_34px_rgba(120,53,15,0.14)] sm:px-6 sm:py-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
              <div className="mb-6 rounded-[1.5rem] border-[3px] border-[#74210a]/75 bg-[#ffe2b0] px-4 py-4 shadow-[0_5px_0_#d78b22] sm:mb-8 sm:px-5">
                <h1 className="text-2xl font-black uppercase tracking-[0.06em] text-[#5b1f0a] [text-wrap:balance] sm:text-3xl lg:text-4xl">
                  {title}
                </h1>
              </div>

              {children}
            </div>
          </div>
        </main>
      </div>
      </div>
    </div>
  );
}

