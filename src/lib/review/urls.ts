/**
 * Shared URL validation for the review system.
 *
 * This replaces the four copy-pasted `isValidUrlString` helpers that used to
 * live in the project routes, airtable lib, and ManageProjectClient — every
 * URL rule (protocol, host allowlists/blocklists, forge-release detection)
 * now lives here so client and server can never disagree.
 *
 * All helpers are pure and isomorphic (no env reads) so the submission UI can
 * run the exact same checks the server enforces.
 */

/** Parse an http(s) URL. Returns null for anything else (ftp:, javascript:, garbage). */
export function parseHttpUrl(value: string | null | undefined): URL | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export function isValidHttpUrlString(value: string | null | undefined): boolean {
  return parseHttpUrl(value) !== null;
}

/**
 * True when `hostname` is `domain` or a subdomain of it.
 * hostMatchesDomain("git.sr.ht", "sr.ht") === true
 * hostMatchesDomain("evil-github.com", "github.com") === false
 */
export function hostMatchesDomain(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const base = domain.toLowerCase().replace(/\.$/, "");
  return host === base || host.endsWith(`.${base}`);
}

export function hostMatchesAny(hostname: string, domains: readonly string[]): boolean {
  return domains.some((domain) => hostMatchesDomain(hostname, domain));
}

/**
 * Hosts that can never be a public ship: loopback, link-local, private
 * ranges, and bare IPs. A playable URL must be reachable by any reviewer.
 */
export function isNonPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "0.0.0.0" || host === "127.0.0.1" || host === "::1" || host === "[::1]") return true;
  // Private IPv4 ranges (10/8, 172.16/12, 192.168/16).
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  return false;
}

/**
 * A "forge release" URL — a releases page or release artifact on an allowed
 * code host (e.g. github.com/user/repo/releases/..., codeberg release,
 * gitlab -/releases). Used as the playable-URL fallback for extensions and
 * plugins whose store requires a paid developer license.
 */
export function isForgeReleaseUrl(url: URL, codeHosts: readonly string[]): boolean {
  if (!hostMatchesAny(url.hostname, codeHosts)) return false;
  return /\/releases(\/|$)/.test(url.pathname) || /\/-\/releases(\/|$)/.test(url.pathname);
}

/** Extract the trailing file extension of a URL path (lowercase, no dot). */
export function urlPathExtension(url: URL): string | null {
  const lastSegment = url.pathname.split("/").pop() ?? "";
  const dot = lastSegment.lastIndexOf(".");
  if (dot <= 0) return null;
  return lastSegment.slice(dot + 1).toLowerCase();
}

/**
 * True when `value` is a URL served from `publicBaseUrl` (our R2 bucket).
 * Used to enforce that screenshots were uploaded through the platform rather
 * than pasted from an arbitrary host.
 */
export function isUrlOnPublicBase(value: string, publicBaseUrl: string): boolean {
  const url = parseHttpUrl(value);
  const base = parseHttpUrl(publicBaseUrl);
  if (!url || !base) return false;
  if (url.hostname.toLowerCase() !== base.hostname.toLowerCase()) return false;
  const basePath = base.pathname.replace(/\/+$/g, "");
  return url.pathname.startsWith(`${basePath}/`);
}
