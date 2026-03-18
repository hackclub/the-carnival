import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import AdminGrantClient from "@/components/AdminGrantClient";
import { db } from "@/db";
import { peerReview, project, user } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

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
      hackatimeStartedAt: project.hackatimeStartedAt,
      hackatimeStoppedAt: project.hackatimeStoppedAt,
      hackatimeTotalSeconds: project.hackatimeTotalSeconds,
      videoUrl: project.videoUrl,
      playableDemoUrl: project.playableDemoUrl,
      codeUrl: project.codeUrl,
      screenshots: project.screenshots,
      submissionChecklist: project.submissionChecklist,
      status: project.status,
      approvedHours: project.approvedHours,
      createdAt: project.createdAt,
      submittedAt: project.submittedAt,
      updatedAt: project.updatedAt,
      creatorId: project.creatorId,
      creatorName: user.name,
      creatorEmail: user.email,
      creatorHackatimeUserId: user.hackatimeUserId,
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

  const totalSeconds =
    typeof p.hackatimeTotalSeconds === "number" && Number.isFinite(p.hackatimeTotalSeconds)
      ? Math.max(0, Math.floor(p.hackatimeTotalSeconds))
      : 0;
  const hackatimeHours = { hours: Math.floor(totalSeconds / 3600), minutes: Math.floor(totalSeconds / 60) % 60 };

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
            submissionChecklist: p.submissionChecklist ?? null,
            status: p.status,
            approvedHours: p.approvedHours ?? null,
            createdAt: p.createdAt.toISOString(),
            submittedAt: p.submittedAt ? p.submittedAt.toISOString() : null,
            hackatimeUserId:
              typeof p.creatorHackatimeUserId === "string" ? p.creatorHackatimeUserId : null,
            hackatimeHours: hackatimeHours ? { hours: hackatimeHours.hours, minutes: hackatimeHours.minutes } : null,
            hackatimeStartedAt: p.hackatimeStartedAt ? p.hackatimeStartedAt.toISOString() : null,
            hackatimeStoppedAt: p.hackatimeStoppedAt ? p.hackatimeStoppedAt.toISOString() : null,
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

