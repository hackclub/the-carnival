/**
 * Copy for automated nudges. Pure: no DB/Slack imports (templates.test.mjs).
 *
 * Every message: first-name greeting, one concrete next step with a link, the
 * deadline when it is close, and how to turn these off. The second send of
 * a kind is framed as a last call.
 */
import { firstNameOf } from "@/lib/insights";
import { formatDeadlineMonthDay } from "@/lib/site-settings-shared";
import type { PlannedNudge } from "./policy";

export type NudgeTemplateContext = {
  appBaseUrl: string;
  deadlineIso: string | null;
  daysLeft: number | null;
};

function base(ctx: NudgeTemplateContext) {
  return ctx.appBaseUrl.replace(/\/+$/, "");
}

function hoursLabel(seconds: number): string {
  const hours = seconds / 3600;
  if (hours >= 10) return `${Math.round(hours)} hours`;
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} hour${rounded === 1 ? "" : "s"}`;
}

/** Mention the deadline once it is this close (the whole final stretch). */
export const DEADLINE_MENTION_DAYS = 21;

export function deadlineLine(ctx: NudgeTemplateContext): string | null {
  if (ctx.daysLeft === null || ctx.daysLeft > DEADLINE_MENTION_DAYS || !ctx.deadlineIso) return null;
  const when = formatDeadlineMonthDay(ctx.deadlineIso);
  if (ctx.daysLeft <= 0) return `⏰ The Carnival closes today (${when}).`;
  if (ctx.daysLeft === 1) return `⏰ The Carnival closes tomorrow (${when}).`;
  return `⏰ The Carnival closes in ${ctx.daysLeft} days (${when}).`;
}

function footer(ctx: NudgeTemplateContext): string {
  return `Stuck? Reply here or ask in #carnival. Turn these reminders off in Account settings: ${base(ctx)}/account`;
}

function greeting(n: PlannedNudge): string {
  const name = firstNameOf(n.name);
  return n.sendNumber > 1 ? `Hey ${name}, last call! 🎪` : `Hey ${name}! 🎪`;
}

function projectLabel(n: PlannedNudge): string {
  return n.projectName ? `*${n.projectName}*` : "your project";
}

function projectUrl(n: PlannedNudge, ctx: NudgeTemplateContext): string {
  return n.projectId ? `${base(ctx)}/projects/${encodeURIComponent(n.projectId)}` : `${base(ctx)}/projects`;
}

function bodyFor(n: PlannedNudge, ctx: NudgeTemplateContext): string[] {
  switch (n.kind) {
    case "hours_unsubmitted": {
      const hours = hoursLabel(n.devlogSeconds);
      const lead =
        n.variant === "repeat_shipper"
          ? `You've already shipped on Carnival, and ${projectLabel(n)} has ${hours} in devlogs waiting for its own grant.`
          : `You've logged ${hours} on ${projectLabel(n)} — you're closer to a grant than you think.`;
      return [
        lead,
        n.sendNumber > 1
          ? "Unsubmitted hours don't get paid out. Submit it now so a reviewer can take a look before the gates close."
          : "Post a final devlog if you need to, then hit *Submit for review* so a reviewer can take a look.",
        `Open it: ${projectUrl(n, ctx)}`,
      ];
    }
    case "project_no_hours_7d": {
      if (n.variant === "no_token") {
        return [
          `You created ${projectLabel(n)} a while ago, but Carnival can't see any coding time because Hackatime isn't connected.`,
          "Connect (or reconnect) Hackatime so your hours count, then post a devlog.",
          `Connect here: ${base(ctx)}/account`,
        ];
      }
      if (n.variant === "has_hackatime_time") {
        return [
          `Hackatime has coding time on ${projectLabel(n)}, but no devlog has claimed it yet — devlogs are how hours get reviewed and paid.`,
          "Post a quick devlog covering the days you worked, then submit when it's ready.",
          `Write one: ${projectUrl(n, ctx)}`,
        ];
      }
      return [
        `You created ${projectLabel(n)} over a week ago, but Hackatime hasn't recorded any time on it yet.`,
        "That usually means the editor plugin isn't set up, or the Hackatime project name doesn't match your Carnival project.",
        `Check your setup: ${base(ctx)}/account — then post a devlog once time is flowing.`,
      ];
    }
    case "connected_no_project":
      return [
        "Hackatime is connected — nice. The next step is registering what you're building so your hours start counting toward a grant.",
        "Pick an extension or plugin idea (or grab a bounty) and create your project. It takes a minute.",
        `Create it: ${base(ctx)}/projects?new=1`,
      ];
    case "never_connected":
      return [
        n.variant === "needs_reconnect"
          ? "Carnival's access to your Hackatime account was revoked, so none of your coding time is being counted."
          : "You signed up for Carnival but haven't connected Hackatime yet, so none of your coding time is being counted.",
        "It takes about 5 minutes: connect Hackatime, create a project, build something, ship it, and get a grant to upgrade your dev setup.",
        `Start here: ${base(ctx)}/account`,
      ];
  }
}

export function buildNudgeText(n: PlannedNudge, ctx: NudgeTemplateContext): string {
  const lines = [greeting(n), ...bodyFor(n, ctx)];
  const deadline = deadlineLine(ctx);
  if (deadline) lines.push(deadline);
  lines.push(footer(ctx));
  return lines.join("\n");
}
