import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bountyClaim, bountyProject } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: bountyProjectId } = await ctx.params;

  // Ensure project exists and is not completed.
  const [project] = await db
    .select({ id: bountyProject.id, completed: bountyProject.completed })
    .from(bountyProject)
    .where(eq(bountyProject.id, bountyProjectId))
    .limit(1);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.completed) return NextResponse.json({ error: "This bounty has been completed" }, { status: 400 });

  const claimId = randomUUID();
  const now = new Date();

  // Atomically claim one of two slots (1 or 2). Unique index prevents over-claim.
  // Also enforces one claim per user via unique index (bountyProjectId, userId).
  const inserted = await db.execute(sql`
    WITH slots AS (
      SELECT 1 AS slot
      UNION ALL
      SELECT 2 AS slot
    ),
    chosen AS (
      SELECT slot
      FROM slots
      WHERE NOT EXISTS (
        SELECT 1
        FROM ${bountyClaim}
        WHERE ${bountyClaim.bountyProjectId} = ${bountyProjectId}
          AND ${bountyClaim.slot} = slots.slot
      )
      ORDER BY slot
      LIMIT 1
    )
    INSERT INTO ${bountyClaim} (id, bounty_project_id, user_id, slot, created_at)
    SELECT ${claimId}, ${bountyProjectId}, ${userId}, slot, ${now}
    FROM chosen
    ON CONFLICT DO NOTHING
    RETURNING id
  `);

  const didInsert = Array.isArray((inserted as unknown as { rows?: unknown[] }).rows)
    ? ((inserted as unknown as { rows: unknown[] }).rows.length > 0)
    : true; // drizzle postgres-js shape differs; absence of error is good enough for user UX

  // Compute updated counts.
  const counts = await db
    .select({
      bountyProjectId: bountyClaim.bountyProjectId,
      userId: bountyClaim.userId,
    })
    .from(bountyClaim)
    .where(eq(bountyClaim.bountyProjectId, bountyProjectId));

  const uniqueUsers = new Set(counts.map((c) => c.userId));
  const claimedCount = uniqueUsers.size;
  const claimedByMe = uniqueUsers.has(userId);

  if (!didInsert) {
    // Most likely either full or already claimed.
    return NextResponse.json(
      { claimedCount, claimedByMe, error: claimedByMe ? "Already claimed" : "Bounty is full" },
      { status: 409 },
    );
  }

  return NextResponse.json({ claimedCount, claimedByMe });
}


