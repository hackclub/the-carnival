"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "@/components/SidebarContext";

type DashboardTopBarProps = {
  title: string;
};

export default function DashboardTopBar({ title }: DashboardTopBarProps) {
  const { setMobileOpen } = useSidebar();

  return (
    <header className="platform-appbar-surface sticky top-0 z-40 flex h-16 w-full items-center gap-3 px-4 md:px-6">
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="inline-flex items-center justify-center rounded-[var(--radius-xl)] p-2 text-[var(--platform-ink-muted)] transition-colors hover:bg-[rgba(255,240,207,0.8)] hover:text-[var(--platform-ink)] md:hidden"
        aria-label="Open navigation"
      >
        <Menu size={22} />
      </button>
      <h1 className="text-lg font-black tracking-[0.02em] text-[var(--platform-ink)] truncate">
        {title}
      </h1>
    </header>
  );
}
