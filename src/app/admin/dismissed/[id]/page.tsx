import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import AdminDismissedClient from "@/components/AdminDismissedClient";
import { db } from "@/db";
import { peerReview, project, user } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AdminDismissedDetailPage(props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession({ disableCookieCache: true });
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/dismissed");
  if (role !== "admin") redirect("/projects");

  const { id } = await props.params;

  const blockedBy = alias(user, "blockedBy");

  const rows = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      resubmissionBlocked: project.resubmissionBlocked,
      resubmissionBlockedAt: project.resubmissionBlockedAt,
      resubmissionBlockedBy: project.resubmissionBlockedBy,
      submittedAt: project.submittedAt,
      createdAt: project.createdAt,
      creatorId: project.creatorId,
      creatorName: user.name,
      creatorEmail: user.email,
      blockedByName: blockedBy.name,
      blockedByEmail: blockedBy.email,
    })
    .from(project)
    .leftJoin(user, eq(project.creatorId, user.id))
    .leftJoin(blockedBy, eq(project.resubmissionBlockedBy, blockedBy.id))
    .where(eq(project.id, id))
    .limit(1);

  const p = rows[0];
  if (!p) notFound();

  const latestRejection = await db
    .select({
      id: peerReview.id,
      reviewComment: peerReview.reviewComment,
      createdAt: peerReview.createdAt,
      reviewerName: user.name,
      reviewerEmail: user.email,
    })
    .from(peerReview)
    .leftJoin(user, eq(peerReview.reviewerId, user.id))
    .where(and(eq(peerReview.projectId, p.id), eq(peerReview.decision, "rejected")))
    .orderBy(desc(peerReview.createdAt))
    .limit(1);

  const mostRecentRejection = latestRejection[0] ?? null;

  return (
    <AppShell title="Dismissed project">
      <div className="mb-6">
        <Link
          href="/admin/dismissed"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to dismissed projects
        </Link>
      </div>

      <AdminDismissedClient
        initial={{
          project: {
            id: p.id,
            name: p.name,
            description: p.description,
            status: p.status,
            resubmissionBlocked: p.resubmissionBlocked,
            resubmissionBlockedAt: p.resubmissionBlockedAt
              ? p.resubmissionBlockedAt.toISOString()
              : null,
            submittedAt: p.submittedAt ? p.submittedAt.toISOString() : null,
            createdAt: p.createdAt.toISOString(),
          },
          creator: {
            id: p.creatorId || "",
            name: p.creatorName || "Unknown creator",
            email: p.creatorEmail || "",
          },
          dismissedBy:
            p.resubmissionBlockedBy && (p.blockedByName || p.blockedByEmail)
              ? {
                  id: p.resubmissionBlockedBy,
                  name: p.blockedByName || "Unknown admin",
                  email: p.blockedByEmail || "",
                }
              : null,
          latestRejection: mostRecentRejection
            ? {
                id: mostRecentRejection.id,
                reviewComment: mostRecentRejection.reviewComment,
                createdAt: mostRecentRejection.createdAt.toISOString(),
                reviewerName: mostRecentRejection.reviewerName || "Unknown reviewer",
                reviewerEmail: mostRecentRejection.reviewerEmail || "",
              }
            : null,
        }}
      />
    </AppShell>
  );
}
