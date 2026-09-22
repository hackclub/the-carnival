import { and, asc, eq, isNotNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";
import { devlog, project, user } from "@/db/schema";
import type { OnboardingProgress } from "@/lib/onboarding-shared";

export * from "@/lib/onboarding-shared";

type DbLike = PostgresJsDatabase<typeof schema>;

export async function getOnboardingProgress(
  db: DbLike,
  userId: string,
): Promise<OnboardingProgress> {
  const [userRows, projectRows, devlogRows, submittedRows] = await Promise.all([
    // A stored token, not the connected-at timestamp: the token is cleared
    // when Hackatime revokes it, and the step should reopen so the user is
    // pointed back to Account settings to reconnect.
    db
      .select({ hackatimeAccessToken: user.hackatimeAccessToken })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1),
    db
      .select({ id: project.id })
      .from(project)
      .where(eq(project.creatorId, userId))
      .orderBy(asc(project.createdAt))
      .limit(1),
    db.select({ id: devlog.id }).from(devlog).where(eq(devlog.userId, userId)).limit(1),
    db
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.creatorId, userId), isNotNull(project.submittedAt)))
      .limit(1),
  ]);

  return {
    hackatimeConnected: !!userRows[0]?.hackatimeAccessToken?.trim(),
    hasProject: projectRows.length > 0,
    hasDevlog: devlogRows.length > 0,
    hasSubmittedProject: submittedRows.length > 0,
    firstProjectId: projectRows[0]?.id ?? null,
  };
}
