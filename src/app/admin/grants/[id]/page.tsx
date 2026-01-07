import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import AdminGrantClient from "@/components/AdminGrantClient";
import { db } from "@/db";
import { project, user } from "@/db/schema";
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
      creatorSlackId: user.slackId,
      creatorVerificationStatus: user.verificationStatus,
    })
    .from(project)
    .leftJoin(user, eq(project.creatorId, user.id))
    .where(eq(project.id, id))
    .limit(1);

  const p = rows[0];
  if (!p) notFound();

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
            hackatimeProjectName: p.hackatimeProjectName,
            playableUrl: p.playableUrl,
            codeUrl: p.codeUrl,
            screenshots: p.screenshots,
            status: p.status,
          },
          creator: {
            id: p.creatorId || "",
            name: p.creatorName || "Unknown",
            email: p.creatorEmail || "",
            slackId: p.creatorSlackId || "",
            verificationStatus: p.creatorVerificationStatus || "",
          },
        }}
      />
    </AppShell>
  );
}


