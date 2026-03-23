"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import {
  Trophy,
  FolderKanban,
  Compass,
  BookOpen,
  ShoppingBag,
  User,
  ClipboardCheck,
  Gift,
  Users,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV: NavItem[] = [
  { href: "/bounties", label: "Bounties", icon: Trophy },
  { href: "/projects", label: "My projects", icon: FolderKanban },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/resources", label: "Resources", icon: BookOpen },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
  { href: "/account", label: "Account", icon: User },
];

function isNavItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navItemClassName(isActive: boolean) {
  return [
    "flex min-h-11 shrink-0 items-center gap-2.5 rounded-[1.05rem] border-[3px] px-4 py-2.5 text-sm font-black uppercase tracking-[0.04em] transition-[transform,background-color,box-shadow,color] duration-200 md:w-full",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#74210a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#ffe9a8]",
    isActive
      ? "border-[#74210a] bg-[#f6a61c] text-[#fff7dc] shadow-[0_4px_0_#bf6216,0_12px_22px_rgba(120,53,15,0.16)]"
      : "border-[#d78b22] bg-[#fff7dc] text-[#7b240a] shadow-[0_3px_0_#d78b22] hover:-translate-y-0.5 hover:bg-[#ffe2b0] hover:shadow-[0_6px_0_#d78b22]",
  ].join(" ");
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  pathname,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  pathname: string;
}) {
  const isActive = isNavItemActive(pathname, href);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={navItemClassName(isActive)}
    >
      <Icon size={17} aria-hidden />
      <span>{label}</span>
    </Link>
  );
}

function NavRow({
  label,
  items,
  pathname,
}: {
  label?: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div>
      {label ? (
        <p className="mb-2 hidden px-2 text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#7b240a]/80 md:block">
          {label}
        </p>
      ) : null}
      <div className="flex gap-2 overflow-x-auto pb-2 md:block md:space-y-2 md:overflow-visible md:pb-0">
        {items.map((item) => (
          <SidebarLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            pathname={pathname}
          />
        ))}
      </div>
    </div>
  );
}

export default function AppSidebar() {
  const pathname = usePathname() ?? "";
  const { data } = useSession();

  type SessionUser = { role?: string | null };
  const role = (data as { user?: SessionUser } | null | undefined)?.user?.role ?? null;
  const canReview = role === "reviewer" || role === "admin";
  const isAdmin = role === "admin";
  const reviewItems: NavItem[] = [
    { href: "/review", label: "Review", icon: ClipboardCheck },
    { href: "/admin/shop", label: "Shop (Staff)", icon: ShoppingBag },
  ];
  const adminItems: NavItem[] = [
    { href: "/admin/orders", label: "Orders", icon: ClipboardList },
    { href: "/admin/grants", label: "Grants", icon: Gift },
    { href: "/admin/users", label: "Users", icon: Users },
  ];

  return (
    <aside className="w-full md:w-[18rem] md:shrink-0">
      <div className="relative overflow-hidden rounded-[2rem] border-[5px] border-[#6f260a] bg-[linear-gradient(180deg,#ffd66c_0%,#f6a61c_100%)] shadow-[0_10px_0_#bf6216,0_24px_42px_rgba(120,53,15,0.18)] md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:overflow-y-auto">
        <div className="carnival-paper-grid pointer-events-none absolute inset-0 opacity-20" />

        <div className="relative border-b border-[#74210a]/25 px-5 py-5">
          <div className="text-[#5b1f0a] font-black text-lg uppercase tracking-[0.08em] flex items-center gap-2">
            <span className="text-xl">🎪</span>
            <span>Carnival</span>
          </div>
          <div className="text-[#7b240a] text-sm mt-1">Your dashboard</div>
        </div>

        <nav className="relative space-y-2 px-3 py-4" aria-label="Primary navigation">
          <NavRow items={NAV} pathname={pathname} />
          {canReview ? <NavRow label="Staff" items={reviewItems} pathname={pathname} /> : null}
          {isAdmin ? <NavRow label="Admin" items={adminItems} pathname={pathname} /> : null}
        </nav>
      </div>
    </aside>
  );
}

