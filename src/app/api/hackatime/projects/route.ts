import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { fetchHackatimeProjectNames } from "@/lib/hackatime";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const qpSlackId = url.searchParams.get("slackId")?.trim() || null;

  const session = await getServerSession({ disableCookieCache: true });
  const sessionSlackId = (session?.user as { slackId?: string } | undefined)?.slackId ?? null;

  const slackId = qpSlackId ?? sessionSlackId;

  if (!slackId) {
    return NextResponse.json(
      { projects: [], error: "Missing slackId on session user" },
      { status: 400 },
    );
  }

  console.log(`Fetching Hackatime projects for user ${slackId}`);

  try {
    const projects = await fetchHackatimeProjectNames(slackId);
    return NextResponse.json({ projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch Hackatime projects";
    return NextResponse.json({ projects: [], error: message }, { status: 502 });
  }
}


