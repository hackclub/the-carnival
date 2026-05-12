import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import NewDevlogForm from "@/components/NewDevlogForm";
import { Card, CardContent } from "@/components/ui";
import { db } from "@/db";
import { devlog, project } from "@/db/schema";
import { computeDevlogWindowCeiling } from "@/lib/devlog-shared";
import { listProjectHackatimeProjects } from "@/lib/devlogs";
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
      userId: devlog.userId,
      title: devlog.title,
      content: devlog.content,
      startedAt: devlog.startedAt,
      endedAt: devlog.endedAt,
      attachments: devlog.attachments,
      usedAi: devlog.usedAi,
      aiUsageDescription: devlog.aiUsageDescription,
      hackatimeProjectNameSnapshot: devlog.hackatimeProjectNameSnapshot,
      projectName: project.name,
      projectStatus: project.status,
      projectCreatorId: project.creatorId,
      projectSubmittedAt: project.submittedAt,
      projectHackatimeProjectName: project.hackatimeProjectName,
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

  const hackatimeProjectName =
    (row.hackatimeProjectNameSnapshot ?? "").trim() ||
    (row.projectHackatimeProjectName ?? "").trim();

  if (row.projectStatus !== "work-in-progress") {
    return (
      <AppShell title="Edit devlog">
        <div className="mb-6">
          <Link
            href={`/projects/${id}/devlogs/${devlogId}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to devlog
          </Link>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="font-semibold text-foreground">This devlog is frozen</div>
            <p className="text-sm text-muted-foreground">
              You can only edit devlogs while the project is work-in-progress. Once the project
              is submitted for review, devlogs lock.
            </p>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  if (!hackatimeProjectName) {
    return (
      <AppShell title="Edit devlog">
        <div className="mb-6">
          <Link
            href={`/projects/${id}/devlogs/${devlogId}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to devlog
          </Link>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="font-semibold text-foreground">
              Set a Hackatime project first
            </div>
            <p className="text-sm text-muted-foreground">
              Each devlog pulls its hours from Hackatime for this project&apos;s configured
              Hackatime project. Pick one on the project page before editing this devlog.
            </p>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const ceiling = computeDevlogWindowCeiling({
    projectStatus: row.projectStatus,
    submittedAt: row.projectSubmittedAt ?? null,
  });
  const linkedHackatimeProjects = await listProjectHackatimeProjects(id);

  return (
    <AppShell title={`Edit devlog · ${row.projectName ?? ""}`}>
      <div className="mb-6">
        <Link
          href={`/projects/${id}/devlogs/${devlogId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to devlog
        </Link>
      </div>
      <NewDevlogForm
        mode="edit"
        devlogId={devlogId}
        projectId={id}
        projectName={row.projectName ?? "Project"}
        hackatimeProjectName={(row.hackatimeProjectNameSnapshot ?? "").trim() || hackatimeProjectName}
        linkedHackatimeProjects={linkedHackatimeProjects}
        ceilingIso={ceiling.toISOString()}
        initial={{
          title: row.title,
          content: row.content,
          attachments: row.attachments ?? [],
          usedAi: row.usedAi,
          aiUsageDescription: row.aiUsageDescription ?? null,
          startedAtIso: row.startedAt.toISOString(),
          endedAtIso: row.endedAt.toISOString(),
        }}
      />
    </AppShell>
  );
}
