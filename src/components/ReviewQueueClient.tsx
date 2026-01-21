"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ProjectEditorBadge from "@/components/ProjectEditorBadge";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";

export type ReviewQueueProject = {
  id: string;
  name: string;
  description: string;
  editor: string;
  editorOther: string | null;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  creatorName: string | null;
};

type FilterKey = "pending" | "approved" | "rejected";

const FILTERS: Array<{ value: FilterKey }> = [
  { value: "pending" },
  { value: "approved" },
  { value: "rejected" },
];

export default function ReviewQueueClient() {
  const searchParams = useSearchParams();
  const rawStatus = searchParams.get("status");
  const allowed = useMemo(() => new Set(FILTERS.map((f) => f.value)), []);
  const activeFilter: FilterKey = allowed.has(rawStatus as FilterKey)
    ? (rawStatus as FilterKey)
    : "pending";

  const [projects, setProjects] = useState<ReviewQueueProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setProjects(null);
    setError(null);

    const url = `/api/review/projects?status=${encodeURIComponent(activeFilter)}`;

    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as
          | { projects?: ReviewQueueProject[]; error?: string }
          | null;
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load projects.");
        }
        if (!cancelled) {
          setProjects(data?.projects ?? []);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load projects.");
          setProjects([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeFilter]);

  if (projects === null) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8">
        <div className="text-foreground font-semibold text-lg">Loading projects…</div>
        <div className="text-muted-foreground mt-1">Fetching the latest review queue.</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8">
        <div className="text-foreground font-semibold text-lg">Could not load projects</div>
        <div className="text-muted-foreground mt-1">{error}</div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8">
        <div className="text-foreground font-semibold text-lg">No projects</div>
        <div className="text-muted-foreground mt-1">
          Projects show up here when creators submit them for review.
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {projects.map((p) => (
        <Link
          key={p.id}
          href={`/review/${p.id}`}
          className="bg-card border border-border rounded-2xl p-6 card-glow transition-all hover:bg-muted block"
          aria-label={`Review ${p.name}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-foreground font-bold text-xl truncate">{p.name}</div>
              <div className="text-muted-foreground text-sm mt-1 truncate">
                by {p.creatorName || "Unknown creator"}
              </div>
              <div className="text-muted-foreground mt-3 overflow-hidden">{p.description}</div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <ProjectEditorBadge
                editor={p.editor as "vscode" | "chrome" | "firefox" | "figma" | "neovim" | "gnu-emacs" | "jupyterlab" | "obsidian" | "blender" | "freecad" | "kicad" | "krita" | "gimp" | "inkscape" | "godot-engine" | "unity" | "other"}
                editorOther={p.editorOther ?? ""}
              />
              <ProjectStatusBadge status={p.status as "shipped" | "granted" | "in-review" | "work-in-progress"} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
