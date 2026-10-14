/**
 * Scheduler entry point for automated Slack nudges.
 *
 *   POST /api/cron/nudges            run (sends only when NUDGES_ENABLED=true)
 *   POST /api/cron/nudges?dryRun=1   plan only, nothing sent
 *   GET  /api/cron/nudges            always a dry run
 *   ?max=25                          lower the per-run cap for this call
 *
 * Auth: `Authorization: Bearer $CRON_SECRET`. Triggered daily by
 * .github/workflows/nudges.yml (or any external cron). No in-process timer:
 * the app runs as a standalone container, possibly replicated.
 *
 * Each call sends at most NUDGES_MAX_PER_RUN (default 80) at 1 msg/s so the
 * response returns inside Cloudflare's 100 s limit; the workflow calls again
 * until a call plans nothing. Every recipient is recorded as soon as their DM
 * is sent, so a batch that times out is still never repeated.
 */
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { nudgeMaxPerRunFromEnv, runNudges } from "@/lib/notifications/nudges/run";

// Vercel-only hint; under `bun server.js` the proxy timeout is the real limit.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return { ok: false, status: 503, error: "CRON_SECRET is not configured" };
  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}

async function handle(req: Request, forceDryRun: boolean) {
  const auth = isAuthorized(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const dryRunParam = searchParams.get("dryRun");
  const dryRun = forceDryRun || dryRunParam === "1" || dryRunParam === "true";
  // Absent/blank ?max keeps the env cap; Number(null) would be 0 (= send nothing).
  const maxRaw = searchParams.get("max");
  const maxParam = maxRaw === null || maxRaw.trim() === "" ? Number.NaN : Number(maxRaw);
  const maxSends =
    Number.isFinite(maxParam) && maxParam >= 0
      ? Math.min(Math.floor(maxParam), nudgeMaxPerRunFromEnv())
      : undefined;

  try {
    const result = await runNudges({ dryRun, maxSends });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[nudges] run failed", err);
    return NextResponse.json({ error: "Nudge run failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return handle(req, false);
}

export async function GET(req: Request) {
  return handle(req, true);
}
