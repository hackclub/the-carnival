import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { project } from "@/db/schema";
import { getAuthUser, parseJsonBody, toCleanString } from "@/lib/api-utils";
import { makeR2ObjectKey, presignR2PutObject, r2PublicUrlForKey, type R2UploadKind } from "@/lib/r2";

type PresignBody = {
  kind?: unknown;
  contentType?: unknown;
  projectId?: unknown;
};

function isKind(value: string): value is R2UploadKind {
  return (
    value === "project_screenshot" ||
    value === "bounty_preview" ||
    value === "shop_item_image" ||
    value === "editor_icon" ||
    value === "devlog_attachment"
  );
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseJsonBody<PresignBody>(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const kindRaw = toCleanString(body.kind);
  if (!kindRaw) return NextResponse.json({ error: "kind is required" }, { status: 400 });
  if (!isKind(kindRaw)) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });

  // Admin-only kinds, except shop item images which reviewers can manage.
  if ((kindRaw === "shop_item_image" && !user.isReviewer) || (kindRaw === "editor_icon" && !user.isAdmin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = toCleanString(body.contentType) || "application/octet-stream";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads are allowed" }, { status: 400 });
  }
  if (contentType.includes("\n") || contentType.includes("\r")) {
    return NextResponse.json({ error: "Invalid contentType" }, { status: 400 });
  }

  const projectId = toCleanString(body.projectId);

  if (kindRaw === "devlog_attachment") {
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required for devlog attachments" },
        { status: 400 },
      );
    }
    const ownerRows = await db
      .select({ id: project.id, status: project.status })
      .from(project)
      .where(and(eq(project.id, projectId), eq(project.creatorId, user.id)))
      .limit(1);
    const owned = ownerRows[0];
    if (!owned) {
      return NextResponse.json(
        { error: "Project not found, or you are not the creator." },
        { status: 403 },
      );
    }
    if (owned.status !== "work-in-progress") {
      return NextResponse.json(
        { error: "Devlogs can only be posted while a project is work-in-progress." },
        { status: 403 },
      );
    }
  }

  const key = makeR2ObjectKey({
    kind: kindRaw,
    contentType,
    projectId:
      (kindRaw === "project_screenshot" || kindRaw === "devlog_attachment") && projectId
        ? projectId
        : undefined,
  });

  try {
    const { uploadUrl } = await presignR2PutObject({ key, contentType });
    const publicUrl = r2PublicUrlForKey(key);
    return NextResponse.json({ uploadUrl, publicUrl, key });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to presign upload";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
