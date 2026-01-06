import { betterAuth, OAuth2UserInfo } from "better-auth";
import { createFieldAttribute } from "better-auth/db";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";

const identityHost = process.env.HC_IDENTITY_HOST!;
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  // Ensure these custom columns are selected and included on `session.user`.
  user: {
    additionalFields: {
      slackId: createFieldAttribute("string", { required: false }),
      verificationStatus: createFieldAttribute("string", { required: false }),
      role: createFieldAttribute("string", { required: false }),
    },
  },
  emailAndPassword: {
    enabled: false,
  },
  plugins: [
    genericOAuth({
      config: [
        {
          // Use a URL-safe provider id (it becomes part of the callback route).
          providerId: "hackclub-identity",
          clientId: process.env.HC_IDENTITY_CLIENT_ID!,
          clientSecret: process.env.HC_IDENTITY_CLIENT_SECRET!,
          discoveryUrl: `${identityHost}/.well-known/openid-configuration`,
          redirectURI: process.env.HC_IDENTITY_REDIRECT_URI!,
          // These claims are supported by the provider; scopes_supported lists at least openid/profile.
          scopes: ['profile', 'email', 'name', 'slack_id', 'verification_status'],
          // add "basic_info" and "addresses" after being officialized

          getToken: async ({ code, redirectURI }) => {
            const clientId = process.env.HC_IDENTITY_CLIENT_ID!;
            const clientSecret = process.env.HC_IDENTITY_CLIENT_SECRET!;

            const response = await fetch(`${identityHost}/oauth/token`, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectURI,
                grant_type: "authorization_code",
              }),
            });
            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error);
            }

            // Identify the user immediately via the provider (first time we can trust `access_token`)
            // and ensure the user exists in our DB.
            const userInfoResponse = await fetch(`${identityHost}/api/v1/me`, {
              headers: {
                Authorization: `Bearer ${data.access_token}`,
              },
            });


            let userInfo: Record<string, unknown> | null = null;

            if (userInfoResponse.ok) {
              const me = (await userInfoResponse.json()) as { identity?: unknown };
              const userData = me.identity as Record<string, unknown> | undefined;

              const id = userData?.id as string | undefined;
              const email = userData?.primary_email as string | undefined;

              if (userData && id && email) {
                const now = new Date();
                const firstName = (userData.first_name as string | undefined) ?? "";
                const lastName = (userData.last_name as string | undefined) ?? "";
                const name = `${firstName} ${lastName}`.trim();

                const image = (userData.avatar_url as string | undefined) ?? null;
                const slackId = (userData.slack_id as string | undefined) ?? null;
                const verificationStatus =
                  (userData.verification_status as string | undefined) ?? null;
                const identityToken = (data.access_token as string | undefined) ?? null;
                const refreshToken = (data.refresh_token as string | undefined) ?? null;

                // Create the user if missing; otherwise update stored Identity fields + tokens.
                await db
                  .insert(schema.user)
                  .values({
                    id,
                    name,
                    email,
                    emailVerified: true,
                    image,
                    slackId,
                    verificationStatus,
                    identityToken,
                    refreshToken,
                    createdAt: now,
                    updatedAt: now,
                  })
                  .onConflictDoUpdate({
                    target: schema.user.id,
                    set: {
                      name,
                      email,
                      emailVerified: true,
                      image,
                      slackId,
                      verificationStatus,
                      identityToken,
                      refreshToken,
                      updatedAt: now,
                    },
                  });

                userInfo = {
                  id,
                  name,
                  email,
                  emailVerified: true,
                  // Better Auth's OAuth2UserInfo uses `image?: string` (undefined when absent), not null.
                  image: image ?? undefined,
                  slackId,
                  verificationStatus,
                  identityToken,
                  refreshToken,
                };
              }
            } else {
              console.error("Error getting user info", userInfoResponse.statusText);
            }

            return {
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              idToken: data.id_token ?? null,
              raw: {
                ...data,
                userInfo,
              },
            };
          },

          getUserInfo: async (tokens) => {
            // User is identified/created in `getToken`; just return it here.
            const userInfo = (tokens.raw as { userInfo?: unknown } | undefined)?.userInfo;
            return (userInfo ?? null) as OAuth2UserInfo | null;
          },
        },
      ],
    }),
  ],
});
