import { randomUUID } from "crypto";
import { getServerSession } from "@/lib/server-session";

// ============================================================================
// String utilities
// ============================================================================

/**
 * Safely convert unknown value to trimmed string
 */
export function toCleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Convert value to URL-friendly slug
 */
export function toSlug(value: unknown): string {
  const str = toCleanString(value);
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Convert value to positive integer (for prices, counts, etc.)
 */
export function toPositiveInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string" && value.trim()) return Math.floor(Number(value));
  return NaN;
}

// ============================================================================
// ID generation
// ============================================================================

export function generateId(): string {
  return randomUUID();
}

// ============================================================================
// PostgreSQL error handling
// ============================================================================

/**
 * Check if error is a PostgreSQL unique constraint violation
 */
export function isUniqueConstraintError(err: unknown): boolean {
  const pgErr = err as { code?: string; message?: string; cause?: { code?: string } };
  const errorCode = pgErr.code || pgErr.cause?.code;
  const msg = pgErr.message || "";
  return errorCode === "23505" || msg.includes("unique") || msg.includes("duplicate");
}

// ============================================================================
// Session helpers
// ============================================================================

export type SessionUser = {
  id: string;
  role: string | null;
  isAdmin: boolean;
  isReviewer: boolean;
};

/**
 * Get authenticated user from session
 * Returns null if not authenticated
 */
export async function getAuthUser(): Promise<SessionUser | null> {
  const session = await getServerSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  
  if (!userId) return null;
  
  const role = (session?.user as { role?: string | null } | undefined)?.role ?? null;
  
  return {
    id: userId,
    role,
    isAdmin: role === "admin",
    isReviewer: role === "reviewer" || role === "admin",
  };
}

// ============================================================================
// Request body parsing
// ============================================================================

/**
 * Safely parse JSON request body
 * Returns null if parsing fails
 */
export async function parseJsonBody<T>(req: Request): Promise<T | null> {
  try {
    return await req.json() as T;
  } catch {
    return null;
  }
}

// ============================================================================
// Timestamps
// ============================================================================

export function timestamps() {
  const now = new Date();
  return { createdAt: now, updatedAt: now };
}

export function updatedTimestamp() {
  return { updatedAt: new Date() };
}
