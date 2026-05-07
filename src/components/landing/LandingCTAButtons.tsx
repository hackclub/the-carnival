"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { signIn, useSession } from "@/lib/auth-client";

export default function LandingCTAButtons() {
  const { data, isPending } = useSession();
  const isAuthed = !!(data as { user?: { id?: string } } | null | undefined)?.user?.id;
  const [authLoading, setAuthLoading] = useState(false);

  const onJoinCarnival = useCallback(async () => {
    setAuthLoading(true);
    const { data, error } = await signIn.oauth2({
      providerId: "hackclub-identity",
      callbackURL: "/projects",
      disableRedirect: true,
    });

    if (error || !data?.url) {
      setAuthLoading(false);
      window.location.href = "/login?callbackUrl=/projects";
      return;
    }

    window.location.href = data.url;
  }, []);

  return (
    <div className="mt-6 flex w-full flex-col items-center justify-center gap-3 sm:mt-7">
      <div className="w-full sm:w-auto">
        {isPending ? (
          <span className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--carnival-squircle-radius)] border-2 border-[#74210a] bg-[#f6a61c] px-6 py-3 text-center text-sm font-bold uppercase tracking-[0.04em] text-[#fff7dc] sm:w-auto sm:px-8 sm:text-base">
            Checking…
          </span>
        ) : isAuthed ? (
          <Link
            aria-label="Dashboard"
            href="/projects"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--carnival-squircle-radius)] border-2 border-[#74210a] bg-[#f6a61c] px-6 py-3 text-center text-sm font-bold uppercase tracking-[0.04em] text-[#fff7dc] transition-colors duration-200 hover:bg-[#ee9817] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#74210a] sm:w-auto sm:px-9 sm:text-lg"
          >
            Enter The Carnival
          </Link>
        ) : (
          <button
            type="button"
            onClick={onJoinCarnival}
            disabled={authLoading}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--carnival-squircle-radius)] border-2 border-[#74210a] bg-[#f6a61c] px-6 py-3 text-center text-sm font-bold uppercase tracking-[0.04em] text-[#fff7dc] transition-colors duration-200 hover:bg-[#ee9817] disabled:bg-[#d69840] disabled:cursor-not-allowed sm:w-auto sm:px-9 sm:text-lg"
          >
            {authLoading ? "Opening Identity…" : "Enter The Carnival"}
          </button>
        )}
      </div>

      <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
        <div className="w-full sm:w-auto">
          {isPending ? (
            <span className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--carnival-squircle-radius)] border-2 border-[#74210a] bg-[#fff7dc] px-6 py-2 text-center text-sm font-bold uppercase tracking-[0.04em] text-[#74210a] sm:w-auto">
              Checking…
            </span>
          ) : isAuthed ? (
            <Link
              aria-label="Open #carnival on Slack"
              href="https://hackclub.slack.com/archives/C091ZRTMF16"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--carnival-squircle-radius)] border-2 border-[#74210a] bg-[#fff7dc] px-6 py-2 text-center text-sm font-bold uppercase tracking-[0.04em] text-[#74210a] transition-colors duration-200 hover:bg-[#fff0cf] sm:w-auto"
            >
              #Carnival Slack
            </Link>
          ) : (
            <button
              type="button"
              onClick={onJoinCarnival}
              disabled={authLoading}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--carnival-squircle-radius)] border-2 border-[#74210a] bg-[#fff7dc] px-6 py-2 text-center text-sm font-bold uppercase tracking-[0.04em] text-[#74210a] transition-colors duration-200 hover:bg-[#fff0cf] disabled:bg-[#f2ddb0] disabled:text-[#74210a]/60 disabled:cursor-not-allowed sm:w-auto"
            >
              {authLoading ? "Opening Identity…" : "Join Carnival"}
            </button>
          )}
        </div>

        <div className="w-full sm:w-auto">
          <Link
            aria-label="Browse editors you can build for"
            href="/editors"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--carnival-squircle-radius)] border-2 border-[#74210a] bg-[#fff0cf] px-6 py-2 text-center text-sm font-bold uppercase tracking-[0.04em] text-[#74210a] transition-colors duration-200 hover:bg-[#fff7dc] sm:w-auto"
          >
            Editors + Apps
          </Link>
        </div>
      </div>
    </div>
  );
}
