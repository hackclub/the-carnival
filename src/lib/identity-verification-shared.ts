// Hack Club Auth reports `identity.verification_status` as one of
// needs_submission | pending | verified | ineligible (https://auth.hackclub.com/docs/api).
// Only "verified" creators can submit projects for review.

export const IDENTITY_VERIFICATION_URL = "https://auth.hackclub.com";

export type IdentitySubmissionBlock = {
  title: string;
  message: string;
  showVerifyLink: boolean;
};

/** Why a creator can't submit a project yet, or null when they're verified. */
export function getIdentitySubmissionBlock(
  status: string | null | undefined,
): IdentitySubmissionBlock | null {
  switch (status) {
    case "verified":
      return null;
    case "ineligible":
      return {
        title: "Not eligible to submit",
        message:
          "You can't submit projects because your Hack Club identity verification found you're not eligible.",
        showVerifyLink: false,
      };
    case "pending":
      return {
        title: "Identity verification pending",
        message:
          "Your Hack Club identity verification is still being reviewed. You can submit a project once you get a decision.",
        showVerifyLink: false,
      };
    default:
      // needs_submission, or no status synced yet.
      return {
        title: "Identity verification required",
        message: `You need to complete identity verification before you can submit a project. Verify your identity at ${IDENTITY_VERIFICATION_URL}, then come back to submit.`,
        showVerifyLink: true,
      };
  }
}
