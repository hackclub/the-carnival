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
      <div className="bg-card border border-border rounded-2xl p-8">
        <div className="text-foreground font-semibold text-lg">Coming soon</div>
        <div className="text-muted-foreground mt-1">
          This will become the place to browse other projects and ideas.
        </div>
      </div>
    </AppShell>
  );
}


