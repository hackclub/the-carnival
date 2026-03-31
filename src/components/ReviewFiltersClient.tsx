"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export type ReviewFilter = {
  label: string;
  value: string;
};

export default function ReviewFiltersClient({
  filters,
  defaultValue,
}: {
  filters: ReviewFilter[];
  defaultValue: string;
}) {
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const allowed = useMemo(() => new Set(filters.map((f) => f.value)), [filters]);
  const active = allowed.has(statusParam ?? "") ? (statusParam as string) : defaultValue;

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {filters.map((f) => {
        const isActive = f.value === active;
        const params = new URLSearchParams(searchParams.toString());
        params.set("status", f.value);
        const href = `/review?${params.toString()}`;
        return (
          <Link
            key={f.value}
            href={href}
            className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "bg-carnival-red text-white border-carnival-red"
                : "bg-card text-foreground border-border hover:bg-muted"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {f.label}
          </Link>
        );
      })}
    </div>
  );
}
