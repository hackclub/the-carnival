"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "@/lib/auth-client";
import WalletConverterPopover from "@/components/WalletConverterPopover";

type HeaderProps = {
  /**
   * When true, shows the home-page section links (About/Rewards/FAQ).
   * Useful to disable on pages like /login.
   */
  showSectionLinks?: boolean;
  /**
   * Optional: server-provided initial wallet balance so dashboards don't flash "—".
   */
  initialWalletBalance?: number | null;
};

function getInitials(nameOrEmail?: string | null) {
  const value = (nameOrEmail ?? "").trim();
  if (!value) return "?";
  return value[0]?.toUpperCase() ?? "?";
}

export default function Header({ showSectionLinks = true, initialWalletBalance = null }: HeaderProps) {
  const { data, isPending } = useSession();
  const pathname = usePathname();
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(initialWalletBalance);
  const isLandingHeader = showSectionLinks && pathname === "/";

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
  const showDashboardLink = isAuthed && pathname === "/";

  // Fetch wallet once per mount when authenticated (async callback style to satisfy lint rule).
  useEffect(() => {
    if (!isAuthed) return;
    let cancelled = false;

    fetch("/api/wallet/balance", { method: "GET" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { balance?: unknown } | null;
        if (!res.ok) return null;
        const b = typeof json?.balance === "number" ? json.balance : Number(json?.balance);
        return Number.isFinite(b) ? b : null;
      })
      .then((b) => {
        if (cancelled) return;
        if (typeof b === "number") setWalletBalance(b);
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

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
    <nav
      className={`relative z-50 mx-auto flex max-w-7xl justify-between gap-4 ${
        isLandingHeader
          ? "max-w-6xl flex-col items-stretch px-4 py-4 sm:flex-row sm:items-center sm:px-6"
          : "items-center px-8 py-6"
      }`}
    >
      <div
        className={
          isLandingHeader
            ? "flex items-center gap-2 self-start rounded-full border border-[#74210a]/20 bg-[#fff7dc]/80 px-4 py-2.5 shadow-[0_12px_32px_rgba(120,53,15,0.12)] backdrop-blur"
            : "flex items-center gap-2"
        }
      >
        <span className="text-2xl">🎪</span>
        <Link
          href="/"
          className={
            isLandingHeader
              ? "text-xl font-black uppercase tracking-[0.08em] text-[#5b1f0a]"
              : "text-xl font-bold text-foreground"
          }
        >
          Carnival
        </Link>
      </div>

      <div
        className={`flex items-center gap-3 sm:gap-6 ${
          isLandingHeader ? "w-full justify-between sm:w-auto sm:justify-start" : ""
        }`}
      >
        {showSectionLinks ? (
          <div className="hidden items-center gap-1 rounded-full border border-[#74210a]/20 bg-[#fff7dc]/80 p-1 shadow-[0_12px_32px_rgba(120,53,15,0.12)] backdrop-blur sm:flex">
            <Link
              href="#about"
              className="rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.06em] text-[#7b240a] transition-colors hover:bg-[#f6a61c] hover:text-[#fff7dc]"
            >
              How It Works
            </Link>
            <Link
              href="#rewards"
              className="rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.06em] text-[#7b240a] transition-colors hover:bg-[#f6a61c] hover:text-[#fff7dc]"
            >
              Rewards
            </Link>
            <Link
              href="#faq"
              className="rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.06em] text-[#7b240a] transition-colors hover:bg-[#f6a61c] hover:text-[#fff7dc]"
            >
              FAQ
            </Link>
          </div>
        ) : null}

        {isPending ? (
          <span className="text-muted-foreground text-sm">Checking session…</span>
        ) : isAuthed ? (
          <>
            {showDashboardLink ? (
              <Link
                href="/projects"
                className="rounded-full border border-border bg-muted px-5 py-2.5 text-base font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/70"
              >
                Dashboard
              </Link>
            ) : null}

            {!showSectionLinks ? (
              <WalletConverterPopover walletBalance={walletBalance} />
            ) : null}

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

            <div className="absolute right-0 mt-3 z-50 w-[min(320px,calc(100vw-2rem))] rounded-2xl bg-card/95 backdrop-blur border border-border shadow-xl overflow-hidden">
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
                <Link
                  href="/account"
                  onClick={() => closeMenu()}
                  className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Account settings →
                </Link>
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
                  className="rounded-full bg-carnival-red px-6 py-3 text-lg leading-none font-bold text-white shadow-md transition-colors hover:bg-carnival-red/80"
                >
                  Sign out
                </button>
              </div>
            </div>
          </details>
          </>
        ) : (
          <button
            type="button"
            onClick={onJoinCarnival}
            disabled={authLoading}
            className={`rounded-full px-5 py-3 text-base leading-none font-bold transition-[transform,background-color,box-shadow] sm:px-7 sm:py-3.5 sm:text-lg ${
              isLandingHeader
                ? "border-[3px] border-[#74210a] bg-[#f6a61c] text-[#fff7dc] shadow-[0_6px_0_#bf6216,0_16px_28px_rgba(120,53,15,0.16)] hover:-translate-y-0.5 hover:shadow-[0_9px_0_#bf6216,0_18px_32px_rgba(120,53,15,0.18)] active:scale-[0.96]"
                : "bg-carnival-red text-white shadow-md hover:bg-carnival-red/80"
            } disabled:translate-y-0 disabled:shadow-none disabled:bg-carnival-red/50 disabled:cursor-not-allowed`}
          >
            {authLoading ? "Opening Identity…" : "Join Carnival"}
          </button>
        )}

      </div>
    </nav>
  );
}
