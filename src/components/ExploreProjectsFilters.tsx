"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ExploreFilterOption = { value: string; label: string };

export default function ExploreProjectsFilters({
  statusOptions,
  categoryOptions,
  tagOptions,
  initialStatus,
  initialCategory,
  initialTag,
}: {
  statusOptions: ExploreFilterOption[];
  categoryOptions: ExploreFilterOption[];
  tagOptions: ExploreFilterOption[];
  initialStatus: string;
  initialCategory: string;
  initialTag: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [category, setCategory] = useState(initialCategory);
  const [tag, setTag] = useState(initialTag);

  const triggerClass =
    "w-full h-11 rounded-[var(--radius-xl)] border-input bg-background px-3 text-sm text-foreground";

  return (
    <>
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="tag" value={tag} />

      <div>
        <span className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
          Status
        </span>
        <Select value={status} onValueChange={(v) => { if (v) setStatus(v); }}>
          <SelectTrigger className={triggerClass}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <span className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
          Category
        </span>
        <Select
          value={category || "__all__"}
          onValueChange={(v) => {
            if (!v) return;
            setCategory(v === "__all__" ? "" : v);
          }}
        >
          <SelectTrigger className={triggerClass}>
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            {categoryOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <span className="block text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
          Tag
        </span>
        <Select
          value={tag || "__all__"}
          onValueChange={(v) => {
            if (!v) return;
            setTag(v === "__all__" ? "" : v);
          }}
        >
          <SelectTrigger className={triggerClass}>
            <SelectValue placeholder="All tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All tags</SelectItem>
            {tagOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
