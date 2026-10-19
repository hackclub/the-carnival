import { NextResponse } from "next/server";
import { appendAdminAudit } from "@/lib/admin-audit";
import { addExclusions, listExclusions, removeExclusion } from "@/lib/notifications/outreach";
import { parseSlackIdsInput, requireAdmin } from "@/lib/notifications/outreach-api";

export const dynamic = "force-dynamic";

/** Exclusion list plus people who opted out of automated reminders themselves. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  return NextResponse.json(await listExclusions());
}

/** Body: { slackIds: string | string[], note?: string }. */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseSlackIdsInput(body?.slackIds);
  if (parsed.invalid.length) {
    return NextResponse.json({ error: `Not Slack user IDs: ${parsed.invalid.slice(0, 5).join(", ")}` }, { status: 400 });
  }
  if (parsed.ids.length === 0) return NextResponse.json({ error: "Enter at least one Slack ID" }, { status: 400 });
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;

  const result = await addExclusions({ slackIds: parsed.ids, note, adminId: auth.adminId });
  if (result.added.length) {
    await appendAdminAudit({
      actorId: auth.adminId,
      actorRole: "admin",
      action: "nudge_exclusion_added",
      details: { slackIds: result.added, note },
    });
  }
  return NextResponse.json({ ...result, ...(await listExclusions()) });
}

/** DELETE ?slackId=U0123 removes one entry. */
export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const slackId = new URL(req.url).searchParams.get("slackId")?.trim().toUpperCase() ?? "";
  if (!slackId) return NextResponse.json({ error: "slackId is required" }, { status: 400 });
  const removed = await removeExclusion(slackId);
  if (!removed) return NextResponse.json({ error: "Not on the exclusion list" }, { status: 404 });
  await appendAdminAudit({
    actorId: auth.adminId,
    actorRole: "admin",
    action: "nudge_exclusion_removed",
    details: { slackId },
  });
  return NextResponse.json(await listExclusions());
}
