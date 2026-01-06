import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { bountyClaim, bountyProject } from "@/db/schema";
import { desc } from "drizzle-orm";
import BountiesClient, { type BountyListItem } from "@/components/BountiesClient";

export default async function BountiesPage() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/bounties");
  }

  const role = (session.user as { role?: unknown } | undefined)?.role;
  const isAdmin = role === "admin";

  const projects = await db
    .select({
      id: bountyProject.id,
      name: bountyProject.name,
      description: bountyProject.description,
      prizeUsd: bountyProject.prizeUsd,
      createdAt: bountyProject.createdAt,
    })
    .from(bountyProject)
    .orderBy(desc(bountyProject.createdAt));

  const claims = await db
    .select({
      bountyProjectId: bountyClaim.bountyProjectId,
      userId: bountyClaim.userId,
    })
    .from(bountyClaim);

  const claimsByProject = new Map<string, Set<string>>();
  for (const c of claims) {
    const set = claimsByProject.get(c.bountyProjectId) ?? new Set<string>();
    set.add(c.userId);
    claimsByProject.set(c.bountyProjectId, set);
  }

  const initial: BountyListItem[] = projects.map((p) => {
    const set = claimsByProject.get(p.id) ?? new Set<string>();
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      prizeUsd: p.prizeUsd,
      claimedCount: set.size,
      claimedByMe: set.has(session.user.id),
    };
  });

  return (
    <AppShell title="Bounties">
      <BountiesClient initial={initial} isAdmin={isAdmin} />
    </AppShell>
  );
}


