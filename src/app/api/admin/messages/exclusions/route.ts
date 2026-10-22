import { NextResponse } from "next/server";
import { appendAdminAudit } from "@/lib/admin-audit";
import { addExclusions, listExclusions, removeExclusion, slackIdsForUsers } from "@/lib/notifications/outreach";
import { parseSlackIdsInput, parseStringList, requireAdmin } from "@/lib/notifications/outreach-api";

export const dynamic = "force-dynamic";

/** Exclusion list plus people who turned off Carnival messages themselves. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  return NextResponse.json(await listExclusions());
}

/**
 * Body: { slackIds?: string | string[], userIds?: string[], note?: string }.
 * Users are excluded by their Slack ID; one without a Slack ID is refused.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseSlackIdsInput(body?.slackIds);
  if (parsed.invalid.length) {
    return NextResponse.json({ error: `Not Slack user IDs: ${parsed.invalid.slice(0, 5).join(", ")}` }, { status: 400 });
  }
  const userIds = parseStringList(body?.userIds);
  const users = await slackIdsForUsers(userIds);
  if (users.unknown.length) {
    return NextResponse.json({ error: `Unknown user IDs: ${users.unknown.slice(0, 5).join(", ")}` }, { status: 400 });
  }
  if (users.noSlackId.length) {
    const names = users.noSlackId.map((u) => u.name).slice(0, 5).join(", ");
    return NextResponse.json(
      { error: `${names}: no Slack ID on file, so they can't get Slack messages and can't be excluded` },
      { status: 400 },
    );
  }
  const slackIds = [...new Set([...parsed.ids, ...users.slackIds])];
  if (slackIds.length === 0) return NextResponse.json({ error: "Enter at least one Slack ID or pick a user" }, { status: 400 });
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;

  const result = await addExclusions({ slackIds, note, adminId: auth.adminId });
  if (result.added.length) {
    await appendAdminAudit({
      actorId: auth.adminId,
      actorRole: "admin",
      action: "nudge_exclusion_added",
      details: { slackIds: result.added, userIds, note },
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
