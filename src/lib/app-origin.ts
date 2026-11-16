/** The app's public origin: the configured URL when valid, otherwise the request's own origin. */
export function getAppOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "";
  if (configured) {
    try {
      const u = new URL(configured);
      if (u.protocol === "http:" || u.protocol === "https:") return u.origin;
    } catch {
      // Fallback to request origin.
    }
  }
  return new URL(request.url).origin;
}
