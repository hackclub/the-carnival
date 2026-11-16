import type { UserRole } from "@/db/schema";

/** Role checks shared by API routes. `role` comes off the session, so it is untyped until checked. */

export function isAdmin(role: unknown): role is "admin" {
  return role === "admin";
}

export function canReview(role: unknown): role is Extract<UserRole, "reviewer" | "admin"> {
  return role === "reviewer" || role === "admin";
}

/** Creators can read their own project; reviewers and admins can read any. */
export function canReadProject(role: unknown, isCreator: boolean) {
  return isCreator || canReview(role);
}
