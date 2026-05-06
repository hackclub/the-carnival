import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import DevlogDetailClient from "@/components/DevlogDetailClient";
import { db } from "@/db";
import { devlog, project, user } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

function canView(role: unknown, isCreator: boolean) {
  if (isCreator) return true;
  return role === "reviewer" || role === "admin";
}

export default async function DevlogDetailPage(props: {
  params: Promise<{ id: string; devlogId: string }>;
}) {
  const session = await getServerSession({ disableCookieCache: true });
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/projects`);
  }

  const { id, devlogId } = await props.params;
  const role = (session.user as { role?: unknown } | undefined)?.role;

  const rows = await db
    .select({
      id: devlog.id,
      projectId: devlog.projectId,
      userId: devlog.userId,
      title: devlog.title,
      content: devlog.content,
      startedAt: devlog.startedAt,
      endedAt: devlog.endedAt,
      durationSeconds: devlog.durationSeconds,
      attachments: devlog.attachments,
      usedAi: devlog.usedAi,
      aiUsageDescription: devlog.aiUsageDescription,
      hackatimeProjectNameSnapshot: devlog.hackatimeProjectNameSnapshot,
      createdAt: devlog.createdAt,
      updatedAt: devlog.updatedAt,
      authorName: user.name,
      projectName: project.name,
      projectCreatorId: project.creatorId,
      projectStatus: project.status,
      projectSubmittedAt: project.submittedAt,
    })
    .from(devlog)
    .leftJoin(user, eq(devlog.userId, user.id))
    .leftJoin(project, eq(devlog.projectId, project.id))
    .where(and(eq(devlog.id, devlogId), eq(devlog.projectId, id)))
    .limit(1);

  const row = rows[0];
  if (!row) notFound();

  const isCreator = row.projectCreatorId === session.user.id;
  const isAuthor = row.userId === session.user.id;
  if (!canView(role, isCreator)) notFound();

  const projectEditable = row.projectStatus === "work-in-progress";
  const canEdit = isAuthor && projectEditable;
  const canDelete = canEdit || role === "admin";

  return (
    <AppShell title={row.title}>
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href={`/projects/${id}/devlogs`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to devlogs
        </Link>
        <Link
          href={`/projects/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          View project
        </Link>
      </div>

      <DevlogDetailClient
        projectId={id}
        projectName={row.projectName || "Project"}
        devlog={{
          id: row.id,
          title: row.title,
          content: row.content,
          startedAt: row.startedAt.toISOString(),
          endedAt: row.endedAt.toISOString(),
          durationSeconds: row.durationSeconds,
          attachments: row.attachments ?? [],
          usedAi: row.usedAi,
          aiUsageDescription: row.aiUsageDescription ?? null,
          hackatimeProjectNameSnapshot: row.hackatimeProjectNameSnapshot ?? "",
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          authorName: row.authorName || "Unknown",
        }}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </AppShell>
  );
}
