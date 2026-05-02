import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { shopItemSuggestion } from "@/db/schema";
import { getAuthUser, parseJsonBody, toCleanString } from "@/lib/api-utils";

type RejectBody = {
  reason?: unknown;
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!authUser.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await parseJsonBody<RejectBody>(req);
  const reason = toCleanString(body?.reason);
  if (!reason) return NextResponse.json({ error: "Rejection reason is required." }, { status: 400 });

  const { id } = await ctx.params;
  const now = new Date();
  const rows = await db
    .update(shopItemSuggestion)
    .set({
      status: "rejected",
      rejectionReason: reason,
      reviewedById: authUser.id,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(and(eq(shopItemSuggestion.id, id), eq(shopItemSuggestion.status, "pending")))
    .returning({ id: shopItemSuggestion.id });

  if (!rows[0]) {
    return NextResponse.json(
      { error: "Suggestion not found or already reviewed" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
