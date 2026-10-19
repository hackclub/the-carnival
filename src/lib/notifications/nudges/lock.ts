/**
 * The single advisory lock that keeps automated nudge runs from overlapping:
 * the Coolify scheduled command (scripts/nudges.js) and the admin "Send
 * today's run now" button both take it.
 *
 * Session-scoped, so it lives on its own one-connection client for the whole
 * run; runNudges() keeps using the app's pool.
 */
import postgres from "postgres";

export const NUDGE_LOCK_KEY = 0x6e756467;

export type NudgeLock = {
  tryLock: () => Promise<boolean>;
  unlock: () => Promise<void>;
  close: () => Promise<void>;
};

export function createNudgeLock(databaseUrl = process.env.DATABASE_URL): NudgeLock {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const sql = postgres(databaseUrl, { max: 1, idle_timeout: 0 });
  return {
    async tryLock() {
      const rows = await sql`select pg_try_advisory_lock(${NUDGE_LOCK_KEY}) as locked`;
      return rows[0]?.locked === true;
    },
    async unlock() {
      await sql`select pg_advisory_unlock(${NUDGE_LOCK_KEY})`;
    },
    async close() {
      await sql.end({ timeout: 5 }).catch(() => undefined);
    },
  };
}
