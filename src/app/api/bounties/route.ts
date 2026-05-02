import { NextResponse } from "next/server";
import { desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { bountyClaim, bountyProject, user as userTable } from "@/db/schema";
import {
  getAuthUser,
  parseJsonBody,
  toCleanString,
  toPositiveInt,
  generateId,
  timestamps,
} from "@/lib/api-utils";
import { getFrozenAccountMessage, getFrozenAccountState } from "@/lib/frozen-account";
import { isValidHttpUrl, toBountyHelpfulLinks } from "@/lib/bounties";

type CreateBountyBody = {
  name?: unknown;
  description?: unknown;
  prizeUsd?: unknown;
  previewImageUrl?: unknown;
  requirements?: unknown;
  examples?: unknown;
  helpfulLinks?: unknown;
};

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const query = db
    .select({
      id: bountyProject.id,
      name: bountyProject.name,
      description: bountyProject.description,
      prizeUsd: bountyProject.prizeUsd,
      status: bountyProject.status,
      previewImageUrl: bountyProject.previewImageUrl,
      requirements: bountyProject.requirements,
      examples: bountyProject.examples,
      helpfulLinks: bountyProject.helpfulLinks,
      completed: bountyProject.completed,
      createdById: bountyProject.createdById,
      authorName: userTable.name,
      reviewedById: bountyProject.reviewedById,
      reviewedAt: bountyProject.reviewedAt,
      rejectionReason: bountyProject.rejectionReason,
      createdAt: bountyProject.createdAt,
    })
    .from(bountyProject)
    .leftJoin(userTable, eq(bountyProject.createdById, userTable.id));

  const projects = await (user.isAdmin
    ? query.orderBy(desc(bountyProject.createdAt))
    : query
        .where(or(eq(bountyProject.status, "approved"), eq(bountyProject.createdById, user.id)))
        .orderBy(desc(bountyProject.createdAt)));

  const claims = await db
    .select({
      bountyProjectId: bountyClaim.bountyProjectId,
      userId: bountyClaim.userId,
    })
    .from(bountyClaim);

  const claimsByProject = new Map<string, Set<string>>();
  for (const c of claims) {
    const set = claimsByProject.get(c.bountyProjectId) ?? new Set<string>();
    set.add(c.userId);
    claimsByProject.set(c.bountyProjectId, set);
  }

  return NextResponse.json({
    projects: projects.map((p) => {
      const set = claimsByProject.get(p.id) ?? new Set<string>();
      return {
        ...p,
        helpfulLinks: Array.isArray(p.helpfulLinks) ? p.helpfulLinks : [],
        claimedCount: set.size,
        claimedByMe: set.has(user.id),
        createdAt: p.createdAt.toISOString(),
        reviewedAt: p.reviewedAt ? p.reviewedAt.toISOString() : null,
      };
    }),
  });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const freezeState = await getFrozenAccountState(user.id);
  if (freezeState.isFrozen) {
    return NextResponse.json(
      { error: getFrozenAccountMessage(freezeState.frozenReason), code: "account_frozen" },
      { status: 403 },
    );
  }

  const body = await parseJsonBody<CreateBountyBody>(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const name = toCleanString(body.name);
  const description = toCleanString(body.description);
  const prizeUsd = toPositiveInt(body.prizeUsd);
  const previewImageUrl = toCleanString(body.previewImageUrl);
  const requirements = toCleanString(body.requirements);
  const examples = toCleanString(body.examples);
  const helpfulLinks = toBountyHelpfulLinks(body.helpfulLinks);

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });
  if (!Number.isFinite(prizeUsd) || prizeUsd <= 0) {
    return NextResponse.json({ error: "Prize must be a positive USD amount" }, { status: 400 });
  }
  if (previewImageUrl && !isValidHttpUrl(previewImageUrl)) {
    return NextResponse.json({ error: "Preview image must be http(s)" }, { status: 400 });
  }
  if (!helpfulLinks) {
    return NextResponse.json({ error: "Helpful links must be valid label + URL pairs" }, { status: 400 });
  }

  const id = generateId();
  const now = new Date();
  const status = user.isAdmin ? "approved" : "pending";

  await db.insert(bountyProject).values({
    id,
    name,
    description,
    prizeUsd,
    status,
    previewImageUrl: previewImageUrl || null,
    requirements,
    examples,
    helpfulLinks,
    createdById: user.id,
    reviewedById: user.isAdmin ? user.id : null,
    reviewedAt: user.isAdmin ? now : null,
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id, status }, { status: 201 });
}
