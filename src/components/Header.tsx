"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef } from "react";
import { signOut, useSession } from "@/lib/auth-client";

type HeaderProps = {
  /**
   * When true, shows the home-page section links (About/Rewards/FAQ).
   * Useful to disable on pages like /login.
   */
  showSectionLinks?: boolean;
};

function getInitials(nameOrEmail?: string | null) {
  const value = (nameOrEmail ?? "").trim();
  if (!value) return "?";
  return value[0]?.toUpperCase() ?? "?";
}

export default function Header({ showSectionLinks = true }: HeaderProps) {
  const { data, isPending } = useSession();
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  // `better-auth` shapes can differ by version; keep this tolerant (but typed).
  type SessionUser = {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    slackId?: string | null;
    verificationStatus?: string | null;
  };

  const sessionUser = (data as { user?: SessionUser } | null | undefined)?.user;

  const isAuthed = !!sessionUser?.id;

  const displayName = useMemo(() => {
    return sessionUser?.name?.trim() || sessionUser?.email?.trim() || "Unknown";
  }, [sessionUser?.email, sessionUser?.name]);

  const avatarText = useMemo(() => {
    return getInitials(sessionUser?.name ?? sessionUser?.email);
  }, [sessionUser?.email, sessionUser?.name]);

  const closeMenu = useCallback(() => {
    detailsRef.current?.removeAttribute("open");
  }, []);

  const onSignOut = useCallback(async () => {
    await signOut();
    closeMenu();
    // This ensures any server components re-fetch auth state.
    window.location.href = "/";
  }, [closeMenu]);

  return (
    <nav className="relative z-50 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🎪</span>
        <Link href="/" className="text-xl font-bold text-foreground">
          Carnival
        </Link>
      </div>

      <div className="flex items-center gap-6">
        {showSectionLinks ? (
          <>
            <Link
              href="#about"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              About
            </Link>
            <Link
              href="#rewards"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Rewards
            </Link>
            <Link
              href="#faq"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              FAQ
            </Link>
          </>
        ) : null}

        {isPending ? (
          <span className="text-muted-foreground text-sm">Checking session…</span>
        ) : isAuthed ? (
          <details ref={detailsRef} className="relative z-50">
            <summary className="list-none cursor-pointer select-none">
              <span className="flex items-center gap-3">
                {sessionUser?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sessionUser.image}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover border border-border"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="h-9 w-9 rounded-full bg-carnival-blue/15 border border-border flex items-center justify-center text-foreground font-bold">
                    {avatarText}
                  </span>
                )}
                <span className="text-foreground font-medium max-w-[220px] truncate">
                  {displayName}
                </span>
                <span className="text-carnival-blue">▼</span>
              </span>
            </summary>

            <div className="absolute right-0 mt-3 z-50 w-[320px] rounded-2xl bg-card/95 backdrop-blur border border-border shadow-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <div className="text-foreground font-semibold truncate">
                  {sessionUser?.name || "Signed in"}
                </div>
                {sessionUser?.email ? (
                  <div className="text-muted-foreground text-sm truncate">
                    {sessionUser.email}
                  </div>
                ) : null}
              </div>

              <div className="px-5 py-4 space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Profile
                </div>
                {sessionUser?.slackId ? (
                  <div className="text-sm text-muted-foreground">
                    <span className="text-muted-foreground">Slack:</span>{" "}
                    <span className="font-mono">{sessionUser.slackId}</span>
                  </div>
                ) : null}
                {sessionUser?.verificationStatus ? (
                  <div className="text-sm text-muted-foreground">
                    <span className="text-muted-foreground">Verification:</span>{" "}
                    {sessionUser.verificationStatus}
                  </div>
                ) : null}
              </div>

              <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => closeMenu()}
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="bg-carnival-red hover:bg-carnival-red/80 text-white px-4 py-2 rounded-full font-medium transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          </details>
        ) : (
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
        )}

        <Link
          href="https://hackclub.slack.com/archives/C091ZRTMF16"
          className="bg-carnival-red hover:bg-carnival-red/80 text-white px-4 py-2 rounded-full font-medium transition-colors"
        >
          Join #carnival
        </Link>
      </div>
    </nav>
  );
}


