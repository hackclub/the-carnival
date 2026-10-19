/**
 * Staff view of a project's Telescreen (Robert) fraud review.
 *
 * GET  — the current submission, refreshed from Robert, plus the grant gate.
 * POST — same, but also sends the submission if it never reached Robert
 *        (the "Send to Telescreen" / retry button).
 */
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { isTelescreenEnabled } from "@/lib/telescreen/client";
import { ensureTelescreenSubmission, getTelescreenGrantGate } from "@/lib/telescreen/submissions";

async function requireStaff() {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "reviewer" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

async function respond(projectId: string) {
  const { gate, submission } = await getTelescreenGrantGate(projectId);
  return NextResponse.json({ enabled: isTelescreenEnabled(), gate, submission });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireStaff();
  if (denied) return denied;
  const { id } = await ctx.params;
  return respond(id);
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireStaff();
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!isTelescreenEnabled()) {
    return NextResponse.json({ error: "Telescreen is not configured (ROBERT_API_KEY)." }, { status: 503 });
  }
  await ensureTelescreenSubmission(id);
  return respond(id);
}
