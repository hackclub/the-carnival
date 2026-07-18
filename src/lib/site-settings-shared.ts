// Shared (client-safe) parts of the site-settings module. Server-side reads
// and writes live in site-settings.ts, which re-exports everything here.

export const SITE_SETTING_KEYS = ["carnival_deadline", "snacks_deadline"] as const;
export type SiteSettingKey = (typeof SITE_SETTING_KEYS)[number];

export function isSiteSettingKey(value: unknown): value is SiteSettingKey {
  return typeof value === "string" && (SITE_SETTING_KEYS as readonly string[]).includes(value);
}

export const SITE_SETTING_LABELS: Record<SiteSettingKey, { label: string; description: string }> = {
  carnival_deadline: {
    label: "Carnival deadline",
    description: "Shown in the landing page countdown (\"the gates close on …\").",
  },
  snacks_deadline: {
    label: "Snacks deadline",
    description: "Shown on the /snacks page: countdown, hero copy, and fine print.",
  },
};

// Fallbacks when the DB has no row yet (or is unreachable).
export const SITE_SETTING_DEFAULTS: Record<SiteSettingKey, string> = {
  carnival_deadline: "2026-07-31T23:59:59.000Z",
  snacks_deadline: "2026-07-31T23:59:59.000Z",
};

export type SiteSettingRow = {
  key: SiteSettingKey;
  valueIso: string;
  isDefault: boolean;
  updatedAtIso: string | null;
  updatedByUserId: string | null;
};

/** Strict ISO-8601 datetime with explicit UTC "Z" suffix, e.g. 2026-07-31T23:59:59.000Z */
export function parseIsoDeadline(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/.test(value.trim())) return null;
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "July 31" (UTC) */
export function formatDeadlineMonthDay(iso: string): string {
  const date = parseIsoDeadline(iso);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(
    date,
  );
}

/** "July 31, 2026" (UTC) */
export function formatDeadlineMonthDayYear(iso: string): string {
  const date = parseIsoDeadline(iso);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
