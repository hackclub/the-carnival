import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-utils";
import { approveShopItemSuggestion } from "@/lib/shop";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!authUser.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const result = await approveShopItemSuggestion({
    suggestionId: id,
    adminUserId: authUser.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, shopItemId: result.shopItemId });
}
