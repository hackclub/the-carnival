import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import ReviewProjectClient from "@/components/ReviewProjectClient";
import { db } from "@/db";
import { peerReview, project, user, type ReviewDecision, type UserRole } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

function canReview(role: unknown): role is Extract<UserRole, "reviewer" | "admin"> {
  return role === "reviewer" || role === "admin";
}

export default async function ReviewProjectPage(props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession({ disableCookieCache: true });
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/review`);
  }

  const role = (session.user as { role?: unknown } | undefined)?.role;
  if (!canReview(role)) {
    redirect("/projects");
  }
  const isAdmin = role === "admin";

  const { id } = await props.params;

  const projectRows = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      editor: project.editor,
      editorOther: project.editorOther,
      hackatimeProjectName: project.hackatimeProjectName,
      playableUrl: project.playableUrl,
      codeUrl: project.codeUrl,
      screenshots: project.screenshots,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      creatorId: project.creatorId,
      creatorName: user.name,
      creatorEmail: user.email,
    })
    .from(project)
    .leftJoin(user, eq(project.creatorId, user.id))
    .where(eq(project.id, id))
    .limit(1);

  const p = projectRows[0];
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
    <AppShell title="Review project">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/review" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to review queue
        </Link>
        <Link href={`/projects/${p.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          View in projects
        </Link>
      </div>

      <ReviewProjectClient
        initial={{
          isAdmin,
          project: {
            id: p.id,
            name: p.name,
            description: p.description,
            editor: p.editor,
            editorOther: p.editorOther ?? "",
            hackatimeProjectName: p.hackatimeProjectName,
            playableUrl: p.playableUrl,
            codeUrl: p.codeUrl,
            screenshots: p.screenshots,
            status: p.status,
            creatorName: p.creatorName || "Unknown creator",
            creatorEmail: p.creatorEmail || "",
          },
          reviews: reviews.map((r) => ({
            id: r.id,
            decision: r.decision as ReviewDecision,
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


