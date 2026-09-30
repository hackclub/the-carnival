import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { shopItemSuggestion } from "@/db/schema";
import { getAuthUser, parseJsonBody } from "@/lib/api-utils";
import { getFrozenAccountMessage, getFrozenAccountState } from "@/lib/frozen-account";
import { validatePlatformImageUrl } from "@/lib/review/uploads";
import { sanitizeHttpUrl } from "@/lib/sanitize";

type ResubmitBody = {
  imageUrl?: unknown;
};

// A creator attaches the missing image to their own rejected, image-less
// suggestion and sends it back to the admin queue.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const freezeState = await getFrozenAccountState(authUser.id);
  if (freezeState.isFrozen) {
    return NextResponse.json(
      { error: getFrozenAccountMessage(freezeState.frozenReason), code: "account_frozen" },
      { status: 403 },
    );
  }

  const body = await parseJsonBody<ResubmitBody>(req);
  const imageUrl = sanitizeHttpUrl(body?.imageUrl);
  if (!imageUrl) return NextResponse.json({ error: "Upload an image first." }, { status: 400 });
  const imageValidation = validatePlatformImageUrl(imageUrl, "Suggested image");
  if (!imageValidation.ok) {
    return NextResponse.json({ error: imageValidation.error }, { status: 400 });
  }

  const { id } = await ctx.params;
  const now = new Date();
  const rows = await db
    .update(shopItemSuggestion)
    .set({
      status: "pending",
      imageUrl,
      rejectionReason: null,
      reviewedById: null,
      reviewedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(shopItemSuggestion.id, id),
        eq(shopItemSuggestion.submittedByUserId, authUser.id),
        eq(shopItemSuggestion.status, "rejected"),
        isNull(shopItemSuggestion.imageUrl),
      ),
    )
    .returning({ id: shopItemSuggestion.id });

  if (!rows[0]) {
    return NextResponse.json(
      { error: "Only your own rejected suggestions without an image can be resubmitted." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
