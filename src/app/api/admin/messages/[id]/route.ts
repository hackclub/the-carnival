import { NextResponse } from "next/server";
import { appendAdminAudit } from "@/lib/admin-audit";
import { cancelRemainingBatches, getSendDetail, releaseNextBatch, resumeSend } from "@/lib/notifications/outreach";
import { requireAdmin } from "@/lib/notifications/outreach-api";

export const dynamic = "force-dynamic";

/** Progress and per-recipient results for one send (polled while running). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const { id } = await ctx.params;
  const detail = await getSendDetail(id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(detail);
}

/**
 * { action: "resume" } restarts an interrupted send for pending recipients only;
 * { action: "next_batch" } releases the next batch of a waiting send;
 * { action: "cancel" } drops a waiting send's remaining batches.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;

  if (body?.action === "next_batch") {
    const released = await releaseNextBatch(id);
    if (!released.ok) {
      return NextResponse.json({ error: "Only a send waiting for its next batch can release one." }, { status: 409 });
    }
    await appendAdminAudit({
      actorId: auth.adminId,
      actorRole: "admin",
      action: "outreach_batch_released",
      details: { sendId: id, batch: released.batch, pending: released.pending, skipped: released.skipped },
    });
    return NextResponse.json(released);
  }

  if (body?.action === "cancel") {
    if (!(await cancelRemainingBatches(id))) {
      return NextResponse.json({ error: "Only a send waiting for its next batch can be cancelled." }, { status: 409 });
    }
    await appendAdminAudit({ actorId: auth.adminId, actorRole: "admin", action: "outreach_cancelled", details: { sendId: id } });
    return NextResponse.json({ ok: true });
  }

  if (body?.action !== "resume") return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const outcome = await resumeSend(id);
  if (outcome === "not_custom") {
    return NextResponse.json({ error: "Automated runs can't be resumed; start a new run instead." }, { status: 409 });
  }
  if (outcome === "not_interrupted") {
    return NextResponse.json({ error: "Only an interrupted send can be resumed." }, { status: 409 });
  }
  await appendAdminAudit({ actorId: auth.adminId, actorRole: "admin", action: "outreach_resumed", details: { sendId: id } });
  return NextResponse.json({ ok: true });
}
