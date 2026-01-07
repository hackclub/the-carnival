import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, userRole } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";

type AdminUserPatchBody = {
  role?: unknown;
};

function isAdmin(role: unknown): role is "admin" {
  return role === "admin";
}

const validRoles = userRole.enumValues;

function isValidRole(value: unknown): value is (typeof validRoles)[number] {
  return typeof value === "string" && validRoles.includes(value as (typeof validRoles)[number]);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;

  if (!currentUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: targetUserId } = await ctx.params;

  // Prevent admins from changing their own role (safety measure)
  if (targetUserId === currentUserId) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  let body: AdminUserPatchBody;
  try {
    body = (await req.json()) as AdminUserPatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidRole(body.role)) {
    return NextResponse.json(
      { error: `Invalid role. Allowed: ${validRoles.join(", ")}` },
      { status: 400 }
    );
  }

  const now = new Date();
  const updated = await db
    .update(user)
    .set({ role: body.role, updatedAt: now })
    .where(eq(user.id, targetUserId))
    .returning({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      updatedAt: user.updatedAt,
    });

  const u = updated[0];
  if (!u) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ user: u });
}

