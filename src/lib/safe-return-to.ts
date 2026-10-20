/**
 * Post-OAuth redirect targets (`returnTo`) come from the query string, so a
 * link like `/api/hackatime/oauth/start?returnTo=//evil.com` must never send
 * the user off-site once the callback resolves it against the app origin.
 *
 * Only same-origin relative paths are accepted; anything else falls back to
 * DEFAULT_RETURN_TO. The prefix checks reject the well-known tricks
 * (`//host`, `/\host`, encoded slashes in the first segment) and the final
 * `new URL` resolution is the backstop for anything the parser normalises
 * differently (it strips tabs/newlines, for example).
 */

export const DEFAULT_RETURN_TO = "/projects";

const PLACEHOLDER_ORIGIN = "http://localhost";

export function safeReturnTo(value: unknown, origin: string = PLACEHOLDER_ORIGIN): string {
  if (typeof value !== "string") return DEFAULT_RETURN_TO;
  const v = value.trim();
  if (!v.startsWith("/")) return DEFAULT_RETURN_TO;

  // "//evil.com" is protocol-relative; "/\evil.com" is normalised to it.
  const second = v.charAt(1);
  if (second === "/" || second === "\\") return DEFAULT_RETURN_TO;

  // Encoded slashes in the first segment can be decoded by proxies before
  // the browser sees them, which turns "/%2F%2Fevil.com" into "//evil.com".
  const firstSegment = v.slice(1).split(/[/?#]/, 1)[0] ?? "";
  if (/%2f|%5c/i.test(firstSegment)) return DEFAULT_RETURN_TO;

  let base: URL;
  try {
    base = new URL(origin);
  } catch {
    base = new URL(PLACEHOLDER_ORIGIN);
  }

  try {
    const resolved = new URL(v, base);
    if (resolved.origin !== base.origin) return DEFAULT_RETURN_TO;
  } catch {
    return DEFAULT_RETURN_TO;
  }

  return v;
}
