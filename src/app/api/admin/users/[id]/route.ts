import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, userRole } from "@/db/schema";
import { appendAdminAudit } from "@/lib/admin-audit";
import { toCleanString } from "@/lib/api-utils";
import { getServerSession } from "@/lib/server-session";

type AdminUserPatchBody = {
  role?: unknown;
  freeze?: unknown;
  reason?: unknown;
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

  let body: AdminUserPatchBody;
  try {
    body = (await req.json()) as AdminUserPatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const hasRoleUpdate = body.role !== undefined;
  const hasFreezeUpdate = body.freeze !== undefined;

  if (!hasRoleUpdate && !hasFreezeUpdate) {
    return NextResponse.json({ error: "No supported fields to update" }, { status: 400 });
  }

  if (hasRoleUpdate && hasFreezeUpdate) {
    return NextResponse.json(
      { error: "Update role or freeze state in separate requests" },
      { status: 400 },
    );
  }

  // Prevent admins from changing their own role or freeze state (safety measure).
  if (targetUserId === currentUserId) {
    return NextResponse.json(
      { error: "Cannot update your own role or freeze state" },
      { status: 400 },
    );
  }

  const targetRows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isFrozen: user.isFrozen,
      frozenReason: user.frozenReason,
      frozenAt: user.frozenAt,
      frozenByUserId: user.frozenByUserId,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1);

  const target = targetRows[0];
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (hasRoleUpdate) {
    if (!isValidRole(body.role)) {
      return NextResponse.json(
        { error: `Invalid role. Allowed: ${validRoles.join(", ")}` },
        { status: 400 },
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
        isFrozen: user.isFrozen,
        frozenReason: user.frozenReason,
        frozenAt: user.frozenAt,
        updatedAt: user.updatedAt,
      });

    const updatedUser = updated[0];
    if (!updatedUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({ user: updatedUser });
  }

  const freeze = body.freeze === true ? true : body.freeze === false ? false : null;
  if (freeze === null) {
    return NextResponse.json({ error: "freeze must be a boolean" }, { status: 400 });
  }

  const reason = toCleanString(body.reason);
  if (!reason) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  if (target.isFrozen === freeze) {
    return NextResponse.json(
      { error: freeze ? "User is already frozen" : "User is already active" },
      { status: 409 },
    );
  }

  const now = new Date();

  const updatedUser = await db.transaction(async (tx) => {
    const rows = await tx
      .update(user)
      .set(
        freeze
          ? {
              isFrozen: true,
              frozenReason: reason,
              frozenAt: now,
              frozenByUserId: currentUserId,
              updatedAt: now,
            }
          : {
              isFrozen: false,
              frozenReason: null,
              frozenAt: null,
              frozenByUserId: null,
              updatedAt: now,
            },
      )
      .where(eq(user.id, targetUserId))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isFrozen: user.isFrozen,
        frozenReason: user.frozenReason,
        frozenAt: user.frozenAt,
        frozenByUserId: user.frozenByUserId,
        updatedAt: user.updatedAt,
      });

    const updated = rows[0];
    if (!updated) return null;

    await appendAdminAudit(
      {
        actorId: currentUserId,
        actorRole: "admin",
        action: freeze ? "user_frozen" : "user_unfrozen",
        targetUserId,
        details: {
          reason,
          previousFrozenState: target.isFrozen,
          nextFrozenState: freeze,
          targetRole: target.role,
        },
        at: now,
      },
      tx,
    );

    return updated;
  });

  if (!updatedUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ user: updatedUser });
}
