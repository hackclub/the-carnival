import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { bountyClaim, bountyProject, type BountyHelpfulLink } from "@/db/schema";
import {
  getAuthUser,
  parseJsonBody,
  toCleanString,
  toPositiveInt,
  generateId,
  timestamps,
} from "@/lib/api-utils";

type CreateBountyBody = {
  name?: unknown;
  description?: unknown;
  prizeUsd?: unknown;
  helpfulLinks?: unknown;
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

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await db
    .select({
      id: bountyProject.id,
      name: bountyProject.name,
      description: bountyProject.description,
      prizeUsd: bountyProject.prizeUsd,
      helpfulLinks: bountyProject.helpfulLinks,
      completed: bountyProject.completed,
      createdAt: bountyProject.createdAt,
    })
    .from(bountyProject)
    .orderBy(desc(bountyProject.createdAt));

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
      };
    }),
  });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await parseJsonBody<CreateBountyBody>(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const name = toCleanString(body.name);
  const description = toCleanString(body.description);
  const prizeUsd = toPositiveInt(body.prizeUsd);
  const helpfulLinks = toHelpfulLinks(body.helpfulLinks);

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });
  if (!Number.isFinite(prizeUsd) || prizeUsd <= 0) {
    return NextResponse.json({ error: "Prize must be a positive USD amount" }, { status: 400 });
  }
  if (!helpfulLinks) {
    return NextResponse.json({ error: "Helpful links must be valid label + URL pairs" }, { status: 400 });
  }

  const id = generateId();

  await db.insert(bountyProject).values({
    id,
    name,
    description,
    prizeUsd,
    helpfulLinks,
    createdById: user.id,
    ...timestamps(),
  });

  return NextResponse.json({ id }, { status: 201 });
}
