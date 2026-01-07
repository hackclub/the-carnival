import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { bountyClaim, bountyProject } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

type CreateBountyBody = {
  name?: unknown;
  description?: unknown;
  prizeUsd?: unknown;
};

function toCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toPrizeUsd(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string" && value.trim()) return Math.floor(Number(value));
  return NaN;
}

export async function GET() {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await db
    .select({
      id: bountyProject.id,
      name: bountyProject.name,
      description: bountyProject.description,
      prizeUsd: bountyProject.prizeUsd,
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
        claimedCount: set.size,
        claimedByMe: set.has(userId),
      };
    }),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: CreateBountyBody;
  try {
    body = (await req.json()) as CreateBountyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = toCleanString(body.name);
  const description = toCleanString(body.description);
  const prizeUsd = toPrizeUsd(body.prizeUsd);

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });
  if (!Number.isFinite(prizeUsd) || prizeUsd <= 0) {
    return NextResponse.json({ error: "Prize must be a positive dollar amount" }, { status: 400 });
  }

  const now = new Date();
  const id = randomUUID();

  await db.insert(bountyProject).values({
    id,
    name,
    description,
    prizeUsd,
    createdById: userId,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id }, { status: 201 });
}


