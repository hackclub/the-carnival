import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AdminInsightsClient from "@/components/AdminInsightsClient";
import AdminAutomatedNudgesCard from "@/components/AdminAutomatedNudgesCard";
import { db } from "@/db";
import {
  buildNudgeTemplates,
  getActivationFunnel,
  getActivationSegments,
  getWeeklySignups,
} from "@/lib/insights";
import { getAppBaseUrl, isNudgeEmailEnabled } from "@/lib/loops";
import { runNudges, type NudgeRunResult } from "@/lib/notifications/nudges/run";
import { loadAutomatedNudgeStats, type AutomatedNudgeStats } from "@/lib/notifications/nudges/select";
import { isSlackNudgeEnabled } from "@/lib/slack";
import { getServerSession } from "@/lib/server-session";

export default async function AdminInsightsPage() {
  const session = await getServerSession({ disableCookieCache: true });
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;

  if (!currentUserId) redirect("/login?callbackUrl=/admin/insights");
  if (role !== "admin") redirect("/projects");

  const [funnel, weeklySignups, segments, automated] = await Promise.all([
    getActivationFunnel(db),
    getWeeklySignups(db, 12),
    getActivationSegments(db),
    loadAutomatedNudgePreview(),
  ]);

  return (
    <AppShell title="Insights">
      <AdminAutomatedNudgesCard
        preview={automated.preview}
        stats={automated.stats}
        error={automated.error}
      />
      <AdminInsightsClient
        funnel={funnel}
        weeklySignups={weeklySignups}
        segments={segments}
        templates={buildNudgeTemplates(getAppBaseUrl())}
        slackEnabled={isSlackNudgeEnabled()}
        emailEnabled={isNudgeEmailEnabled()}
      />
    </AppShell>
  );
}

/**
 * Dry run of the real nudge planner for the card. Never throws: before
 * migration 0054 is applied (or if Slack/DB hiccup) the card shows the error
 * instead of taking the whole insights page down.
 */
async function loadAutomatedNudgePreview(): Promise<{
  preview: NudgeRunResult | null;
  stats: AutomatedNudgeStats[];
  error: string | null;
}> {
  try {
    const [preview, stats] = await Promise.all([runNudges({ dryRun: true }), loadAutomatedNudgeStats(db)]);
    return { preview, stats, error: null };
  } catch (err) {
    console.error("[insights] automated nudge preview failed", err);
    return { preview: null, stats: [], error: err instanceof Error ? err.message : String(err) };
  }
}
