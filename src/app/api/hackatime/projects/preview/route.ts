import { NextResponse } from "next/server";
import { refreshHackatimeProjectSnapshotForRange } from "@/lib/hackatime";
import { parseConsideredHackatimeRange } from "@/lib/hackatime-range";
import { getServerSession } from "@/lib/server-session";

type PreviewBody = {
  hackatimeProjectName?: unknown;
  consideredHackatimeRange?: unknown;
};

function toCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  const session = await getServerSession({ disableCookieCache: true });
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PreviewBody;
  try {
    body = (await req.json()) as PreviewBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const hackatimeProjectName = toCleanString(body.hackatimeProjectName);
  if (!hackatimeProjectName) {
    return NextResponse.json({ error: "Hackatime project name is required." }, { status: 400 });
  }

  const parsedRange = parseConsideredHackatimeRange(body.consideredHackatimeRange);
  if (!parsedRange.ok) {
    return NextResponse.json({ error: parsedRange.error }, { status: 400 });
  }

  try {
    const refreshed = await refreshHackatimeProjectSnapshotForRange(userId, {
      projectName: hackatimeProjectName,
      range: parsedRange.value,
    });
    return NextResponse.json({
      project: {
        hackatimeProjectName,
        hackatimeStartedAt: refreshed.hackatimeStartedAt.toISOString(),
        hackatimeStoppedAt: refreshed.hackatimeStoppedAt.toISOString(),
        hackatimeTotalSeconds: refreshed.hackatimeTotalSeconds,
        hackatimeHours: refreshed.hours,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Failed to refresh Hackatime for the selected range.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
