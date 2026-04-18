import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import DevlogForm from "@/components/DevlogForm";
import { db } from "@/db";
import { project } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

export default async function NewDevlogPage(props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession({ disableCookieCache: true });
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/projects`);
  }

  const { id } = await props.params;

  const rows = await db
    .select({ id: project.id, name: project.name, status: project.status })
    .from(project)
    .where(and(eq(project.id, id), eq(project.creatorId, session.user.id)))
    .limit(1);

  const p = rows[0];
  if (!p) notFound();

  if (p.status === "granted") {
    redirect(`/projects/${id}/devlogs`);
  }

  return (
    <AppShell title={`New devlog · ${p.name}`}>
      <div className="mb-6">
        <Link
          href={`/projects/${id}/devlogs`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to devlogs
        </Link>
      </div>

      <DevlogForm
        projectId={id}
        onCancelHref={`/projects/${id}/devlogs`}
        onSavedHref={(devlogId) => `/projects/${id}/devlogs/${devlogId}`}
        submitLabel="Publish devlog"
      />
    </AppShell>
  );
}
