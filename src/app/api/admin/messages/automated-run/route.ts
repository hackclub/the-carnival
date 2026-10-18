import { NextResponse } from "next/server";
import { appendAdminAudit } from "@/lib/admin-audit";
import { startAutomatedRun } from "@/lib/notifications/outreach";
import { parseSlackIdsInput, requireAdmin } from "@/lib/notifications/outreach-api";

export const dynamic = "force-dynamic";

/**
 * Start today's automated nudge run now (same rails and lock as the Coolify
 * scheduled task). Body: { maxSends?: number, allowlist?: string | string[] }.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  const maxRaw = body?.maxSends;
  const max = typeof maxRaw === "number" ? maxRaw : typeof maxRaw === "string" && maxRaw.trim() ? Number(maxRaw) : NaN;
  const allow = parseSlackIdsInput(body?.allowlist);
  if (allow.invalid.length) {
    return NextResponse.json({ error: `Not Slack user IDs: ${allow.invalid.slice(0, 5).join(", ")}` }, { status: 400 });
  }

  const { id } = await startAutomatedRun({
    adminId: auth.adminId,
    maxSends: Number.isFinite(max) && max >= 0 ? Math.floor(max) : undefined,
    allowlist: allow.ids.length ? allow.ids : undefined,
  });
  await appendAdminAudit({
    actorId: auth.adminId,
    actorRole: "admin",
    action: "outreach_run_started",
    details: { sendId: id, maxSends: Number.isFinite(max) ? max : null, allowlist: allow.ids },
  });
  return NextResponse.json({ id }, { status: 201 });
}
