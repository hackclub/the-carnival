import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import DevlogViewActions from "@/components/DevlogViewActions";
import { Card, CardContent } from "@/components/ui";
import { db } from "@/db";
import { devlog, project, user, type UserRole } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

function formatDateTime(d: Date) {
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function canView(role: unknown, isCreator: boolean) {
  if (isCreator) return true;
  return role === "reviewer" || role === "admin";
}

export default async function ViewDevlogPage(props: {
  params: Promise<{ id: string; devlogId: string }>;
}) {
  const session = await getServerSession({ disableCookieCache: true });
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/projects`);
  }

  const { id, devlogId } = await props.params;

  const rows = await db
    .select({
      id: devlog.id,
      title: devlog.title,
      content: devlog.content,
      createdAt: devlog.createdAt,
      updatedAt: devlog.updatedAt,
      authorId: devlog.userId,
      authorName: user.name,
      projectName: project.name,
      projectCreatorId: project.creatorId,
    })
    .from(devlog)
    .leftJoin(user, eq(devlog.userId, user.id))
    .leftJoin(project, eq(devlog.projectId, project.id))
    .where(and(eq(devlog.id, devlogId), eq(devlog.projectId, id)))
    .limit(1);

  const row = rows[0];
  if (!row) notFound();

  const role = (session.user as { role?: UserRole } | undefined)?.role;
  const isCreator = row.projectCreatorId === session.user.id;
  if (!canView(role, isCreator)) {
    redirect(`/projects/${id}`);
  }

  const isAuthor = row.authorId === session.user.id;
  const isAdmin = role === "admin";
  const canEdit = isAuthor;
  const canDelete = isAuthor || isAdmin;

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
          {row.projectName ? `View ${row.projectName}` : "View project"}
        </Link>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{row.authorName || "Unknown"}</span>
            <span>·</span>
            <span>Posted {formatDateTime(row.createdAt)}</span>
            {row.updatedAt.getTime() !== row.createdAt.getTime() ? (
              <>
                <span>·</span>
                <span>Edited {formatDateTime(row.updatedAt)}</span>
              </>
            ) : null}
          </div>

          <h1 className="mb-4 text-2xl font-bold">{row.title}</h1>

          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {row.content}
          </div>

          {canEdit || canDelete ? (
            <div className="mt-6 border-t border-border pt-4">
              <DevlogViewActions
                projectId={id}
                devlogId={devlogId}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </AppShell>
  );
}
