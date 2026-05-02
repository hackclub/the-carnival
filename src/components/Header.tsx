"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { signIn, useSession } from "@/lib/auth-client";

type HeaderProps = {
  showSectionLinks?: boolean;
};

export default function Header({ showSectionLinks = true }: HeaderProps) {
  const { data, isPending } = useSession();
  const pathname = usePathname();
  const [authLoading, setAuthLoading] = useState(false);
  const isLandingHeader = showSectionLinks && pathname === "/";

  type SessionUser = { id?: string; name?: string | null };
  const sessionUser = (data as { user?: SessionUser } | null | undefined)?.user;
  const isAuthed = !!sessionUser?.id;
  const showDashboardLink = isAuthed && pathname === "/";

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
          showDashboardLink ? (
            <Link
              href="/projects"
              className="rounded-full border border-border bg-muted px-5 py-2.5 text-base font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/70"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/projects"
              className="rounded-full border border-border bg-muted px-5 py-2.5 text-base font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/70"
            >
              Dashboard
            </Link>
          )
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
