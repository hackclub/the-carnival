import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import {
  assertGrantHoursInvariant,
  loadGrantContext,
  previewGrantPayload,
} from "@/lib/review/grant";

/**
 * PASS 2 — Airtable payload preview (dry run, admin-only).
 *
 * Returns the EXACT fields object and assembled hours-justification text a
 * grant (or manual push) would send, without touching Airtable. The grant
 * page renders this so the admin reviews the real payload — including the
 * technical justification they are currently editing (sent in the body) —
 * before clicking Grant. Same builder as the live push, so preview and
 * reality can never diverge.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as
    | { technicalJustification?: unknown }
    | null;
  const technicalJustificationOverride =
    body && typeof body.technicalJustification === "string"
      ? body.technicalJustification.trim().slice(0, 8000)
      : undefined;

  const context = await loadGrantContext(id, {
    ...(technicalJustificationOverride !== undefined
      ? { technicalJustificationOverride }
      : {}),
  });
  if (!context) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { fields, justificationText } = previewGrantPayload(context);
  const invariant = assertGrantHoursInvariant(context);

  return NextResponse.json({
    fields,
    justificationText,
    airtableRecordId: context.projectRow.airtableRecordId,
    technicalJustification: context.input.technicalJustification,
    hoursInvariantOk: invariant.ok,
    hoursInvariantError: invariant.ok ? null : invariant.error,
    approvedHours: context.projectRow.approvedHours,
  });
}
