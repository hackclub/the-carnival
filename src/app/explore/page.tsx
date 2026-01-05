import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getServerSession } from "@/lib/server-session";

export default async function ExplorePage() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/explore");
  }

  return (
    <AppShell title="Explore">
      <div className="bg-carnival-card/70 border border-white/10 rounded-2xl p-8">
        <div className="text-white font-semibold text-lg">Coming soon</div>
        <div className="text-gray-400 mt-1">
          This will become the place to browse other projects and ideas.
        </div>
      </div>
    </AppShell>
  );
}


