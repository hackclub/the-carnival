import { headers } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { auth } from "@/lib/auth";

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

  return auth.api.getSession({ headers: clean, query: options });
}


