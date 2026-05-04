import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { shopItemSuggestion } from "@/db/schema";
import {
  generateId,
  getAuthUser,
  parseJsonBody,
  toCleanString,
  toPositiveInt,
} from "@/lib/api-utils";
import { getFrozenAccountMessage, getFrozenAccountState } from "@/lib/frozen-account";
import { normalizeOptionalUrl } from "@/lib/shop-shared";

type CreateSuggestionBody = {
  name?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  referenceUrl?: unknown;
  orderNoteRequired?: unknown;
  approvedHoursNeeded?: unknown;
  tokenCost?: unknown;
};

function toBoolean(value: unknown): boolean | null {
  if (value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function serializeSuggestion(row: typeof shopItemSuggestion.$inferSelect) {
  return {
    id: row.id,
    status: row.status,
    name: row.name,
    description: row.description ?? null,
    imageUrl: row.imageUrl ?? null,
    referenceUrl: row.referenceUrl ?? null,
    orderNoteRequired: row.orderNoteRequired,
    approvedHoursNeeded: row.approvedHoursNeeded,
    tokenCost: row.tokenCost,
    rejectionReason: row.rejectionReason ?? null,
    approvedShopItemId: row.approvedShopItemId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
  };
}

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const suggestions = await db
    .select()
    .from(shopItemSuggestion)
    .where(eq(shopItemSuggestion.submittedByUserId, authUser.id))
    .orderBy(desc(shopItemSuggestion.createdAt));

  return NextResponse.json({ suggestions: suggestions.map(serializeSuggestion) });
}

export async function POST(req: Request) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const freezeState = await getFrozenAccountState(authUser.id);
  if (freezeState.isFrozen) {
    return NextResponse.json(
      { error: getFrozenAccountMessage(freezeState.frozenReason), code: "account_frozen" },
      { status: 403 },
    );
  }

  const body = await parseJsonBody<CreateSuggestionBody>(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const name = toCleanString(body.name);
  const description = toCleanString(body.description) || null;
  const imageUrl = normalizeOptionalUrl(body.imageUrl);
  const referenceUrl = normalizeOptionalUrl(body.referenceUrl);
  const orderNoteRequired = toBoolean(body.orderNoteRequired);
  const approvedHoursNeeded = toPositiveInt(body.approvedHoursNeeded);
  const tokenCost = toPositiveInt(body.tokenCost);

  if (!name) return NextResponse.json({ error: "Item name is required." }, { status: 400 });
  if (body.imageUrl && !imageUrl) {
    return NextResponse.json({ error: "Image URL must be http(s)." }, { status: 400 });
  }
  if (body.referenceUrl && !referenceUrl) {
    return NextResponse.json({ error: "Reference URL must be http(s)." }, { status: 400 });
  }
  if (orderNoteRequired === null) {
    return NextResponse.json({ error: "orderNoteRequired must be a boolean." }, { status: 400 });
  }
  if (!Number.isFinite(approvedHoursNeeded) || approvedHoursNeeded < 0) {
    return NextResponse.json(
      { error: "Approved hours needed must be a non-negative integer." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(tokenCost) || tokenCost < 0) {
    return NextResponse.json({ error: "Token cost must be a non-negative integer." }, { status: 400 });
  }

  const now = new Date();
  const id = generateId();
  const rows = await db
    .insert(shopItemSuggestion)
    .values({
      id,
      submittedByUserId: authUser.id,
      status: "pending",
      name,
      description,
      imageUrl,
      referenceUrl,
      orderNoteRequired,
      approvedHoursNeeded,
      tokenCost,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return NextResponse.json({ suggestion: serializeSuggestion(rows[0]) }, { status: 201 });
}
