// Hack Club Auth reports `identity.verification_status` as one of
// needs_submission | pending | verified | ineligible (https://auth.hackclub.com/docs/api).
// Only "verified" creators can submit projects for review.

export const IDENTITY_VERIFICATION_URL = "https://auth.hackclub.com";

export const IDENTITY_NOT_VERIFIED_MESSAGE = `You need to complete identity verification before submitting for review. Verify your identity at ${IDENTITY_VERIFICATION_URL}, then submit once it's approved.`;

export function isIdentityVerified(status: string | null | undefined): boolean {
  return status === "verified";
}
