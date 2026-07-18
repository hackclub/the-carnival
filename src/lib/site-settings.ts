import { unstable_noStore as noStore } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSetting } from "@/db/schema";
import {
  SITE_SETTING_DEFAULTS,
  SITE_SETTING_KEYS,
  parseIsoDeadline,
  type SiteSettingKey,
  type SiteSettingRow,
} from "@/lib/site-settings-shared";

export * from "@/lib/site-settings-shared";

const CACHE_TTL_MS = 60_000;

type CacheEntry = { value: string; expiresAt: number };
const settingCache = new Map<SiteSettingKey, CacheEntry>();

/**
 * Read a deadline setting as an ISO string. DB-backed with a per-instance
 * 60s in-memory cache; falls back to the compiled default when the DB has
 * no row (or errors), so public pages never hard-fail on this.
 */
export async function getSiteSettingIso(key: SiteSettingKey): Promise<string> {
  // Callers are public pages; opt them out of build-time prerendering the
  // same way getServerSession does (Docker builds have no DB).
  noStore();

  const cached = settingCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value = SITE_SETTING_DEFAULTS[key];
  try {
    const rows = await db
      .select({ value: siteSetting.value })
      .from(siteSetting)
      .where(eq(siteSetting.key, key))
      .limit(1);
    const stored = rows[0]?.value;
    if (parseIsoDeadline(stored)) value = stored as string;
  } catch (err) {
    console.error(`[site-settings] Failed to read "${key}"; using default`, err);
  }

  settingCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/** Uncached read of all settings (for the admin UI). */
export async function getAllSiteSettings(): Promise<SiteSettingRow[]> {
  noStore();
  const rows = await db
    .select({
      key: siteSetting.key,
      value: siteSetting.value,
      updatedAt: siteSetting.updatedAt,
      updatedByUserId: siteSetting.updatedByUserId,
    })
    .from(siteSetting);
  const byKey = new Map(rows.map((row) => [row.key, row]));

  return SITE_SETTING_KEYS.map((key) => {
    const row = byKey.get(key);
    const stored = row && parseIsoDeadline(row.value) ? (row.value as string) : null;
    return {
      key,
      valueIso: stored ?? SITE_SETTING_DEFAULTS[key],
      isDefault: stored === null,
      updatedAtIso: row?.updatedAt ? row.updatedAt.toISOString() : null,
      updatedByUserId: row?.updatedByUserId ?? null,
    };
  });
}

export async function setSiteSettingIso(
  key: SiteSettingKey,
  isoValue: string,
  updatedByUserId: string,
): Promise<void> {
  const parsed = parseIsoDeadline(isoValue);
  if (!parsed) throw new Error("Value must be an ISO-8601 UTC datetime (…Z)");

  const now = new Date();
  await db
    .insert(siteSetting)
    .values({ key, value: parsed.toISOString(), updatedAt: now, updatedByUserId })
    .onConflictDoUpdate({
      target: siteSetting.key,
      set: { value: parsed.toISOString(), updatedAt: now, updatedByUserId },
    });
  settingCache.delete(key);
}
