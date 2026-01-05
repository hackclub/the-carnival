import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function getServerSession(options?: {
  disableCookieCache?: boolean;
  disableRefresh?: boolean;
}) {
  // Next 16 returns a ReadonlyHeaders wrapped in AsyncLocalStorage internals.
  // Better Auth expects a real `Headers` (or a plain header map), so convert it.
  const h = await headers();
  const clean = new Headers();
  for (const [key, value] of h.entries()) {
    clean.set(key, value);
  }

  return auth.api.getSession({ headers: clean, query: options });
}


