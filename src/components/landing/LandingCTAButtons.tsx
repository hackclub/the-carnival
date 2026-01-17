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
    <div className="mt-6 flex flex-col items-center justify-center gap-3">
      <div className="transform transition-transform hover:scale-105 hover:-rotate-1">
        {isPending ? (
          <span className="inline-flex items-center justify-center rounded-full px-8 py-3 text-base font-bold text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 ring-2 ring-amber-300/70 shadow-[0_10px_25px_rgba(255,94,0,0.35)]">
            Checking…
          </span>
        ) : isAuthed ? (
          <Link
            aria-label="Dashboard"
            href="/projects"
            className="inline-flex items-center justify-center rounded-full px-9 py-3.5 text-base sm:text-lg font-bold text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 shadow-[0_12px_28px_rgba(255,94,0,0.4)] ring-2 ring-amber-300/70 transition-transform transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(255,94,0,0.48)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            Enter The Carnival !
          </Link>
        ) : (
          <button
            type="button"
            onClick={onJoinCarnival}
            disabled={authLoading}
            className="inline-flex items-center justify-center rounded-full px-9 py-3.5 text-base sm:text-lg font-bold text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 shadow-[0_12px_28px_rgba(255,94,0,0.4)] ring-2 ring-amber-300/70 transition-transform transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(255,94,0,0.48)] disabled:translate-y-0 disabled:shadow-none disabled:bg-amber-500/70 disabled:cursor-not-allowed"
          >
            {authLoading ? "Opening Identity…" : "Enter The Carnival !"}
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <div className="transform transition-transform hover:scale-105 hover:rotate-1">
          {isPending ? (
            <span className="inline-flex items-center justify-center rounded-full px-8 py-3 text-base font-semibold text-amber-900 bg-amber-100 ring-2 ring-amber-200 shadow-[0_6px_16px_rgba(255,193,79,0.25)]">
              Checking…
            </span>
          ) : isAuthed ? (
            <Link
              aria-label="Open #carnival on Slack"
              href="https://hackclub.slack.com/archives/C091ZRTMF16"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full px-8 py-3 text-base font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 ring-2 ring-amber-200 transition-transform transition-shadow duration-200 shadow-[0_6px_16px_rgba(255,193,79,0.25)] hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(255,193,79,0.32)]"
            >
              #Carnival Slack
            </Link>
          ) : (
            <button
              type="button"
              onClick={onJoinCarnival}
              disabled={authLoading}
              className="inline-flex items-center justify-center rounded-full px-8 py-3 text-base font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 disabled:bg-amber-100/60 disabled:text-amber-900/60 disabled:cursor-not-allowed ring-2 ring-amber-200 transition-transform transition-shadow duration-200 shadow-[0_6px_16px_rgba(255,193,79,0.25)] hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(255,193,79,0.32)]"
            >
              {authLoading ? "Opening Identity…" : "Join Carnival"}
            </button>
          )}
        </div>

        <div className="transform transition-transform hover:scale-105 hover:-rotate-1">
          <Link
            aria-label="Browse editors you can build for"
            href="/editors"
            className="inline-flex items-center justify-center rounded-full px-8 py-3 text-base font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 ring-2 ring-amber-200 transition-transform transition-shadow duration-200 shadow-[0_6px_16px_rgba(255,193,79,0.2)] hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(255,193,79,0.28)]"
          >
            Editors you can build for
          </Link>
        </div>
      </div>
    </div>
  );
}


