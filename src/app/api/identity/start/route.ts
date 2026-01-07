import { NextResponse } from "next/server";

const clientId = process.env.HC_IDENTITY_CLIENT_ID!;
const clientSecret = process.env.HC_IDENTITY_CLIENT_SECRET!;
const discoveryUrl = process.env.HC_IDENTITY_REDIRECT_URI!;

export async function GET(request: Request) {
    void clientSecret;
    void request;
    const host = "https://hca.dinosaurbbq.org";
    const baseUrl = `${host}/oauth/authorize/`;
    const url = new URL(baseUrl);

    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", discoveryUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "profile email name slack_id verification_status");

    return NextResponse.redirect(url.toString());
}
