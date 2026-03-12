import { headers } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { account, session as sessionTable } from "@/db/schema";
import { auth } from "@/lib/auth";

const REQUIRED_IDENTITY_SCOPES = ["address", "birthdate"] as const;
const ENFORCE_IDENTITY_SCOPE_REAUTH = process.env.ENFORCE_IDENTITY_SCOPE_REAUTH === "1";

function parseScopes(scope: string | null | undefined): Set<string> {
  if (!scope) return new Set();
  return new Set(
    scope
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function hasRequiredIdentityScopes(scope: string | null | undefined): boolean {
  const scopes = parseScopes(scope);
  return REQUIRED_IDENTITY_SCOPES.every((required) => scopes.has(required));
}

export async function getServerSession(options?: {
  disableCookieCache?: boolean;
  disableRefresh?: boolean;
}) {
  // Mark any route that calls `getServerSession()` as dynamic (prevents build-time prerender
  // from trying to hit the DB in Docker builds).
  noStore();

  // Next 16 returns a ReadonlyHeaders wrapped in AsyncLocalStorage internals.
  // Better Auth expects a real `Headers` (or a plain header map), so convert it.
  const h = await headers();
  const clean = new Headers();
  for (const [key, value] of h.entries()) {
    clean.set(key, value);
  }

  const currentSession = await auth.api.getSession({ headers: clean, query: options });
  const userId = (currentSession?.user as { id?: string } | undefined)?.id;
  if (!userId) return currentSession;
  if (!ENFORCE_IDENTITY_SCOPE_REAUTH) return currentSession;

  const identityAccount = await db
    .select({ scope: account.scope })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "hackclub-identity")))
    .limit(1);

  if (!identityAccount[0]) {
    return currentSession;
  }

  const scope = identityAccount[0].scope;
  if (!scope?.trim()) {
    // Some providers/flows may not persist account.scope reliably.
    // Don't force-logout in that case to avoid auth loops.
    return currentSession;
  }
  if (hasRequiredIdentityScopes(scope)) {
    return currentSession;
  }

  // Force re-auth when older sessions don't have the required identity scopes.
  await db.delete(sessionTable).where(eq(sessionTable.userId, userId));
  return null;
}


