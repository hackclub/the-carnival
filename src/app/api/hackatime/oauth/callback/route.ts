import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getServerSession } from "@/lib/server-session";
import { fetchHackatimeIdentityFromToken } from "@/lib/hackatime";

const OAUTH_STATE_COOKIE = "hackatime_oauth_state";
const OAUTH_RETURN_COOKIE = "hackatime_oauth_return_to";

type TokenResponse = {
  access_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

function withStatusParam(returnTo: string, status: string) {
  const sep = returnTo.includes("?") ? "&" : "?";
  return `${returnTo}${sep}hackatime=${encodeURIComponent(status)}`;
}

function normalizeReturnTo(value: string | null) {
  const v = (value ?? "").trim();
  if (!v.startsWith("/")) return "/projects";
  return v;
}

export async function GET(request: Request) {
  const session = await getServerSession({ disableCookieCache: true });
  const appUserId = (session?.user as { id?: string } | undefined)?.id;
  if (!appUserId) {
    return NextResponse.redirect(new URL("/login?callbackUrl=/projects?new=1", request.url));
  }

  const reqUrl = new URL(request.url);
  const incomingState = reqUrl.searchParams.get("state")?.trim() || "";
  const code = reqUrl.searchParams.get("code")?.trim() || "";
  const oauthError = reqUrl.searchParams.get("error")?.trim() || "";

  const jar = await cookies();
  const storedState = jar.get(OAUTH_STATE_COOKIE)?.value ?? "";
  const returnTo = normalizeReturnTo(jar.get(OAUTH_RETURN_COOKIE)?.value ?? null);
  jar.delete(OAUTH_STATE_COOKIE);
  jar.delete(OAUTH_RETURN_COOKIE);

  if (!incomingState || !storedState || incomingState !== storedState) {
    return NextResponse.redirect(new URL(withStatusParam(returnTo, "invalid_state"), request.url));
  }

  if (oauthError) {
    return NextResponse.redirect(new URL(withStatusParam(returnTo, "denied"), request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL(withStatusParam(returnTo, "missing_code"), request.url));
  }

  const clientId = process.env.HACKATIME_OAUTH_CLIENT_ID;
  const clientSecret = process.env.HACKATIME_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.HACKATIME_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.redirect(
      new URL(withStatusParam(returnTo, "oauth_not_configured"), request.url),
    );
  }

  const tokenBody = new URLSearchParams({
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  if (clientSecret) {
    tokenBody.set("client_secret", clientSecret);
  }

  const tokenRes = await fetch("https://hackatime.hackclub.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenBody.toString(),
  });

  const tokenData = (await tokenRes.json().catch(() => ({}))) as TokenResponse;
  const accessToken = typeof tokenData.access_token === "string" ? tokenData.access_token.trim() : "";
  if (!tokenRes.ok || !accessToken) {
    return NextResponse.redirect(
      new URL(withStatusParam(returnTo, "token_exchange_failed"), request.url),
    );
  }

  const identity = await fetchHackatimeIdentityFromToken(accessToken);
  const now = new Date();

  await db
    .update(user)
    .set({
      hackatimeAccessToken: accessToken,
      hackatimeScope: typeof tokenData.scope === "string" ? tokenData.scope : "profile read",
      hackatimeUserId: identity.userId,
      hackatimeConnectedAt: now,
      updatedAt: now,
    })
    .where(eq(user.id, appUserId));

  return NextResponse.redirect(new URL(withStatusParam(returnTo, "connected"), request.url));
}
