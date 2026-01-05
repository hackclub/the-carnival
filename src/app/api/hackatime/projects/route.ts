import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { fetchHackatimeProjectNames } from "@/lib/hackatime";

export async function GET() {
  const session = await getServerSession({ disableCookieCache: true });
  const slackId = (session?.user as { slackId?: string } | undefined)?.slackId;

  if (!slackId) {
    return NextResponse.json(
      { projects: [], error: "Missing slackId on session user" },
      { status: 400 },
    );
  }

  const projects = await fetchHackatimeProjectNames(slackId);
  return NextResponse.json({ projects });
}


