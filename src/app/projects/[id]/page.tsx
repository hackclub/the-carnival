import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import ManageProjectClient from "@/components/ManageProjectClient";
import { db } from "@/db";
import { peerReview, project, user } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

export default async function ManageProjectPage(props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession({ disableCookieCache: true });
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/projects`);
  }

  const { id } = await props.params;

  const rows = await db
    .select({
      id: project.id,
      creatorId: project.creatorId,
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
    })
    .from(project)
    .where(and(eq(project.id, id), eq(project.creatorId, session.user.id)))
    .limit(1);

  const p = rows[0];
  if (!p) notFound();

  const reviews = await db
    .select({
      id: peerReview.id,
      decision: peerReview.decision,
      reviewComment: peerReview.reviewComment,
      createdAt: peerReview.createdAt,
      reviewerName: user.name,
      reviewerEmail: user.email,
    })
    .from(peerReview)
    .leftJoin(user, eq(peerReview.reviewerId, user.id))
    .where(eq(peerReview.projectId, id))
    .orderBy(desc(peerReview.createdAt));

  return (
    <AppShell title="Manage project">
      <div className="mb-6">
        <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to projects
        </Link>
      </div>

      <ManageProjectClient
        initial={{
          id: p.id,
          name: p.name,
          description: p.description,
          editor: p.editor,
          editorOther: p.editorOther ?? "",
          hackatimeProjectName: p.hackatimeProjectName,
          hackatimeStartedAt: p.hackatimeStartedAt ? p.hackatimeStartedAt.toISOString() : null,
          hackatimeStoppedAt: p.hackatimeStoppedAt ? p.hackatimeStoppedAt.toISOString() : null,
          hackatimeTotalSeconds: p.hackatimeTotalSeconds ?? null,
          videoUrl: p.videoUrl,
          playableDemoUrl: p.playableDemoUrl,
          codeUrl: p.codeUrl,
          screenshots: p.screenshots,
          submissionChecklist: p.submissionChecklist ?? null,
          status: p.status,
          approvedHours: p.approvedHours ?? null,
          reviews: reviews.map((r) => ({
            id: r.id,
            decision: r.decision,
            reviewComment: r.reviewComment,
            createdAt: r.createdAt.toISOString(),
            reviewerName: r.reviewerName || "Unknown reviewer",
            reviewerEmail: r.reviewerEmail || "",
          })),
        }}
      />
    </AppShell>
  );
}

