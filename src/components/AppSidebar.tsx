"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";

type NavItem = {
  href: string;
  label: string;
};

const NAV: NavItem[] = [
  { href: "/bounties", label: "Bounties" },
  { href: "/projects", label: "My projects" },
  { href: "/explore", label: "Explore" },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const { data } = useSession();

  type SessionUser = { role?: string | null };
  const role = (data as { user?: SessionUser } | null | undefined)?.user?.role ?? null;
  const canReview = role === "reviewer" || role === "admin";
  const isAdmin = role === "admin";

  return (
    <aside className="w-full md:w-64 md:shrink-0">
      <div className="md:sticky md:top-0 md:h-screen md:overflow-auto border-b md:border-b-0 md:border-r border-border bg-background/80 backdrop-blur">
        <div className="px-5 py-5">
          <div className="text-foreground font-bold text-lg flex items-center gap-2">
            <span className="text-xl">🎪</span>
            <span>Carnival</span>
          </div>
          <div className="text-muted-foreground text-sm mt-1">Your dashboard</div>
        </div>

        <nav className="px-3 pb-6">
          {NAV.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "block rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-carnival-blue/15 text-foreground border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}

          {canReview ? (
            <Link
              href="/review"
              className={[
                "block rounded-xl px-4 py-3 text-sm font-medium transition-colors mt-2",
                pathname === "/review" || pathname?.startsWith("/review/")
                  ? "bg-carnival-blue/15 text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              ].join(" ")}
            >
              Review
            </Link>
          ) : null}

          {isAdmin ? (
            <div className="mt-2 space-y-2">
              <Link
                href="/admin/grants"
                className={[
                  "block rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                  pathname === "/admin/grants" || pathname?.startsWith("/admin/grants/")
                    ? "bg-carnival-blue/15 text-foreground border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                ].join(" ")}
              >
                Grants
              </Link>
              <Link
                href="/admin/users"
                className={[
                  "block rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                  pathname === "/admin/users" || pathname?.startsWith("/admin/users/")
                    ? "bg-carnival-blue/15 text-foreground border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                ].join(" ")}
              >
                Users
              </Link>
            </div>
          ) : null}
        </nav>
      </div>
    </aside>
  );
}


