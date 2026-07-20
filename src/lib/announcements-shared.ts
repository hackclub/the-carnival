// Shared (client-safe) parts of the announcements module. Server-side reads
// and writes live in announcements.ts.

export const ANNOUNCEMENT_VARIANTS = ["carnival", "info", "success", "warning"] as const;
export type AnnouncementVariantKey = (typeof ANNOUNCEMENT_VARIANTS)[number];

export function isAnnouncementVariant(value: unknown): value is AnnouncementVariantKey {
  return (
    typeof value === "string" && (ANNOUNCEMENT_VARIANTS as readonly string[]).includes(value)
  );
}

export const ANNOUNCEMENT_VARIANT_LABELS: Record<AnnouncementVariantKey, string> = {
  carnival: "Carnival (red)",
  info: "Info (blue)",
  success: "Success (green)",
  warning: "Warning (amber)",
};

/** Serializable shape passed from server components / APIs to the client. */
export type AnnouncementDto = {
  id: string;
  message: string;
  href: string | null;
  linkLabel: string | null;
  variant: AnnouncementVariantKey;
  isActive: boolean;
  startsAtIso: string | null;
  endsAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

/**
 * An announcement is visible when its active flag is set and `now` falls
 * inside its optional [startsAt, endsAt] window.
 */
export function isAnnouncementVisible(
  announcement: Pick<AnnouncementDto, "isActive" | "startsAtIso" | "endsAtIso">,
  now: Date,
): boolean {
  if (!announcement.isActive) return false;
  const t = now.getTime();
  if (announcement.startsAtIso) {
    const start = Date.parse(announcement.startsAtIso);
    if (Number.isFinite(start) && t < start) return false;
  }
  if (announcement.endsAtIso) {
    const end = Date.parse(announcement.endsAtIso);
    if (Number.isFinite(end) && t > end) return false;
  }
  return true;
}
