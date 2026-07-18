import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AdminInsightsClient from "@/components/AdminInsightsClient";
import { db } from "@/db";
import {
  buildNudgeTemplates,
  getActivationFunnel,
  getActivationSegments,
  getWeeklySignups,
} from "@/lib/insights";
import { getAppBaseUrl, isNudgeEmailEnabled } from "@/lib/loops";
import { isSlackNudgeEnabled } from "@/lib/slack";
import { getServerSession } from "@/lib/server-session";

export default async function AdminInsightsPage() {
  const session = await getServerSession({ disableCookieCache: true });
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;

  if (!currentUserId) redirect("/login?callbackUrl=/admin/insights");
  if (role !== "admin") redirect("/projects");

  const [funnel, weeklySignups, segments] = await Promise.all([
    getActivationFunnel(db),
    getWeeklySignups(db, 12),
    getActivationSegments(db),
  ]);

  return (
    <AppShell title="Insights">
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
