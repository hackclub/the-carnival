import { describe, expect, test } from "bun:test";
import { parseUserInput } from "better-auth/db";

process.env.HC_IDENTITY_HOST ??= "https://identity.example.test";
process.env.HC_IDENTITY_CLIENT_ID ??= "test-client-id";
process.env.HC_IDENTITY_CLIENT_SECRET ??= "test-client-secret";
process.env.HC_IDENTITY_REDIRECT_URI ??=
  "http://localhost:3000/api/auth/callback/hackclub-identity";

const { auth } = await import("./auth.ts");

describe("auth user field configuration", () => {
  test("does not allow users to update their own role through Better Auth", () => {
    const roleField = auth.options.user?.additionalFields?.role;

    expect(roleField?.returned).not.toBe(false);
    expect(roleField?.input).toBe(false);
    expect(() => parseUserInput(auth.options, { role: "admin" }, "update")).toThrow(
      "role is not allowed to be set",
    );
  });
});
