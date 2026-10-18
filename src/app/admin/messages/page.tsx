import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import AdminAutomatedNudgesCard from "@/components/AdminAutomatedNudgesCard";
import AdminMessagesClient, { type MessagesPageData } from "@/components/AdminMessagesClient";
import { db } from "@/db";
import { user } from "@/db/schema";
import { buildNudgeTemplates, getActivationSegments, SEGMENT_KEYS } from "@/lib/insights";
import { getAppBaseUrl, isNudgeEmailEnabled } from "@/lib/loops";
import { runNudges, type NudgeRunResult } from "@/lib/notifications/nudges/run";
import { loadAutomatedNudgeStats, type AutomatedNudgeStats } from "@/lib/notifications/nudges/select";
import { listExclusions, listSends } from "@/lib/notifications/outreach";
import { isSlackConfigured } from "@/lib/notifications/slack-client";
import { getSiteSettingIso } from "@/lib/site-settings";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  const session = await getServerSession({ disableCookieCache: true });
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!currentUserId) redirect("/login?callbackUrl=/admin/messages");
  if (role !== "admin") redirect("/projects");

  const [users, segments, automated, exclusions, sends] = await Promise.all([
    db
      .select({ id: user.id, name: user.name, email: user.email, slackId: user.slackId, isFrozen: user.isFrozen })
      .from(user)
      .orderBy(asc(user.name)),
    getActivationSegments(db),
    loadAutomatedNudgePreview(),
    listExclusions(),
    listSends(30),
  ]);

  const templates = buildNudgeTemplates(getAppBaseUrl());
  const data: MessagesPageData = {
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      slackId: u.slackId?.trim().toUpperCase() || null,
      isFrozen: u.isFrozen,
    })),
    segments: SEGMENT_KEYS.map((key) => ({
      key,
      label: templates[key].label,
      description: templates[key].description,
      userIds: segments[key].map((u) => u.id),
    })),
    exclusions,
    sends,
    slackEnabled: isSlackConfigured(),
    emailEnabled: isNudgeEmailEnabled(),
  };

  return (
    <AppShell title="Messages">
      <div className="space-y-6">
        <AdminAutomatedNudgesCard preview={automated.preview} stats={automated.stats} error={automated.error} />
        <AdminMessagesClient initial={data} />
      </div>
    </AppShell>
  );
}

/** Dry run of the real nudge planner for the card; never throws. */
async function loadAutomatedNudgePreview(): Promise<{
  preview: NudgeRunResult | null;
  stats: AutomatedNudgeStats[];
  error: string | null;
}> {
  try {
    const deadlineIso = await getSiteSettingIso("carnival_deadline");
    const [preview, stats] = await Promise.all([
      runNudges({ dryRun: true, deadlineIso }),
      loadAutomatedNudgeStats(db),
    ]);
    return { preview, stats, error: null };
  } catch (err) {
    console.error("[messages] automated nudge preview failed", err);
    return { preview: null, stats: [], error: err instanceof Error ? err.message : String(err) };
  }
}
