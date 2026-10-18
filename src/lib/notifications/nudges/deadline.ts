/**
 * Read the carnival_deadline site setting with a plain query.
 *
 * The app's cached reader (src/lib/site-settings.ts) imports next/cache,
 * which the standalone nudge command must not bundle. Same fallback as the
 * app: the compiled default when the row is missing, invalid, or unreadable.
 */
import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";
import { siteSetting } from "@/db/schema";
import { SITE_SETTING_DEFAULTS, parseIsoDeadline } from "@/lib/site-settings-shared";

type DbLike = Pick<PostgresJsDatabase<typeof schema>, "select">;

export async function readCarnivalDeadlineIso(db: DbLike): Promise<string> {
  const fallback = SITE_SETTING_DEFAULTS.carnival_deadline;
  try {
    const rows = await db
      .select({ value: siteSetting.value })
      .from(siteSetting)
      .where(eq(siteSetting.key, "carnival_deadline"))
      .limit(1);
    const stored = rows[0]?.value;
    return parseIsoDeadline(stored) ? (stored as string) : fallback;
  } catch (err) {
    console.error('[nudges] Failed to read "carnival_deadline"; using default', err);
    return fallback;
  }
}
