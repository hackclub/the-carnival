import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { announcement } from "@/db/schema";
import { appendAdminAudit } from "@/lib/admin-audit";
import {
  bustAnnouncementCache,
  getAllAnnouncements,
  parseAnnouncementInput,
} from "@/lib/announcements";
import { getAuthUser } from "@/lib/api-utils";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseAnnouncementInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const updated = await db
    .update(announcement)
    .set({
      message: parsed.value.message,
      href: parsed.value.href,
      linkLabel: parsed.value.linkLabel,
      variant: parsed.value.variant,
      isActive: parsed.value.isActive,
      startsAt: parsed.value.startsAt,
      endsAt: parsed.value.endsAt,
      updatedAt: new Date(),
    })
    .where(eq(announcement.id, id))
    .returning({ id: announcement.id });

  if (updated.length === 0) {
    return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  }
  bustAnnouncementCache();

  await appendAdminAudit({
    actorId: user.id,
    actorRole: "admin",
    action: "announcement_updated",
    details: {
      announcementId: id,
      message: parsed.value.message.slice(0, 200),
      isActive: parsed.value.isActive,
    },
  });

  const announcements = await getAllAnnouncements();
  return NextResponse.json({ announcements });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  const deleted = await db
    .delete(announcement)
    .where(eq(announcement.id, id))
    .returning({ id: announcement.id, message: announcement.message });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  }
  bustAnnouncementCache();

  await appendAdminAudit({
    actorId: user.id,
    actorRole: "admin",
    action: "announcement_deleted",
    details: { announcementId: id, message: deleted[0]!.message.slice(0, 200) },
  });

  const announcements = await getAllAnnouncements();
  return NextResponse.json({ announcements });
}
