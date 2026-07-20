"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { AnnouncementDto, AnnouncementVariantKey } from "@/lib/announcements-shared";

const STORAGE_KEY = "carnival:dismissed-announcements";
const MAX_VISIBLE = 3;

const VARIANT_CLASSES: Record<AnnouncementVariantKey, string> = {
  carnival: "bg-[#b91c1c] text-white",
  info: "bg-[#1d4ed8] text-white",
  success: "bg-[#047857] text-white",
  warning: "bg-[#f59e0b] text-[#451a03]",
};

// Editing an announcement (new updatedAt) re-shows it to people who dismissed
// the older version.
function dismissKey(a: AnnouncementDto): string {
  return `${a.id}:${a.updatedAtIso}`;
}

function readDismissed(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export default function SiteBannerClient({
  announcements,
}: {
  announcements: AnnouncementDto[];
}) {
  // Start hidden and reveal after reading localStorage, so users who already
  // dismissed a banner never see it flash back in.
  const [dismissed, setDismissed] = useState<string[] | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDismissed(readDismissed()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  if (dismissed === null) return null;

  const visible = announcements
    .filter((a) => !dismissed.includes(dismissKey(a)))
    .slice(0, MAX_VISIBLE);
  if (visible.length === 0) return null;

  const dismiss = (a: AnnouncementDto) => {
    const next = [...dismissed, dismissKey(a)].slice(-50);
    setDismissed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage unavailable (private mode); the banner just stays.
    }
  };

  return (
    <div role="region" aria-label="Announcements">
      {visible.map((a) => (
        <div
          key={a.id}
          className={`relative z-50 flex items-center justify-center gap-3 px-10 py-2.5 text-center text-sm font-semibold ${VARIANT_CLASSES[a.variant]}`}
        >
          <p className="[text-wrap:balance]">
            {a.message}
            {a.href ? (
              <>
                {" "}
                <Link
                  href={a.href}
                  className="underline underline-offset-2 hover:opacity-80"
                  target={a.href.startsWith("http") ? "_blank" : undefined}
                  rel={a.href.startsWith("http") ? "noreferrer" : undefined}
                >
                  {a.linkLabel?.trim() || "Learn more"}
                </Link>
              </>
            ) : null}
          </p>
          <button
            type="button"
            onClick={() => dismiss(a)}
            aria-label="Dismiss announcement"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 opacity-80 transition-opacity hover:opacity-100"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
