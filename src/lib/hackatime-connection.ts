// Pure helpers for the Hackatime connection state. No DB or server imports so
// client components (account page, in-app banner) can share them.

export type HackatimeConnectionStatus = "connected" | "needs_reconnect" | "not_connected";

/**
 * - `connected`: a working OAuth token is stored.
 * - `needs_reconnect`: Carnival was connected before but the token is gone,
 *   which happens when Hackatime revokes it and we drop it on the next 401.
 * - `not_connected`: never connected, or the user disconnected on purpose.
 */
export function deriveHackatimeConnectionStatus(input: {
  hasToken: boolean;
  connectedAt: Date | string | null | undefined;
}): HackatimeConnectionStatus {
  if (input.hasToken) return "connected";
  return input.connectedAt ? "needs_reconnect" : "not_connected";
}

/** Starts (or restarts) the Hackatime OAuth flow and returns to `returnTo`. */
export function hackatimeConnectUrl(returnTo: string) {
  const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/projects";
  return `/api/hackatime/oauth/start?returnTo=${encodeURIComponent(safeReturnTo)}`;
}
