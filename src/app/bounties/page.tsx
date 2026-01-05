import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getServerSession } from "@/lib/server-session";

export default async function BountiesPage() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/bounties");
  }

  return (
    <AppShell title="Bounties">
      <div className="bg-card border border-border rounded-2xl p-8">
        <div className="text-foreground font-semibold text-lg">Coming soon</div>
        <div className="text-muted-foreground mt-1">
          This is where bounties will live. For now, head to “My projects” to
          see your work.
        </div>
      </div>
    </AppShell>
  );
}


