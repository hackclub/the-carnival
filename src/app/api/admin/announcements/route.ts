import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { announcement } from "@/db/schema";
import { appendAdminAudit } from "@/lib/admin-audit";
import {
  bustAnnouncementCache,
  getAllAnnouncements,
  parseAnnouncementInput,
} from "@/lib/announcements";
import { getAuthUser } from "@/lib/api-utils";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const announcements = await getAllAnnouncements();
  return NextResponse.json({ announcements });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseAnnouncementInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const now = new Date();
  const id = randomUUID();
  await db.insert(announcement).values({
    id,
    message: parsed.value.message,
    href: parsed.value.href,
    linkLabel: parsed.value.linkLabel,
    variant: parsed.value.variant,
    isActive: parsed.value.isActive,
    startsAt: parsed.value.startsAt,
    endsAt: parsed.value.endsAt,
    createdByUserId: user.id,
    createdAt: now,
    updatedAt: now,
  });
  bustAnnouncementCache();

  await appendAdminAudit({
    actorId: user.id,
    actorRole: "admin",
    action: "announcement_created",
    details: { announcementId: id, message: parsed.value.message.slice(0, 200) },
  });

  const announcements = await getAllAnnouncements();
  return NextResponse.json({ announcements }, { status: 201 });
}
