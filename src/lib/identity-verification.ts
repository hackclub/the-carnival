import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";

/**
 * The user's Hack Club Auth verification status. The stored value is only
 * synced at sign-in, so until it reads "verified" we re-check it live and save
 * any change — otherwise users who verified after signing in stay blocked.
 */
export async function getIdentityVerificationStatus(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ status: user.verificationStatus, token: user.identityToken })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!row) return null;
  if (row.status === "verified" || !row.token) return row.status;

  const live = await fetchVerificationStatus(row.token);
  if (live && live !== row.status) {
    await db
      .update(user)
      .set({ verificationStatus: live, updatedAt: new Date() })
      .where(eq(user.id, userId));
  }
  return live ?? row.status;
}

// GET /api/v1/me → identity.verification_status. Null if the call fails.
async function fetchVerificationStatus(token: string): Promise<string | null> {
  const host = process.env.HC_IDENTITY_HOST ?? "https://auth.hackclub.com";
  try {
    const res = await fetch(`${host}/api/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { identity?: { verification_status?: unknown } };
    const status = body.identity?.verification_status;
    return typeof status === "string" ? status : null;
  } catch {
    return null;
  }
}
