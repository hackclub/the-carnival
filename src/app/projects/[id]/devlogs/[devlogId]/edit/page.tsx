import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import DevlogForm from "@/components/DevlogForm";
import { db } from "@/db";
import { devlog, project } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

export default async function EditDevlogPage(props: {
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
      userId: devlog.userId,
      projectName: project.name,
    })
    .from(devlog)
    .leftJoin(project, eq(devlog.projectId, project.id))
    .where(and(eq(devlog.id, devlogId), eq(devlog.projectId, id)))
    .limit(1);

  const row = rows[0];
  if (!row) notFound();

  if (row.userId !== session.user.id) {
    redirect(`/projects/${id}/devlogs/${devlogId}`);
  }

  return (
    <AppShell title={`Edit devlog${row.projectName ? ` · ${row.projectName}` : ""}`}>
      <div className="mb-6">
        <Link
          href={`/projects/${id}/devlogs/${devlogId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to devlog
        </Link>
      </div>

      <DevlogForm
        projectId={id}
        devlogId={devlogId}
        initial={{ title: row.title, content: row.content }}
        onCancelHref={`/projects/${id}/devlogs/${devlogId}`}
        onSavedHref={(savedId) => `/projects/${id}/devlogs/${savedId}`}
        submitLabel="Save changes"
      />
    </AppShell>
  );
}
