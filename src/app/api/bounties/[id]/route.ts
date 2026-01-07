import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bountyProject } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

type UpdateBountyBody = {
  completed?: unknown;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  let body: UpdateBountyBody;
  try {
    body = (await req.json()) as UpdateBountyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: bountyProject.id })
    .from(bountyProject)
    .where(eq(bountyProject.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  const updates: Partial<{
    completed: boolean;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (body.completed !== undefined) {
    updates.completed = Boolean(body.completed);
  }

  await db.update(bountyProject).set(updates).where(eq(bountyProject.id, id));

  return NextResponse.json({ success: true });
}

