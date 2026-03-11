import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";

const OAUTH_STATE_COOKIE = "hackatime_oauth_state";
const OAUTH_RETURN_COOKIE = "hackatime_oauth_return_to";

function getAppOrigin(request: Request) {
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

function normalizeReturnTo(value: string | null) {
  const v = (value ?? "").trim();
  if (!v.startsWith("/")) return "/projects";
  return v;
}

export async function GET(request: Request) {
  const appOrigin = getAppOrigin(request);
  const session = await getServerSession({ disableCookieCache: true });
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.redirect(new URL("/login?callbackUrl=%2Fprojects%3Fnew%3D1", appOrigin));
  }

  const clientId = process.env.HACKATIME_OAUTH_CLIENT_ID;
  const redirectUri = process.env.HACKATIME_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.redirect(
      new URL("/projects?new=1&hackatime=oauth_not_configured", appOrigin),
    );
  }

  const reqUrl = new URL(request.url);
  const returnTo = normalizeReturnTo(reqUrl.searchParams.get("returnTo"));
  const state = randomUUID();

  const jar = await cookies();
  jar.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  jar.set(OAUTH_RETURN_COOKIE, returnTo, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  const authUrl = new URL("https://hackatime.hackclub.com/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "profile read");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl);
}
