// Auth failures against Hackatime, kept in a module with no DB imports so API
// routes can recognise them even in tests that mock "@/lib/hackatime".

export type HackatimeAuthErrorReason = "not_connected" | "revoked";

const HACKATIME_AUTH_ERROR_NAME = "HackatimeAuthError";

export function defaultHackatimeAuthMessage(reason: HackatimeAuthErrorReason) {
  return reason === "revoked"
    ? "Carnival's access to your Hackatime account is no longer valid. Reconnect Hackatime from Account settings and try again."
    : "Connect your Hackatime account to continue.";
}

/**
 * Carnival cannot act on a user's behalf against Hackatime. Either the user
 * never connected (`not_connected`), or Hackatime rejected the stored token
 * (`revoked`) — typically because the user removed Carnival from Hackatime's
 * Authorized Applications. A revoked token never recovers; the user has to run
 * the OAuth flow again.
 */
export class HackatimeAuthError extends Error {
  readonly reason: HackatimeAuthErrorReason;

  constructor(reason: HackatimeAuthErrorReason, message?: string) {
    super(message ?? defaultHackatimeAuthMessage(reason));
    this.name = HACKATIME_AUTH_ERROR_NAME;
    this.reason = reason;
  }
}

export function isHackatimeAuthError(error: unknown): error is HackatimeAuthError {
  if (error instanceof HackatimeAuthError) return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; reason?: unknown };
  return (
    candidate.name === HACKATIME_AUTH_ERROR_NAME &&
    (candidate.reason === "not_connected" || candidate.reason === "revoked")
  );
}

/**
 * Message for reviewers and admins: the token that failed belongs to the
 * project creator, so only the creator can fix it.
 */
export function describeCreatorHackatimeAuthError(error: HackatimeAuthError) {
  return error.reason === "revoked"
    ? "The project creator's Hackatime connection is no longer valid. Ask them to reconnect Hackatime from their Account settings, then try again."
    : "The project creator has not connected Hackatime. Ask them to connect it from their Account settings, then try again.";
}
