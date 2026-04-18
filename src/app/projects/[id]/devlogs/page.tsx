import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import { Badge, Button, Card, CardContent, EmptyState } from "@/components/ui";
import { db } from "@/db";
import { devlog, project, user, type UserRole } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function canView(role: unknown, isCreator: boolean) {
  if (isCreator) return true;
  return role === "reviewer" || role === "admin";
}

function excerpt(content: string, max = 240) {
  if (content.length <= max) return content;
  return `${content.slice(0, max).trimEnd()}…`;
}

export default async function ProjectDevlogsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession({ disableCookieCache: true });
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/projects`);
  }

  const { id } = await props.params;

  const projectRows = await db
    .select({
      id: project.id,
      name: project.name,
      creatorId: project.creatorId,
      status: project.status,
      startedOnCarnivalAt: project.startedOnCarnivalAt,
      submittedAt: project.submittedAt,
      createdAt: project.createdAt,
    })
    .from(project)
    .where(eq(project.id, id))
    .limit(1);

  const p = projectRows[0];
  if (!p) notFound();

  const role = (session.user as { role?: UserRole } | undefined)?.role;
  const isCreator = p.creatorId === session.user.id;
  if (!canView(role, isCreator)) {
    redirect(`/projects/${id}`);
  }

  const rows = await db
    .select({
      id: devlog.id,
      title: devlog.title,
      content: devlog.content,
      createdAt: devlog.createdAt,
      authorName: user.name,
    })
    .from(devlog)
    .leftJoin(user, eq(devlog.userId, user.id))
    .where(eq(devlog.projectId, id))
    .orderBy(desc(devlog.createdAt), asc(devlog.id));

  const projectStartedAt = p.startedOnCarnivalAt ?? p.createdAt;

  return (
    <AppShell title={`Devlogs · ${p.name}`}>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/projects/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to project
        </Link>
        {isCreator && p.status !== "granted" ? (
          <Link href={`/projects/${id}/devlogs/new`}>
            <Button variant="primary">Write a devlog</Button>
          </Link>
        ) : null}
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Devlogs document progress on <strong className="text-foreground">{p.name}</strong>. Only
          time logged on Hackatime between{" "}
          <strong className="text-foreground">{formatDate(projectStartedAt)}</strong>
          {p.submittedAt ? (
            <>
              {" "}
              and <strong className="text-foreground">{formatDate(p.submittedAt)}</strong>
            </>
          ) : (
            <> and submission</>
          )}{" "}
          counts during review. Use devlogs to justify what you did with that time.
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="No devlogs yet"
          description={
            isCreator
              ? "Write your first devlog to document your progress."
              : "This creator hasn't posted any devlogs yet."
          }
        />
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <Card key={row.id} className="transition-colors hover:bg-[var(--platform-surface-soft)]">
              <CardContent className="pt-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link
                      href={`/projects/${id}/devlogs/${row.id}`}
                      className="block text-lg font-semibold hover:underline"
                    >
                      {row.title}
                    </Link>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{row.authorName || "Unknown"}</span>
                      <span>·</span>
                      <span>{formatDate(row.createdAt)}</span>
                    </div>
                  </div>
                  <Badge>{row.content.length.toLocaleString()} chars</Badge>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                  {excerpt(row.content)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
