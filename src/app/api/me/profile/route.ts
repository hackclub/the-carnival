import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";
import { parseJsonBody, toCleanString } from "@/lib/api-utils";

type ProfilePatchBody = {
  birthday?: unknown;
  addressLine1?: unknown;
  addressLine2?: unknown;
  city?: unknown;
  stateProvince?: unknown;
  country?: unknown;
  zipPostalCode?: unknown;
};

function toNullableString(value: unknown) {
  const s = toCleanString(value);
  return s ? s : null;
}

function toNullableIsoDate(value: unknown) {
  const s = toCleanString(value);
  if (!s) return null;
  // Expect YYYY-MM-DD (from <input type="date">).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

export async function GET() {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      birthday: user.birthday,
      addressLine1: user.addressLine1,
      addressLine2: user.addressLine2,
      city: user.city,
      stateProvince: user.stateProvince,
      country: user.country,
      zipPostalCode: user.zipPostalCode,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const profile = rows[0];
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ profile });
}

export async function PATCH(req: Request) {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseJsonBody<ProfilePatchBody>(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const set = {
    birthday: body.birthday !== undefined ? toNullableIsoDate(body.birthday) : undefined,
    addressLine1: body.addressLine1 !== undefined ? toNullableString(body.addressLine1) : undefined,
    addressLine2: body.addressLine2 !== undefined ? toNullableString(body.addressLine2) : undefined,
    city: body.city !== undefined ? toNullableString(body.city) : undefined,
    stateProvince: body.stateProvince !== undefined ? toNullableString(body.stateProvince) : undefined,
    country: body.country !== undefined ? toNullableString(body.country) : undefined,
    zipPostalCode: body.zipPostalCode !== undefined ? toNullableString(body.zipPostalCode) : undefined,
    updatedAt: new Date(),
  } as const;

  // Drizzle doesn't like `undefined` in `.set()`. Build a clean object.
  const updates: Partial<typeof set> = {};
  for (const [k, v] of Object.entries(set)) {
    if (v !== undefined) (updates as Record<string, unknown>)[k] = v;
  }

  if (Object.keys(updates).length === 1 && "updatedAt" in updates) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await db
    .update(user)
    .set(updates)
    .where(eq(user.id, userId))
    .returning({
      birthday: user.birthday,
      addressLine1: user.addressLine1,
      addressLine2: user.addressLine2,
      city: user.city,
      stateProvince: user.stateProvince,
      country: user.country,
      zipPostalCode: user.zipPostalCode,
    });

  return NextResponse.json({ profile: updated[0] ?? null });
}

