"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button, Card, CardContent, PlatformNestedSurface } from "@/components/ui";

type LinkedProject = {
  id: string;
  name: string;
  isDefault: boolean;
  firstDevlogId: string | null;
};

type HackatimeProject = {
  name: string;
  totalSeconds: number;
  startedAt: string | null;
  stoppedAt: string | null;
};

type Props = {
  projectId: string;
  readonly?: boolean;
};

export default function LinkedHackatimeProjectsPanel({ projectId, readonly = false }: Props) {
  const [linked, setLinked] = useState<LinkedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userProjects, setUserProjects] = useState<HackatimeProject[]>([]);
  const [userProjectsLoading, setUserProjectsLoading] = useState(false);

  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadLinked = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/hackatime-projects`);
      const data = (await res.json().catch(() => null)) as
        | { projects?: unknown; error?: unknown }
        | null;
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to load linked projects.");
        setLinked([]);
      } else {
        setLinked(
          Array.isArray(data?.projects)
            ? (data.projects as LinkedProject[])
            : [],
        );
      }
    } catch {
      setError("Failed to load linked projects.");
      setLinked([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadUserProjects = useCallback(async () => {
    if (readonly) return;
    setUserProjectsLoading(true);
    try {
      const res = await fetch("/api/hackatime/projects");
      const data = (await res.json().catch(() => null)) as
        | { projects?: unknown; error?: unknown }
        | null;
      if (res.ok && Array.isArray(data?.projects)) {
        setUserProjects(
          (data.projects as HackatimeProject[]).filter(
            (p): p is HackatimeProject => typeof p.name === "string" && p.name.trim().length > 0,
          ),
        );
      }
    } catch {
      // Non-critical — user can still type a name manually
    } finally {
      setUserProjectsLoading(false);
    }
  }, [readonly]);

  useEffect(() => {
    void loadLinked();
    void loadUserProjects();
  }, [loadLinked, loadUserProjects]);

  const linkedNameSet = useMemo(
    () => new Set(linked.map((p) => p.name.toLowerCase())),
    [linked],
  );

  const suggestedProjects = useMemo(
    () => userProjects.filter((p) => !linkedNameSet.has(p.name.toLowerCase())),
    [userProjects, linkedNameSet],
  );

  async function handleAdd() {
    const name = addName.trim();
    if (!name) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/hackatime-projects`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );
      const data = (await res.json().catch(() => null)) as
        | { projects?: unknown; error?: unknown }
        | null;
      if (!res.ok) {
        setAddError(
          typeof data?.error === "string" ? data.error : "Failed to add project.",
        );
      } else {
        setLinked(Array.isArray(data?.projects) ? (data.projects as LinkedProject[]) : []);
        setAddName("");
        toast.success(`"${name}" linked.`);
      }
    } catch {
      setAddError("Failed to add project.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(name: string) {
    setRemovingId(name);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/hackatime-projects?name=${encodeURIComponent(name)}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => null)) as
        | { projects?: unknown; error?: unknown }
        | null;
      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : "Failed to remove project.";
        toast.error(msg);
      } else {
        setLinked(Array.isArray(data?.projects) ? (data.projects as LinkedProject[]) : []);
        toast.success(`"${name}" unlinked.`);
      }
    } catch {
      toast.error("Failed to remove project.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div>
          <div className="font-semibold text-foreground">Linked Hackatime projects</div>
          <p className="text-xs text-muted-foreground mt-1">
            All Hackatime project names that count toward this carnival project.
            Devlogs can be posted against any of these. Projects are also added here
            automatically when you post a devlog with a new project name.
          </p>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-200">{error}</div>
        ) : linked.length === 0 ? (
          <PlatformNestedSurface className="px-3 py-2 text-sm text-muted-foreground">
            No Hackatime projects linked yet. Add one below or post a devlog to link
            automatically.
          </PlatformNestedSurface>
        ) : (
          <ul className="space-y-1.5">
            {linked.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-xl)] border border-border bg-background px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <code className="text-sm text-foreground truncate">{p.name}</code>
                  {p.isDefault ? (
                    <span className="flex-shrink-0 text-xs font-semibold text-carnival-blue bg-carnival-blue/10 border border-carnival-blue/30 rounded-full px-2 py-0.5">
                      default
                    </span>
                  ) : null}
                  {p.firstDevlogId ? (
                    <span className="flex-shrink-0 text-xs text-muted-foreground">
                      has devlogs
                    </span>
                  ) : null}
                </div>
                {!readonly ? (
                  <button
                    type="button"
                    onClick={() => handleRemove(p.name)}
                    disabled={removingId === p.name}
                    className="flex-shrink-0 text-xs text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
                    title={p.firstDevlogId ? "Cannot remove — has devlogs" : "Remove"}
                  >
                    {removingId === p.name ? "Removing…" : "Remove"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {!readonly ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">Add a Hackatime project</div>
            <div className="flex gap-2">
              {suggestedProjects.length > 0 ? (
                <select
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="flex-1 bg-background border border-border rounded-[var(--radius-xl)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40 appearance-none min-w-0"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%237b240a' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: "right 0.75rem center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "1.25em 1.25em",
                  }}
                >
                  <option value="">
                    {userProjectsLoading ? "Loading projects…" : "Select or type below…"}
                  </option>
                  {suggestedProjects.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); void handleAdd(); }
                }}
                placeholder="Project name…"
                className="flex-1 bg-background border border-border rounded-[var(--radius-xl)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40 min-w-0"
              />
              <Button
                type="button"
                variant="primary"
                onClick={handleAdd}
                disabled={!addName.trim() || adding}
                loading={adding}
                loadingText="Adding…"
              >
                Add
              </Button>
            </div>
            {addError ? (
              <div className="text-xs text-red-200">{addError}</div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
