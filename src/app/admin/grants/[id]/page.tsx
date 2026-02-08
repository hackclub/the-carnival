import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import AdminGrantClient from "@/components/AdminGrantClient";
import { db } from "@/db";
import { peerReview, project, user } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";
import { fetchHackatimeUserIdAndProjectHoursByName } from "@/lib/hackatime";

export default async function AdminGrantDetailPage(props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession({ disableCookieCache: true });
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/grants");
  if (role !== "admin") redirect("/projects");

  const { id } = await props.params;

  const rows = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      editor: project.editor,
      editorOther: project.editorOther,
      hackatimeProjectName: project.hackatimeProjectName,
      videoUrl: project.videoUrl,
      playableDemoUrl: project.playableDemoUrl,
      codeUrl: project.codeUrl,
      screenshots: project.screenshots,
      status: project.status,
      approvedHours: project.approvedHours,
      createdAt: project.createdAt,
      submittedAt: project.submittedAt,
      updatedAt: project.updatedAt,
      creatorId: project.creatorId,
      creatorName: user.name,
      creatorEmail: user.email,
      creatorSlackId: user.slackId,
      creatorVerificationStatus: user.verificationStatus,
    })
    .from(project)
    .leftJoin(user, eq(project.creatorId, user.id))
    .where(eq(project.id, id))
    .limit(1);

  const p = rows[0];
  if (!p) notFound();

  const reviews = await db
    .select({
      id: peerReview.id,
      decision: peerReview.decision,
      reviewComment: peerReview.reviewComment,
      approvedHours: peerReview.approvedHours,
      createdAt: peerReview.createdAt,
      reviewerName: user.name,
      reviewerEmail: user.email,
    })
    .from(peerReview)
    .leftJoin(user, eq(peerReview.reviewerId, user.id))
    .where(eq(peerReview.projectId, p.id))
    .orderBy(desc(peerReview.createdAt));

  const hackatimeLookupId = typeof p.creatorSlackId === "string" ? p.creatorSlackId.trim() : "";
  const hackatimeStats =
    hackatimeLookupId
      ? await fetchHackatimeUserIdAndProjectHoursByName(hackatimeLookupId)
      : {
          userId: null as string | null,
          hoursByName: {} as Record<string, { hours: number; minutes: number }>,
        };

  const hackatimeHours =
    hackatimeStats.hoursByName[p.hackatimeProjectName] ??
    hackatimeStats.hoursByName[p.name] ??
    null;

  return (
    <AppShell title="Grant project">
      <div className="mb-6">
        <Link href="/admin/grants" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to grants
        </Link>
      </div>

      <AdminGrantClient
        initial={{
          project: {
            id: p.id,
            name: p.name,
            description: p.description,
            editor: p.editor,
            editorOther: p.editorOther ?? "",
            hackatimeProjectName: p.hackatimeProjectName,
            videoUrl: p.videoUrl,
            playableDemoUrl: p.playableDemoUrl,
            codeUrl: p.codeUrl,
            screenshots: p.screenshots,
            status: p.status,
            approvedHours: p.approvedHours ?? null,
            createdAt: p.createdAt.toISOString(),
            submittedAt: p.submittedAt ? p.submittedAt.toISOString() : null,
            hackatimeUserId: hackatimeStats.userId,
            hackatimeHours: hackatimeHours ? { hours: hackatimeHours.hours, minutes: hackatimeHours.minutes } : null,
          },
          creator: {
            id: p.creatorId || "",
            name: p.creatorName || "Unknown",
            email: p.creatorEmail || "",
            slackId: p.creatorSlackId || "",
            verificationStatus: p.creatorVerificationStatus || "",
          },
          reviews: reviews.map((r) => ({
            id: r.id,
            decision: r.decision,
            reviewComment: r.reviewComment,
            approvedHours: r.approvedHours ?? null,
            createdAt: r.createdAt.toISOString(),
            reviewerName: r.reviewerName || "Unknown reviewer",
            reviewerEmail: r.reviewerEmail || "",
          })),
        }}
      />
    </AppShell>
  );
}


