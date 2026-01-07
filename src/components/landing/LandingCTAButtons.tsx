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
    <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
      <div className="transform transition-transform hover:scale-105 hover:-rotate-1">
        <Link
          aria-label="Submit project"
          target="_blank"
          href="https://airtable.com/app8YP69xF49t7ymq/pagYy7rj2VU5KAIty/form"
          className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-sm ring-1 ring-amber-500/50 transition-colors"
        >
          Submit project
        </Link>
      </div>

      <div className="transform transition-transform hover:scale-105 hover:rotate-1">
        {isPending ? (
          <span className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-amber-900 bg-amber-100 ring-1 ring-amber-200">
            Checking…
          </span>
        ) : isAuthed ? (
          <Link
            aria-label="Open #carnival on Slack"
            href="https://hackclub.slack.com/archives/C091ZRTMF16"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 ring-1 ring-amber-200 transition-colors"
          >
            Open #Carnival
          </Link>
        ) : (
          <button
            type="button"
            onClick={onJoinCarnival}
            disabled={authLoading}
            className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 disabled:bg-amber-100/60 disabled:text-amber-900/60 disabled:cursor-not-allowed ring-1 ring-amber-200 transition-colors"
          >
            {authLoading ? "Opening Identity…" : "Join Carnival"}
          </button>
        )}
      </div>

      <div className="transform transition-transform hover:scale-105 hover:-rotate-1">
        <Link
          aria-label="Browse editors you can build for"
          href="/editors"
          className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-200 transition-colors"
        >
          Editors you can build for
        </Link>
      </div>
    </div>
  );
}


