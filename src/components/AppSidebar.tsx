"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "@/lib/auth-client";
import { useSidebar } from "@/components/SidebarContext";
import {
  Ban,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Compass,
  FolderKanban,
  Gift,
  LogOut,
  LucideIcon,
  MessageSquare,
  Settings,
  Shield,
  ShoppingBag,
  Trophy,
  Users,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import WalletConverterPopover from "@/components/WalletConverterPopover";

type UserRole = "user" | "reviewer" | "admin" | null;

type SidebarUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string | null;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavSection = {
  id: string;
  title: string;
  items: NavItem[];
};

const WORKSPACE_NAV: NavItem[] = [
  { href: "/projects", label: "My projects", icon: FolderKanban },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/bounties", label: "Bounties", icon: Trophy },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
  { href: "/resources", label: "Resources", icon: BookOpen },
];

const REVIEW_NAV: NavItem[] = [
  { href: "/review", label: "Review queue", icon: ClipboardCheck },
  { href: "/admin/shop", label: "Shop (Staff)", icon: ShoppingBag },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin/grants", label: "Grants", icon: Gift },
  { href: "/admin/dismissed", label: "Dismissed projects", icon: Ban },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/review/comments", label: "Reviewer comments", icon: MessageSquare },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/audit", label: "Audit log", icon: Shield },
];

function asUserRole(value: unknown): UserRole {
  if (value === "user" || value === "reviewer" || value === "admin") return value;
  return null;
}

function isActivePath(pathname: string | null, href: string) {
  return pathname === href || pathname?.startsWith(href + "/");
}

function getNavSections(role: UserRole): NavSection[] {
  if (role === "admin") {
    return [
      { id: "workspace", title: "Workspace", items: WORKSPACE_NAV },
      { id: "ops", title: "Operations", items: [...REVIEW_NAV, ...ADMIN_NAV] },
    ];
  }

  if (role === "reviewer") {
    return [
      { id: "workspace", title: "Workspace", items: WORKSPACE_NAV },
      { id: "ops", title: "Operations", items: REVIEW_NAV },
    ];
  }

  return [{ id: "workspace", title: "Workspace", items: WORKSPACE_NAV }];
}

function getInitials(nameOrEmail?: string | null) {
  const value = (nameOrEmail ?? "").trim();
  if (!value) return "?";
  return value[0]?.toUpperCase() ?? "?";
}

const WALLET_STALE_MS = 60_000;

type SidebarNavProps = {
  sections: NavSection[];
  pathname: string | null;
  collapsed: boolean;
  onNavigate?: () => void;
};

function SidebarNav({ sections, pathname, collapsed, onNavigate }: SidebarNavProps) {
  return (
    <nav className="flex-1 space-y-5 px-3 overflow-y-auto">
      {sections.map((section) => (
        <section key={section.id} className="space-y-1.5">
          {!collapsed && (sections.length > 1 || section.title !== "Workspace") && (
            <div className="platform-nav-section-label sidebar-section-label mt-2 mb-1">{section.title}</div>
          )}
          {collapsed && sections.length > 1 && section.id !== sections[0]?.id && (
            <div className="mx-auto my-2 h-px w-6 bg-[var(--platform-border)]" />
          )}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item.href);

              const linkElement = (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={active ? "true" : "false"}
                  className="platform-nav-link"
                  onClick={onNavigate}
                >
                  <Icon size={17} className="shrink-0" />
                  {!collapsed && <span className="sidebar-label">{item.label}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger render={linkElement} />
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return linkElement;
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

export default function AppSidebar({
  user,
  initialWalletBalance,
  walletFetchedAt,
}: {
  user: SidebarUser | null;
  initialWalletBalance: number | null;
  walletFetchedAt: string;
}) {
  const pathname = usePathname();
  const { mobileOpen, setMobileOpen, collapsed, toggleCollapsed } = useSidebar();

  const [walletBalance, setWalletBalance] = useState<number | null>(initialWalletBalance);
  const [lastWalletFetchedAt, setLastWalletFetchedAt] = useState(() => {
    const ms = new Date(walletFetchedAt).getTime();
    return Number.isFinite(ms) ? ms : Date.now();
  });

  const sessionUser = user;
  const isAuthed = !!sessionUser?.id;
  const role = asUserRole(sessionUser?.role ?? null);
  const sections = getNavSections(role);

  const displayName = useMemo(() => {
    return sessionUser?.name?.trim() || sessionUser?.email?.trim() || "Unknown";
  }, [sessionUser?.email, sessionUser?.name]);

  const avatarText = useMemo(() => {
    return getInitials(sessionUser?.name ?? sessionUser?.email);
  }, [sessionUser?.email, sessionUser?.name]);

  const refreshWalletBalance = useCallback(async () => {
    if (!isAuthed) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    try {
      const res = await fetch("/api/wallet/balance", { method: "GET", cache: "no-store" });
      const json = (await res.json().catch(() => null)) as
        | { balance?: unknown; fetchedAt?: unknown }
        | null;
      if (!res.ok) return;
      const b = typeof json?.balance === "number" ? json.balance : Number(json?.balance);
      if (Number.isFinite(b)) setWalletBalance(b);
      const fetchedMs =
        typeof json?.fetchedAt === "string" ? new Date(json.fetchedAt).getTime() : Date.now();
      setLastWalletFetchedAt(Number.isFinite(fetchedMs) ? fetchedMs : Date.now());
    } catch {
      // Keep the last known balance on transient refresh failures.
    }
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) return;
    let cancelled = false;
    const interval = window.setInterval(() => {
      if (!cancelled) void refreshWalletBalance();
    }, WALLET_STALE_MS);
    const onFocus = () => {
      if (Date.now() - lastWalletFetchedAt >= WALLET_STALE_MS) {
        void refreshWalletBalance();
      }
    };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [isAuthed, lastWalletFetchedAt, refreshWalletBalance]);

  const onSignOut = useCallback(async () => {
    await signOut();
    window.location.href = "/";
  }, []);

  const sidebarContent = (isMobile: boolean) => (
    <div className={`flex h-full flex-col ${isMobile ? "" : collapsed ? "sidebar-collapsed" : "sidebar-expanded"}`}>
      {/* Header / branding */}
      <div className="px-4 pt-5 pb-2">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-xl leading-none">🎪</span>
            {(!collapsed || isMobile) && (
              <span className="sidebar-branding-text text-sm font-black uppercase tracking-[0.08em] text-[var(--platform-ink)]">
                Carnival
              </span>
            )}
          </Link>
          {!isMobile && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="ml-auto inline-flex items-center justify-center rounded-lg p-1.5 text-[var(--platform-ink-muted)] transition-colors hover:bg-[rgba(255,240,207,0.8)] hover:text-[var(--platform-ink)]"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
        </div>
        {(!collapsed || isMobile) && (
          <div className="sidebar-branding-text mt-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--platform-ink-muted)]">
            Dashboard
          </div>
        )}
      </div>

      {/* Art decoration */}
      {(!collapsed || isMobile) && (
        <div className="sidebar-art relative mx-auto my-1 h-12 w-28 opacity-50">
          <Image
            src="/ferris-wheel.png"
            alt=""
            fill
            sizes="112px"
            className="object-contain"
          />
        </div>
      )}

      {/* Navigation */}
      <SidebarNav
        sections={sections}
        pathname={pathname}
        collapsed={!isMobile && collapsed}
        onNavigate={isMobile ? () => setMobileOpen(false) : undefined}
      />

      {/* Profile chip */}
      <div className="mt-auto border-t border-[var(--platform-border)] px-3 pt-3 pb-4">
        {isAuthed && (
          <div
            className={
              collapsed && !isMobile
                ? "flex flex-col items-center gap-2"
                : "rounded-[var(--radius-xl)] border border-[rgba(116,33,10,0.16)] bg-[rgba(255,240,207,0.74)] p-2 shadow-sm"
            }
          >
            <div className={collapsed && !isMobile ? "flex flex-col items-center gap-2" : "flex items-center gap-2.5"}>
              <Tooltip>
                <TooltipTrigger className="shrink-0">
                  {sessionUser?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sessionUser.image}
                      alt=""
                      className="h-10 w-10 rounded-full border-2 border-background object-cover shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-background bg-[var(--platform-accent)]/20 text-sm font-bold text-[var(--platform-ink)] shadow-sm">
                      {avatarText}
                    </span>
                  )}
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="font-medium">{displayName}</div>
                  {sessionUser?.email ? <div className="text-xs opacity-80">{sessionUser.email}</div> : null}
                </TooltipContent>
              </Tooltip>

              {(!collapsed || isMobile) && (
                <div className="min-w-0 flex-1">
                  <div className="sidebar-user-name truncate text-sm font-bold text-[var(--platform-ink)]">
                    {displayName}
                  </div>
                  {sessionUser?.email ? (
                    <div className="truncate text-[0.68rem] font-medium text-[var(--platform-ink-muted)]">
                      {sessionUser.email}
                    </div>
                  ) : null}
                </div>
              )}

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                    href="/account"
                    onClick={isMobile ? () => setMobileOpen(false) : undefined}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--platform-ink-muted)] transition-colors hover:bg-background/80 hover:text-[var(--platform-ink)]"
                    aria-label="Account settings"
                  >
                    <Settings size={17} />
                  </Link>
                  }
                />
                <TooltipContent side={collapsed && !isMobile ? "right" : "top"}>Account settings</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                    type="button"
                    onClick={onSignOut}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--platform-ink-muted)] transition-colors hover:bg-background/80 hover:text-red-600"
                    aria-label="Sign out"
                  >
                    <LogOut size={17} />
                  </button>
                  }
                />
                <TooltipContent side={collapsed && !isMobile ? "right" : "top"}>Sign out</TooltipContent>
              </Tooltip>
            </div>

            <div className={collapsed && !isMobile ? "" : "mt-2 flex justify-start"}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <div>
                    <WalletConverterPopover
                      walletBalance={walletBalance}
                      variant={collapsed && !isMobile ? "compact" : "chip"}
                    />
                  </div>
                  }
                />
                <TooltipContent side={collapsed && !isMobile ? "right" : "top"}>
                  {walletBalance ?? "—"} tokens
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:block md:shrink-0 ${collapsed ? "sidebar-collapsed" : "sidebar-expanded"}`}
      >
        <div className="platform-sidebar-surface border-r sticky top-0 h-screen overflow-hidden">
          {sidebarContent(false)}
        </div>
      </aside>

      {/* Mobile sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" showCloseButton={true} className="w-72 p-0 platform-sidebar-surface border-r">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          {sidebarContent(true)}
        </SheetContent>
      </Sheet>
    </>
  );
}
