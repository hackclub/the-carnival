import { NextResponse } from "next/server";
import { findAudience } from "@/lib/notifications/audience";
import { parseAudienceFilters } from "@/lib/notifications/audience-shared";
import { requireAdmin } from "@/lib/notifications/outreach-api";

export const dynamic = "force-dynamic";

/** Users matching every filter in { filters } (none: everyone); nothing is sent. */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseAudienceFilters(body?.filters);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  return NextResponse.json({ userIds: await findAudience(parsed.filters) });
}
