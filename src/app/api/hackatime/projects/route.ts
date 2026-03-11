import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { fetchHackatimeProjectsForUser, getHackatimeAccessTokenForUser } from "@/lib/hackatime";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo")?.trim() || "/projects";

  const session = await getServerSession({ disableCookieCache: true });
  const appUserId = (session?.user as { id?: string } | undefined)?.id ?? null;

  if (!appUserId) {
    return NextResponse.json({ projects: [], error: "Unauthorized" }, { status: 401 });
  }

  const token = await getHackatimeAccessTokenForUser(appUserId);
  if (!token) {
    return NextResponse.json(
      {
        projects: [],
        error: "Connect your Hackatime account to load projects.",
        code: "oauth_required",
        connectUrl: `/api/hackatime/oauth/start?returnTo=${encodeURIComponent(returnTo)}`,
      },
      { status: 401 },
    );
  }

  try {
    const projects = await fetchHackatimeProjectsForUser(appUserId);
    return NextResponse.json({ projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch Hackatime projects";
    return NextResponse.json({ projects: [], error: message }, { status: 502 });
  }
}


