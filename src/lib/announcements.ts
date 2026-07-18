import { unstable_noStore as noStore } from "next/cache";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { announcement } from "@/db/schema";
import {
  isAnnouncementVariant,
  isAnnouncementVisible,
  type AnnouncementDto,
} from "@/lib/announcements-shared";

export * from "@/lib/announcements-shared";

const CACHE_TTL_MS = 60_000;

type CacheEntry = { rows: AnnouncementDto[]; expiresAt: number };
let listCache: CacheEntry | null = null;

function toDto(row: typeof announcement.$inferSelect): AnnouncementDto {
  return {
    id: row.id,
    message: row.message,
    href: row.href,
    linkLabel: row.linkLabel,
    variant: row.variant,
    isActive: row.isActive,
    startsAtIso: row.startsAt ? row.startsAt.toISOString() : null,
    endsAtIso: row.endsAt ? row.endsAt.toISOString() : null,
    createdAtIso: row.createdAt.toISOString(),
    updatedAtIso: row.updatedAt.toISOString(),
  };
}

/** Uncached read of every announcement, newest first (admin UI). */
export async function getAllAnnouncements(): Promise<AnnouncementDto[]> {
  noStore();
  const rows = await db.select().from(announcement).orderBy(desc(announcement.createdAt));
  return rows.map(toDto);
}

/**
 * Announcements currently visible on the site, newest first. Rendered in the
 * root layout, so reads go through a per-instance 60s cache and any DB error
 * degrades to "no banner" instead of breaking every page.
 */
export async function getVisibleAnnouncements(now = new Date()): Promise<AnnouncementDto[]> {
  noStore();

  let rows: AnnouncementDto[];
  if (listCache && listCache.expiresAt > Date.now()) {
    rows = listCache.rows;
  } else {
    try {
      const fetched = await db
        .select()
        .from(announcement)
        .orderBy(desc(announcement.createdAt))
        .limit(20);
      rows = fetched.map(toDto);
      listCache = { rows, expiresAt: Date.now() + CACHE_TTL_MS };
    } catch (err) {
      console.error("[announcements] Failed to read announcements; hiding banner", err);
      return [];
    }
  }

  return rows.filter((row) => isAnnouncementVisible(row, now));
}

export function bustAnnouncementCache() {
  listCache = null;
}

// ============================================================================
// Admin input validation
// ============================================================================

const MAX_MESSAGE_LENGTH = 300;
const MAX_LINK_LABEL_LENGTH = 60;

export type AnnouncementInput = {
  message: string;
  href: string | null;
  linkLabel: string | null;
  variant: "carnival" | "info" | "success" | "warning";
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

export function parseAnnouncementInput(body: unknown):
  | { ok: true; value: AnnouncementInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid JSON body" };
  const raw = body as Record<string, unknown>;

  const message = typeof raw.message === "string" ? raw.message.trim() : "";
  if (!message) return { ok: false, error: "Message is required" };
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `Message must be at most ${MAX_MESSAGE_LENGTH} characters` };
  }

  let href: string | null = null;
  if (typeof raw.href === "string" && raw.href.trim()) {
    const candidate = raw.href.trim();
    const isInternal = candidate.startsWith("/");
    let isHttp = false;
    try {
      const u = new URL(candidate);
      isHttp = u.protocol === "http:" || u.protocol === "https:";
    } catch {
      isHttp = false;
    }
    if (!isInternal && !isHttp) {
      return { ok: false, error: "Link must be an http(s) URL or an internal path starting with /" };
    }
    href = candidate;
  }

  const linkLabel =
    typeof raw.linkLabel === "string" && raw.linkLabel.trim()
      ? raw.linkLabel.trim().slice(0, MAX_LINK_LABEL_LENGTH)
      : null;

  if (!isAnnouncementVariant(raw.variant)) {
    return { ok: false, error: "Invalid variant" };
  }

  const isActive = raw.isActive === undefined ? true : raw.isActive === true;

  const parseOptionalDate = (value: unknown, label: string) => {
    if (value === null || value === undefined || value === "") {
      return { ok: true as const, date: null };
    }
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
      return { ok: false as const, error: `${label} must be an ISO datetime or empty` };
    }
    return { ok: true as const, date: new Date(value) };
  };

  const starts = parseOptionalDate(raw.startsAt, "startsAt");
  if (!starts.ok) return { ok: false, error: starts.error };
  const ends = parseOptionalDate(raw.endsAt, "endsAt");
  if (!ends.ok) return { ok: false, error: ends.error };

  if (starts.date && ends.date && starts.date.getTime() >= ends.date.getTime()) {
    return { ok: false, error: "endsAt must be after startsAt" };
  }

  return {
    ok: true,
    value: {
      message,
      href,
      linkLabel,
      variant: raw.variant,
      isActive,
      startsAt: starts.date,
      endsAt: ends.date,
    },
  };
}
