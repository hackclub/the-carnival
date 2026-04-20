"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import {
  Ban,
  ClipboardCheck,
  ClipboardList,
  Compass,
  FolderKanban,
  Gift,
  MessageSquare,
  LucideIcon,
  ShoppingBag,
  Trophy,
  User,
  Users,
  BookOpen,
  Shield,
} from "lucide-react";

type UserRole = "user" | "reviewer" | "admin" | null;

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
  { href: "/bounties", label: "Bounties", icon: Trophy },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/resources", label: "Resources", icon: BookOpen },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
  { href: "/account", label: "Account", icon: User },
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
      { id: "ops", title: "Operations", items: [...REVIEW_NAV, ...ADMIN_NAV] },
      { id: "workspace", title: "Workspace", items: WORKSPACE_NAV },
    ];
  }

  if (role === "reviewer") {
    return [
      { id: "ops", title: "Operations", items: REVIEW_NAV },
      { id: "workspace", title: "Workspace", items: WORKSPACE_NAV },
    ];
  }

  return [{ id: "workspace", title: "Workspace", items: WORKSPACE_NAV }];
}

export default function AppSidebar() {
  const pathname = usePathname();
  const { data } = useSession();

  type SessionUser = { role?: string | null };
  const rawRole = (data as { user?: SessionUser } | null | undefined)?.user?.role ?? null;
  const role = asUserRole(rawRole);
  const sections = getNavSections(role);

  return (
    <aside className="w-full md:w-72 md:shrink-0">
      <div className="platform-sidebar-surface border-b md:border-b-0 md:border-r md:sticky md:top-0 md:h-screen md:overflow-auto">
        <div className="px-5 pt-5 pb-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(116,33,10,0.2)] bg-[rgba(255,247,220,0.95)] px-4 py-2 shadow-[0_10px_24px_rgba(120,53,15,0.12)]">
            <span className="text-xl leading-none">🎪</span>
            <span className="text-sm font-black uppercase tracking-[0.08em] text-[var(--platform-ink)]">
              Carnival
            </span>
          </div>
          <div className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--platform-ink-muted)]">
            Dashboard
          </div>
        </div>

        <nav className="space-y-5 px-3 pb-7">
          {sections.map((section) => (
            <section key={section.id} className="space-y-2">
              {sections.length > 1 || section.title !== "Workspace" ? (
                <div className="platform-nav-section-label">{section.title}</div>
              ) : null}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-active={active ? "true" : "false"}
                      className="platform-nav-link"
                    >
                      <Icon size={17} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </div>
    </aside>
  );
}
