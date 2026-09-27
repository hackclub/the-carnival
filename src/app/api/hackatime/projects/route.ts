import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { fetchHackatimeProjectsForConnectedUser } from "@/lib/hackatime";
import { isHackatimeAuthError } from "@/lib/hackatime-errors";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo")?.trim() || "/projects";

  const session = await getServerSession({ disableCookieCache: true });
  const appUserId = (session?.user as { id?: string } | undefined)?.id ?? null;

  if (!appUserId) {
    return NextResponse.json({ projects: [], error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await fetchHackatimeProjectsForConnectedUser(appUserId);
    return NextResponse.json({ projects });
  } catch (err) {
    // Both "never connected" and "token revoked on Hackatime" end the same
    // way: the user has to run the OAuth flow. The pickers render a connect
    // button for `oauth_required`; `reason` lets them label it "Reconnect".
    if (isHackatimeAuthError(err)) {
      return NextResponse.json(
        {
          projects: [],
          error:
            err.reason === "revoked"
              ? "Carnival's access to your Hackatime account was revoked. Reconnect Hackatime to load your projects."
              : "Connect your Hackatime account to load projects.",
          code: "oauth_required",
          reason: err.reason,
          connectUrl: `/api/hackatime/oauth/start?returnTo=${encodeURIComponent(returnTo)}`,
        },
        { status: 401 },
      );
    }
    const message = err instanceof Error ? err.message : "Failed to fetch Hackatime projects";
    return NextResponse.json({ projects: [], error: message }, { status: 502 });
  }
}
