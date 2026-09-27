import { NextResponse } from "next/server";
import { disconnectHackatimeForUser } from "@/lib/hackatime";
import { getServerSession } from "@/lib/server-session";

/**
 * POST /api/hackatime/disconnect
 * Drops the signed-in user's Hackatime OAuth grant (token, scope,
 * connected-at). The Hackatime user id stays so reviewer tooling for existing
 * projects keeps working. Reconnecting is the normal OAuth start flow.
 */
export async function POST() {
  const session = await getServerSession({ disableCookieCache: true });
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await disconnectHackatimeForUser(userId);
  return NextResponse.json({ ok: true });
}
