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
      className={`relative z-50 mx-auto flex w-full justify-between gap-3 sm:gap-4 ${
        isLandingHeader
          ? "max-w-6xl flex-col items-stretch px-4 py-4 sm:flex-row sm:items-center sm:px-6"
          : "max-w-none items-center rounded-[1.75rem] border-[4px] border-[#74210a] bg-[#fff0cf] px-4 py-3 shadow-[0_6px_0_#d78b22,0_16px_30px_rgba(120,53,15,0.14)] sm:px-5 sm:py-3.5"
      }`}
    >
      <div
        className={
          isLandingHeader
            ? "flex items-center gap-2 self-start rounded-full border border-[#74210a]/20 bg-[#fff7dc]/80 px-4 py-2.5 shadow-[0_12px_32px_rgba(120,53,15,0.12)] backdrop-blur"
            : "flex items-center gap-2 rounded-full border-[3px] border-[#74210a] bg-[#fff7dc] px-3 py-1.5 shadow-[0_4px_0_#d78b22]"
        }
      >
        <span className="text-2xl">🎪</span>
        <Link
          href="/"
          className={
            isLandingHeader
              ? "text-xl font-black uppercase tracking-[0.08em] text-[#5b1f0a]"
              : "text-base font-black uppercase tracking-[0.08em] text-[#5b1f0a] sm:text-lg"
          }
        >
          Carnival
        </Link>
      </div>

      <div
        className={`flex items-center gap-3 sm:gap-6 ${
          isLandingHeader ? "w-full justify-between sm:w-auto sm:justify-start" : "min-w-0"
        }`}
      >
        {showSectionLinks ? (
          <div className="hidden items-center gap-1 rounded-full border border-[#74210a]/20 bg-[#fff7dc]/80 p-1 shadow-[0_12px_32px_rgba(120,53,15,0.12)] backdrop-blur sm:flex">
            <Link
              href="#about"
              className="rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.06em] text-[#7b240a] transition-colors hover:bg-[#f6a61c] hover:text-[#fff7dc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#74210a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff7dc]"
            >
              How It Works
            </Link>
            <Link
              href="#rewards"
              className="rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.06em] text-[#7b240a] transition-colors hover:bg-[#f6a61c] hover:text-[#fff7dc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#74210a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff7dc]"
            >
              Rewards
            </Link>
            <Link
              href="#faq"
              className="rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.06em] text-[#7b240a] transition-colors hover:bg-[#f6a61c] hover:text-[#fff7dc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#74210a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff7dc]"
            >
              FAQ
            </Link>
          </div>
        ) : null}

        {isPending ? (
          <span className="text-sm font-semibold text-[#7b240a]">Checking session…</span>
        ) : isAuthed ? (
          <>
            {showDashboardLink ? (
              <Link
                href="/projects"
                className="inline-flex min-h-11 items-center justify-center rounded-full border-[3px] border-[#74210a] bg-[#fff7dc] px-4 py-2 text-sm font-black uppercase tracking-[0.06em] text-[#74210a] shadow-[0_5px_0_#d78b22] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_0_#d78b22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#74210a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff7dc]"
              >
                Dashboard
              </Link>
            ) : null}

            {!showSectionLinks ? (
              <WalletConverterPopover walletBalance={walletBalance} />
            ) : null}

            <details ref={detailsRef} className="relative z-50">
              <summary className="list-none cursor-pointer select-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#74210a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff0cf]">
                <span className="flex items-center gap-3">
                  {sessionUser?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sessionUser.image}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover border-[2px] border-[#74210a]/40"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border-[2px] border-[#74210a]/40 bg-[#ffe2b0] font-black text-[#5b1f0a]">
                      {avatarText}
                    </span>
                  )}
                  <span className="max-w-[180px] truncate text-sm font-black uppercase tracking-[0.03em] text-[#5b1f0a] sm:max-w-[220px]">
                    {displayName}
                  </span>
                  <span className="text-[#7b240a]">▼</span>
                </span>
              </summary>

              <div className="absolute right-0 z-50 mt-3 w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-[1.5rem] border-[3px] border-[#74210a] bg-[#fff7dc] shadow-[0_8px_0_#d78b22,0_20px_28px_rgba(120,53,15,0.18)]">
                <div className="border-b border-[#74210a]/20 px-5 py-4">
                  <div className="truncate text-sm font-black uppercase tracking-[0.05em] text-[#5b1f0a]">
                    {sessionUser?.name || "Signed in"}
                  </div>
                  {sessionUser?.email ? (
                    <div className="truncate text-sm text-[#7b240a]">{sessionUser.email}</div>
                  ) : null}
                </div>

                <div className="space-y-2 px-5 py-4">
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-[#8f4a18]">
                    Profile
                  </div>
                  <Link
                    href="/account"
                    onClick={() => closeMenu()}
                    className="inline-flex items-center text-sm font-semibold text-[#7b240a] transition-colors hover:text-[#5b1f0a]"
                  >
                    Account settings →
                  </Link>
                  {sessionUser?.slackId ? (
                    <div className="text-sm text-[#7b240a]">
                      <span className="text-[#8f4a18]">Slack:</span>{" "}
                      <span className="font-mono text-[#5b1f0a]">{sessionUser.slackId}</span>
                    </div>
                  ) : null}
                  {sessionUser?.verificationStatus ? (
                    <div className="text-sm text-[#7b240a]">
                      <span className="text-[#8f4a18]">Verification:</span>{" "}
                      {sessionUser.verificationStatus}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-[#74210a]/20 px-5 py-4">
                  <button
                    type="button"
                    onClick={() => closeMenu()}
                    className="text-sm font-semibold text-[#8f4a18] transition-colors hover:text-[#5b1f0a]"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="rounded-full border-[3px] border-[#74210a] bg-[#f6a61c] px-5 py-2.5 text-sm font-black uppercase tracking-[0.06em] text-[#fff7dc] shadow-[0_5px_0_#bf6216] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_0_#bf6216] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#74210a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff7dc]"
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
            className={`rounded-full px-5 py-3 text-base leading-none font-bold transition-[transform,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#74210a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff7dc] sm:px-7 sm:py-3.5 sm:text-lg ${
              isLandingHeader
                ? "border-[3px] border-[#74210a] bg-[#f6a61c] text-[#fff7dc] shadow-[0_6px_0_#bf6216,0_16px_28px_rgba(120,53,15,0.16)] hover:-translate-y-0.5 hover:shadow-[0_9px_0_#bf6216,0_18px_32px_rgba(120,53,15,0.18)] active:scale-[0.96]"
                : "border-[3px] border-[#74210a] bg-[#f6a61c] text-[#fff7dc] shadow-[0_6px_0_#bf6216,0_14px_24px_rgba(120,53,15,0.14)] hover:-translate-y-0.5 hover:shadow-[0_8px_0_#bf6216,0_18px_30px_rgba(120,53,15,0.2)] active:scale-[0.96]"
            } disabled:translate-y-0 disabled:shadow-none disabled:bg-[#d89d47] disabled:cursor-not-allowed`}
          >
            {authLoading ? "Opening Identity…" : "Join Carnival"}
          </button>
        )}
      </div>
    </nav>
  );
}
