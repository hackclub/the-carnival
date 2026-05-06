import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import NewDevlogForm from "@/components/NewDevlogForm";
import { Card, CardContent } from "@/components/ui";
import { db } from "@/db";
import { project } from "@/db/schema";
import { computeDevlogWindowCeiling } from "@/lib/devlog-shared";
import { listProjectHackatimeProjects, getDevlogWindowFloor } from "@/lib/devlogs";
import { getServerSession } from "@/lib/server-session";

export default async function NewDevlogPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession({ disableCookieCache: true });
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/projects`);
  }

  const { id } = await props.params;

  const rows = await db
    .select({
      id: project.id,
      name: project.name,
      creatorId: project.creatorId,
      status: project.status,
      hackatimeProjectName: project.hackatimeProjectName,
      submittedAt: project.submittedAt,
      startedOnCarnivalAt: project.startedOnCarnivalAt,
      createdAt: project.createdAt,
    })
    .from(project)
    .where(and(eq(project.id, id), eq(project.creatorId, session.user.id)))
    .limit(1);

  const p = rows[0];
  if (!p) notFound();

  const hackatimeProjectName = (p.hackatimeProjectName ?? "").trim();

  if (p.status !== "work-in-progress") {
    return (
      <AppShell title="New devlog">
        <div className="mb-6">
          <Link
            href={`/projects/${p.id}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to project
          </Link>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="font-semibold text-foreground">Devlogs are frozen</div>
            <p className="text-sm text-muted-foreground">
              You can only post devlogs while the project is work-in-progress. Once you&apos;ve
              submitted the project for review, devlogs lock until you need to resubmit.
            </p>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const floorBase = p.startedOnCarnivalAt ?? p.createdAt;
  const floor = await getDevlogWindowFloor(p.id, floorBase);
  const ceiling = computeDevlogWindowCeiling({
    projectStatus: p.status,
    submittedAt: p.submittedAt ?? null,
  });
  const linkedHackatimeProjects = await listProjectHackatimeProjects(p.id);

  return (
    <AppShell title="New devlog">
      <div className="mb-6">
        <Link
          href={`/projects/${p.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to project
        </Link>
      </div>
      <NewDevlogForm
        projectId={p.id}
        projectName={p.name}
        hackatimeProjectName={hackatimeProjectName}
        linkedHackatimeProjects={linkedHackatimeProjects}
        floorIso={floor.toISOString()}
        ceilingIso={ceiling.toISOString()}
      />
    </AppShell>
  );
}
