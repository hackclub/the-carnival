import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bountyProject, type BountyHelpfulLink } from "@/db/schema";
import { getAuthUser, parseJsonBody, toCleanString, toPositiveInt, updatedTimestamp } from "@/lib/api-utils";

type UpdateBountyBody = {
  name?: unknown;
  description?: unknown;
  prizeUsd?: unknown;
  helpfulLinks?: unknown;
  completed?: unknown;
};

function toHelpfulLinks(value: unknown): BountyHelpfulLink[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;

  const links: BountyHelpfulLink[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const label = toCleanString((item as { label?: unknown }).label);
    const url = toCleanString((item as { url?: unknown }).url);

    if (!label && !url) continue;
    if (!label || !url) return null;

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
    } catch {
      return null;
    }

    links.push({ label, url });
  }

  return links;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const body = await parseJsonBody<UpdateBountyBody>(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const [existing] = await db
    .select({ id: bountyProject.id })
    .from(bountyProject)
    .where(eq(bountyProject.id, id));

  if (!existing) return NextResponse.json({ error: "Bounty not found" }, { status: 404 });

  const updates: Partial<{
    name: string;
    description: string;
    prizeUsd: number;
    helpfulLinks: BountyHelpfulLink[];
    completed: boolean;
    updatedAt: Date;
  }> = updatedTimestamp();

  if (body.name !== undefined) {
    const name = toCleanString(body.name);
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    updates.name = name;
  }

  if (body.description !== undefined) {
    const description = toCleanString(body.description);
    if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });
    updates.description = description;
  }

  if (body.prizeUsd !== undefined) {
    const prizeUsd = toPositiveInt(body.prizeUsd);
    if (!Number.isFinite(prizeUsd) || prizeUsd <= 0) {
      return NextResponse.json({ error: "Prize must be a positive USD amount" }, { status: 400 });
    }
    updates.prizeUsd = prizeUsd;
  }

  if (body.helpfulLinks !== undefined) {
    const helpfulLinks = toHelpfulLinks(body.helpfulLinks);
    if (!helpfulLinks) {
      return NextResponse.json({ error: "Helpful links must be valid label + URL pairs" }, { status: 400 });
    }
    updates.helpfulLinks = helpfulLinks;
  }

  if (body.completed !== undefined) {
    if (typeof body.completed !== "boolean") {
      return NextResponse.json({ error: "Completed must be a boolean" }, { status: 400 });
    }
    updates.completed = body.completed;
  }

  await db.update(bountyProject).set(updates).where(eq(bountyProject.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const [existing] = await db
    .select({ id: bountyProject.id })
    .from(bountyProject)
    .where(eq(bountyProject.id, id));

  if (!existing) return NextResponse.json({ error: "Bounty not found" }, { status: 404 });

  await db.delete(bountyProject).where(eq(bountyProject.id, id));

  return NextResponse.json({ success: true });
}
