import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bountyProject } from "@/db/schema";
import { getAuthUser, parseJsonBody, updatedTimestamp } from "@/lib/api-utils";

type UpdateBountyBody = {
  completed?: unknown;
};

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
    completed: boolean;
    updatedAt: Date;
  }> = updatedTimestamp();

  if (body.completed !== undefined) {
    updates.completed = Boolean(body.completed);
  }

  await db.update(bountyProject).set(updates).where(eq(bountyProject.id, id));

  return NextResponse.json({ success: true });
}
