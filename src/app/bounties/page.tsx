import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { bountyClaim, bountyProject, user } from "@/db/schema";
import { desc, eq, or } from "drizzle-orm";
import BountiesClient, { type BountyListItem } from "@/components/BountiesClient";

function toHelpfulLinks(value: unknown): BountyListItem["helpfulLinks"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const label = typeof (item as { label?: unknown }).label === "string" ? (item as { label: string }).label.trim() : "";
      const url = typeof (item as { url?: unknown }).url === "string" ? (item as { url: string }).url.trim() : "";
      if (!label || !url) return null;
      return { label, url };
    })
    .filter((item): item is BountyListItem["helpfulLinks"][number] => Boolean(item));
}

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
      status: bountyProject.status,
      previewImageUrl: bountyProject.previewImageUrl,
      requirements: bountyProject.requirements,
      examples: bountyProject.examples,
      helpfulLinks: bountyProject.helpfulLinks,
      completed: bountyProject.completed,
      createdById: bountyProject.createdById,
      authorName: user.name,
      reviewedById: bountyProject.reviewedById,
      reviewedAt: bountyProject.reviewedAt,
      rejectionReason: bountyProject.rejectionReason,
      createdAt: bountyProject.createdAt,
    })
    .from(bountyProject)
    .leftJoin(user, eq(bountyProject.createdById, user.id))
    .where(isAdmin ? undefined : or(eq(bountyProject.status, "approved"), eq(bountyProject.createdById, session.user.id)))
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
      status: p.status,
      prizeUsd: p.prizeUsd,
      previewImageUrl: p.previewImageUrl ?? null,
      requirements: p.requirements ?? "",
      examples: p.examples ?? "",
      helpfulLinks: toHelpfulLinks(p.helpfulLinks),
      claimedCount: set.size,
      claimedByMe: set.has(session.user.id),
      completed: p.completed,
      createdById: p.createdById ?? null,
      authorName: p.authorName ?? null,
      reviewedById: p.reviewedById ?? null,
      reviewedAt: p.reviewedAt ? p.reviewedAt.toISOString() : null,
      rejectionReason: p.rejectionReason ?? null,
      createdAt: p.createdAt.toISOString(),
    };
  });

  return (
    <AppShell title="Bounties">
      <BountiesClient initial={initial} isAdmin={isAdmin} />
    </AppShell>
  );
}
