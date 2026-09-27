"use client";

import { usePathname } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { hackatimeConnectUrl } from "@/lib/hackatime-connection";

/**
 * Shown on every signed-in page while Carnival's Hackatime token is gone but
 * the account was connected before (Hackatime revoked it). Not dismissible:
 * the project picker and hour refreshes are broken until they reconnect, and
 * the bar disappears on its own once the OAuth flow completes.
 */
export default function HackatimeReconnectBanner() {
  const pathname = usePathname() || "/projects";

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d97706]/40 bg-[#fde68a] px-4 py-3 text-sm text-[#451a03] md:px-6"
    >
      <div className="flex min-w-0 items-start gap-2">
        <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
        <p className="min-w-0">
          <span className="font-semibold">Carnival lost access to your Hackatime account.</span>{" "}
          This usually happens when Carnival is removed from Hackatime&apos;s Authorized
          Applications. Until you reconnect, Carnival can&apos;t list your Hackatime projects or
          refresh hours.
        </p>
      </div>
      <a
        href={hackatimeConnectUrl(pathname)}
        className="inline-flex shrink-0 items-center justify-center rounded-[var(--carnival-squircle-radius)] bg-[#451a03] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#78350f]"
      >
        Reconnect Hackatime
      </a>
    </div>
  );
}
