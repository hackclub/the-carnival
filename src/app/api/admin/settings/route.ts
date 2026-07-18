import { NextResponse } from "next/server";
import { appendAdminAudit } from "@/lib/admin-audit";
import {
  getAllSiteSettings,
  getSiteSettingIso,
  isSiteSettingKey,
  parseIsoDeadline,
  setSiteSettingIso,
} from "@/lib/site-settings";
import { getServerSession } from "@/lib/server-session";

type SettingsPatchBody = {
  key?: unknown;
  value?: unknown;
};

async function requireAdmin() {
  const session = await getServerSession();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: unknown } | undefined)?.role;

  if (!currentUserId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { currentUserId };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const settings = await getAllSiteSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: SettingsPatchBody;
  try {
    body = (await req.json()) as SettingsPatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isSiteSettingKey(body.key)) {
    return NextResponse.json({ error: "Unknown setting key" }, { status: 400 });
  }
  const key = body.key;

  const parsed = parseIsoDeadline(body.value);
  if (!parsed) {
    return NextResponse.json(
      { error: "Value must be an ISO-8601 UTC datetime, e.g. 2026-07-31T23:59:59Z" },
      { status: 400 },
    );
  }

  const previous = await getSiteSettingIso(key);
  await setSiteSettingIso(key, parsed.toISOString(), auth.currentUserId);

  await appendAdminAudit({
    actorId: auth.currentUserId,
    actorRole: "admin",
    action: "site_setting_updated",
    details: { key, from: previous, to: parsed.toISOString() },
  });

  const settings = await getAllSiteSettings();
  return NextResponse.json({ settings });
}
