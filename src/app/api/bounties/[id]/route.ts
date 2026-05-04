import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bountyProject, type BountyHelpfulLink, type BountyProjectStatus } from "@/db/schema";
import { getAuthUser, parseJsonBody, toCleanString, toPositiveInt } from "@/lib/api-utils";
import { isValidHttpUrl, toBountyHelpfulLinks } from "@/lib/bounties";

type UpdateBountyBody = {
  name?: unknown;
  description?: unknown;
  prizeUsd?: unknown;
  previewImageUrl?: unknown;
  requirements?: unknown;
  examples?: unknown;
  helpfulLinks?: unknown;
  completed?: unknown;
  status?: unknown;
  rejectionReason?: unknown;
};

function isBountyProjectStatus(value: unknown): value is BountyProjectStatus {
  return value === "pending" || value === "approved" || value === "rejected";
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
    .select({ id: bountyProject.id, status: bountyProject.status })
    .from(bountyProject)
    .where(eq(bountyProject.id, id));

  if (!existing) return NextResponse.json({ error: "Bounty not found" }, { status: 404 });

  const now = new Date();
  const updates: Partial<{
    name: string;
    description: string;
    prizeUsd: number;
    status: BountyProjectStatus;
    previewImageUrl: string | null;
    requirements: string;
    examples: string;
    helpfulLinks: BountyHelpfulLink[];
    completed: boolean;
    reviewedById: string | null;
    reviewedAt: Date | null;
    rejectionReason: string | null;
    updatedAt: Date;
  }> = { updatedAt: now };

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
    const helpfulLinks = toBountyHelpfulLinks(body.helpfulLinks);
    if (!helpfulLinks) {
      return NextResponse.json({ error: "Helpful links must be valid label + URL pairs" }, { status: 400 });
    }
    updates.helpfulLinks = helpfulLinks;
  }

  if (body.previewImageUrl !== undefined) {
    const previewImageUrl = toCleanString(body.previewImageUrl);
    if (previewImageUrl && !isValidHttpUrl(previewImageUrl)) {
      return NextResponse.json({ error: "Preview image must be http(s)" }, { status: 400 });
    }
    updates.previewImageUrl = previewImageUrl || null;
  }

  if (body.requirements !== undefined) {
    updates.requirements = toCleanString(body.requirements);
  }

  if (body.examples !== undefined) {
    updates.examples = toCleanString(body.examples);
  }

  if (body.completed !== undefined) {
    if (typeof body.completed !== "boolean") {
      return NextResponse.json({ error: "Completed must be a boolean" }, { status: 400 });
    }
    updates.completed = body.completed;
  }

  if (body.status !== undefined) {
    if (!isBountyProjectStatus(body.status)) {
      return NextResponse.json(
        { error: "Invalid status. Allowed: pending, approved, rejected" },
        { status: 400 },
      );
    }
    updates.status = body.status;
    if (body.status === "approved") {
      updates.reviewedById = user.id;
      updates.reviewedAt = now;
      updates.rejectionReason = null;
    } else if (body.status === "rejected") {
      updates.reviewedById = user.id;
      updates.reviewedAt = now;
      updates.rejectionReason = toCleanString(body.rejectionReason) || null;
      updates.completed = false;
    } else {
      updates.reviewedById = null;
      updates.reviewedAt = null;
      updates.rejectionReason = null;
      updates.completed = false;
    }
  } else if (body.rejectionReason !== undefined) {
    updates.rejectionReason = toCleanString(body.rejectionReason) || null;
  }

  await db.update(bountyProject).set(updates).where(eq(bountyProject.id, id));

  return NextResponse.json({ success: true, status: updates.status ?? existing.status });
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
