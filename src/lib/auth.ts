import { betterAuth, OAuth2UserInfo } from "better-auth";
import { createFieldAttribute } from "better-auth/db";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";

let _auth: ReturnType<typeof betterAuth> | null = null;

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

function toIsoDateOnlyOrNull(value: unknown): string | null {
  const raw = toNullableString(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function extractIdentityAddress(
  userData: Record<string, unknown>,
): {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  country: string | null;
  zipPostalCode: string | null;
} {
  const empty = {
    addressLine1: null,
    addressLine2: null,
    city: null,
    stateProvince: null,
    country: null,
    zipPostalCode: null,
  };

  const source =
    (userData.address && typeof userData.address === "object" && !Array.isArray(userData.address)
      ? (userData.address as Record<string, unknown>)
      : Array.isArray(userData.addresses)
        ? ((userData.addresses.find((a) => a && typeof a === "object" && !Array.isArray(a)) as
            | Record<string, unknown>
            | undefined) ?? null)
        : null) ?? userData;

  if (!source || typeof source !== "object") return empty;

  return {
    addressLine1: toNullableString(
      source.address_line_1 ?? source.addressLine1 ?? source.line1 ?? source.street_1,
    ),
    addressLine2: toNullableString(
      source.address_line_2 ?? source.addressLine2 ?? source.line2 ?? source.street_2,
    ),
    city: toNullableString(source.city ?? source.locality ?? source.town),
    stateProvince: toNullableString(
      source.state_province ?? source.stateProvince ?? source.state ?? source.region,
    ),
    country: toNullableString(source.country ?? source.country_code ?? source.countryCode),
    zipPostalCode: toNullableString(
      source.zip_postal_code ?? source.zipPostalCode ?? source.postal_code ?? source.postcode,
    ),
  };
}

function createAuth() {
  const identityHost = process.env.HC_IDENTITY_HOST!;
  
  return betterAuth({
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
        birthday: createFieldAttribute("string", { required: false }),
        addressLine1: createFieldAttribute("string", { required: false }),
        addressLine2: createFieldAttribute("string", { required: false }),
        city: createFieldAttribute("string", { required: false }),
        stateProvince: createFieldAttribute("string", { required: false }),
        country: createFieldAttribute("string", { required: false }),
        zipPostalCode: createFieldAttribute("string", { required: false }),
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
            // Request identity profile + shipping fields used for grants.
            scopes: [
              "openid",
              "profile",
              "email",
              "name",
              "basic_info",
              "birthdate",
              "address",
              "slack_id",
              "verification_status",
            ],

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
                  const birthday = toIsoDateOnlyOrNull(
                    userData.birthdate ?? userData.birthday ?? userData.date_of_birth ?? userData.dob,
                  );
                  const {
                    addressLine1,
                    addressLine2,
                    city,
                    stateProvince,
                    country,
                    zipPostalCode,
                  } = extractIdentityAddress(userData);
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
                      birthday,
                      addressLine1,
                      addressLine2,
                      city,
                      stateProvince,
                      country,
                      zipPostalCode,
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
                        birthday,
                        addressLine1,
                        addressLine2,
                        city,
                        stateProvince,
                        country,
                        zipPostalCode,
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
                    birthday,
                    addressLine1,
                    addressLine2,
                    city,
                    stateProvince,
                    country,
                    zipPostalCode,
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
}

export function getAuth() {
  if (!_auth) {
    _auth = createAuth();
  }
  return _auth;
}

export const auth = getAuth();
