"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { BookOpen, ExternalLink, FileText, Plus, Video, X } from "lucide-react";

export type ResourceItem = {
  id: string;
  editorId: string;
  title: string;
  url: string;
  description: string | null;
  type: "video" | "documentation" | "article";
};

export type EditorWithResources = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  resources: ResourceItem[];
};

type ResourceType = "video" | "documentation" | "article";

const TYPE_ICONS = {
  video: Video,
  documentation: BookOpen,
  article: FileText,
};

const TYPE_LABELS = {
  video: "Videos",
  documentation: "Documentation",
  article: "Articles",
};

const TYPE_COLORS = {
  video: "bg-red-500/10 text-red-600 ring-red-500/20",
  documentation: "bg-blue-500/10 text-blue-600 ring-blue-500/20",
  article: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20",
};

export default function ResourcesClient({
  initial,
  isAdmin,
}: {
  initial: EditorWithResources[];
  isAdmin: boolean;
}) {
  const [editors, setEditors] = useState<EditorWithResources[]>(initial);
  const [selectedEditor, setSelectedEditor] = useState<EditorWithResources | null>(null);
  const [showAddEditor, setShowAddEditor] = useState(false);
  const [showAddResource, setShowAddResource] = useState(false);
  const [addingEditor, setAddingEditor] = useState(false);
  const [addingResource, setAddingResource] = useState(false);

  // Resource form state for adding multiple resources at once
  const [newResources, setNewResources] = useState<
    { title: string; url: string; description: string; type: ResourceType }[]
  >([{ title: "", url: "", description: "", type: "documentation" }]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/editors", { method: "GET" });
      const data = (await res.json().catch(() => null)) as { editors?: unknown } | null;
      const rawEditors = Array.isArray(data?.editors) ? (data!.editors as unknown[]) : [];

      const editorsWithResources: EditorWithResources[] = await Promise.all(
        rawEditors.map(async (e) => {
          const ed = e as Partial<EditorWithResources>;
          const editorId = String(ed.id ?? "");

          // Fetch resources for this editor
          const resRes = await fetch(`/api/resources?editorId=${encodeURIComponent(editorId)}`);
          const resData = (await resRes.json().catch(() => null)) as { resources?: unknown } | null;
          const rawResources = Array.isArray(resData?.resources) ? (resData!.resources as unknown[]) : [];

          return {
            id: editorId,
            name: String(ed.name ?? ""),
            slug: String(ed.slug ?? ""),
            description: ed.description ?? null,
            iconUrl: ed.iconUrl ?? null,
            resources: rawResources.map((r) => {
              const res = r as Partial<ResourceItem>;
              return {
                id: String(res.id ?? ""),
                editorId: String(res.editorId ?? ""),
                title: String(res.title ?? ""),
                url: String(res.url ?? ""),
                description: res.description ?? null,
                type: (res.type as ResourceType) ?? "documentation",
              };
            }),
          };
        })
      );

      setEditors(editorsWithResources);

      // Update selected editor if it's open
      if (selectedEditor) {
        const updated = editorsWithResources.find((e) => e.id === selectedEditor.id);
        if (updated) setSelectedEditor(updated);
      }
    } catch {
      toast.error("Failed to refresh");
    }
  }, [selectedEditor]);

  const onCreateEditor = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const name = String(fd.get("name") ?? "").trim();
      const description = String(fd.get("description") ?? "").trim();

      setAddingEditor(true);
      const toastId = toast.loading("Creating editor…");
      try {
        const res = await fetch("/api/editors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        });
        const data = (await res.json().catch(() => null)) as { id?: string; error?: unknown } | null;
        if (!res.ok) {
          const message = typeof data?.error === "string" ? data.error : "Failed to create editor.";
          toast.error(message, { id: toastId });
          setAddingEditor(false);
          return;
        }
        toast.success("Editor created!", { id: toastId });
        e.currentTarget.reset();
        setShowAddEditor(false);
        await refresh();
        setAddingEditor(false);
      } catch {
        toast.error("Failed to create editor.", { id: toastId });
        setAddingEditor(false);
      }
    },
    [refresh]
  );

  const onCreateResources = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!selectedEditor) return;

      const validResources = newResources.filter((r) => r.title.trim() && r.url.trim());
      if (validResources.length === 0) {
        toast.error("Please add at least one resource with title and URL");
        return;
      }

      setAddingResource(true);
      const toastId = toast.loading("Adding resources…");

      try {
        let successCount = 0;
        for (const resource of validResources) {
          const res = await fetch("/api/resources", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              editorId: selectedEditor.id,
              title: resource.title.trim(),
              url: resource.url.trim(),
              description: resource.description.trim() || null,
              type: resource.type,
            }),
          });
          if (res.ok) successCount++;
        }

        if (successCount === validResources.length) {
          toast.success(`Added ${successCount} resource(s)!`, { id: toastId });
        } else {
          toast.success(`Added ${successCount}/${validResources.length} resources`, { id: toastId });
        }

        setNewResources([{ title: "", url: "", description: "", type: "documentation" }]);
        setShowAddResource(false);
        await refresh();
        setAddingResource(false);
      } catch {
        toast.error("Failed to add resources.", { id: toastId });
        setAddingResource(false);
      }
    },
    [selectedEditor, newResources, refresh]
  );

  const addResourceField = () => {
    setNewResources([...newResources, { title: "", url: "", description: "", type: "documentation" }]);
  };

  const updateResourceField = (
    index: number,
    field: keyof (typeof newResources)[0],
    value: string
  ) => {
    const updated = [...newResources];
    updated[index] = { ...updated[index], [field]: value };
    setNewResources(updated);
  };

  const removeResourceField = (index: number) => {
    if (newResources.length > 1) {
      setNewResources(newResources.filter((_, i) => i !== index));
    }
  };

  const deleteResource = useCallback(
    async (resourceId: string) => {
      const toastId = toast.loading("Deleting resource…");
      try {
        const res = await fetch(`/api/resources/${encodeURIComponent(resourceId)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          toast.error("Failed to delete resource", { id: toastId });
          return;
        }
        toast.success("Resource deleted", { id: toastId });
        await refresh();
      } catch {
        toast.error("Failed to delete resource", { id: toastId });
      }
    },
    [refresh]
  );

  const deleteEditor = useCallback(
    async (editorId: string) => {
      const toastId = toast.loading("Deleting editor…");
      try {
        const res = await fetch(`/api/editors/${encodeURIComponent(editorId)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          toast.error("Failed to delete editor", { id: toastId });
          return;
        }
        toast.success("Editor deleted", { id: toastId });
        setSelectedEditor(null);
        await refresh();
      } catch {
        toast.error("Failed to delete editor", { id: toastId });
      }
    },
    [refresh]
  );

  const groupResourcesByType = (resources: ResourceItem[]) => {
    const grouped: Record<ResourceType, ResourceItem[]> = {
      video: [],
      documentation: [],
      article: [],
    };
    for (const r of resources) {
      grouped[r.type].push(r);
    }
    return grouped;
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Explore resources for building plugins and extensions for different editors and programs.
      </p>

      {editors.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="text-foreground font-semibold text-lg">No editors yet</div>
          <div className="text-muted-foreground mt-1">
            Add an editor to get started.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {editors.map((ed) => (
            <button
              key={ed.id}
              onClick={() => setSelectedEditor(ed)}
              className="bg-card border border-border rounded-2xl p-6 card-glow transition-all hover:bg-muted text-left w-full"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-foreground font-bold text-xl truncate">{ed.name}</div>
                  {ed.description && (
                    <div className="text-muted-foreground mt-2 text-sm line-clamp-2">
                      {ed.description}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <BookOpen size={16} />
                <span>
                  {ed.resources.length} resource{ed.resources.length !== 1 ? "s" : ""}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Editor Detail Modal */}
      {selectedEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-auto">
            <div className="sticky top-0 bg-card border-b border-border p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{selectedEditor.name}</h2>
                {selectedEditor.description && (
                  <p className="text-muted-foreground mt-1">{selectedEditor.description}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedEditor(null)}
                className="text-muted-foreground hover:text-foreground p-2"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {selectedEditor.resources.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground">No resources yet for this editor.</div>
                  <button
                    onClick={() => setShowAddResource(true)}
                    className="mt-4 inline-flex items-center gap-2 bg-carnival-red hover:bg-carnival-red/80 text-white px-6 py-3 rounded-full font-bold transition-colors"
                  >
                    <Plus size={18} />
                    Add Resources
                  </button>
                </div>
              ) : (
                <>
                  {(["video", "documentation", "article"] as ResourceType[]).map((type) => {
                    const grouped = groupResourcesByType(selectedEditor.resources);
                    const items = grouped[type];
                    if (items.length === 0) return null;

                    const Icon = TYPE_ICONS[type];

                    return (
                      <div key={type}>
                        <h3 className="flex items-center gap-2 text-foreground font-semibold mb-3">
                          <Icon size={18} className="text-muted-foreground" />
                          {TYPE_LABELS[type]}
                        </h3>
                        <div className="space-y-2">
                          {items.map((r) => (
                            <div
                              key={r.id}
                              className="flex items-start justify-between gap-4 bg-muted/50 rounded-xl p-4"
                            >
                              <div className="min-w-0 flex-1">
                                <a
                                  href={r.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-foreground font-medium hover:text-carnival-blue flex items-center gap-2"
                                >
                                  {r.title}
                                  <ExternalLink size={14} className="shrink-0" />
                                </a>
                                {r.description && (
                                  <p className="text-muted-foreground text-sm mt-1">{r.description}</p>
                                )}
                              </div>
                              <span
                                className={`shrink-0 px-2 py-1 text-xs font-medium rounded-full ring-1 ${TYPE_COLORS[type]}`}
                              >
                                {type}
                              </span>
                              {isAdmin && (
                                <button
                                  onClick={() => deleteResource(r.id)}
                                  className="shrink-0 text-red-500 hover:text-red-600 p-1"
                                  title="Delete resource"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <div className="pt-4 border-t border-border">
                    <button
                      onClick={() => setShowAddResource(true)}
                      className="inline-flex items-center gap-2 bg-carnival-blue/20 hover:bg-carnival-blue/30 text-foreground px-5 py-2 rounded-full font-semibold transition-colors border border-border"
                    >
                      <Plus size={16} />
                      Add More Resources
                    </button>
                  </div>
                </>
              )}

              {isAdmin && (
                <div className="pt-4 border-t border-border">
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `Are you sure you want to delete "${selectedEditor.name}"? This will also delete all its resources.`
                        )
                      ) {
                        deleteEditor(selectedEditor.id);
                      }
                    }}
                    className="text-red-500 hover:text-red-600 text-sm font-medium"
                  >
                    Delete this editor
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Editor Modal */}
      {showAddEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Add New Editor</h2>
              <button
                onClick={() => setShowAddEditor(false)}
                className="text-muted-foreground hover:text-foreground p-2"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={onCreateEditor} className="p-6 space-y-4">
              <label className="block">
                <div className="text-sm text-muted-foreground font-medium mb-2">Name</div>
                <input
                  name="name"
                  required
                  className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                  placeholder="e.g., VS Code, Neovim, Blender"
                  disabled={addingEditor}
                />
              </label>

              <label className="block">
                <div className="text-sm text-muted-foreground font-medium mb-2">
                  Description (optional)
                </div>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                  placeholder="Brief description of the editor/program"
                  disabled={addingEditor}
                />
              </label>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddEditor(false)}
                  className="px-5 py-2 rounded-full font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  disabled={addingEditor}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingEditor}
                  className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-full font-bold transition-colors"
                >
                  {addingEditor ? "Creating…" : "Create Editor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Resources Modal */}
      {showAddResource && selectedEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-auto">
            <div className="sticky top-0 bg-card p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Add Resources</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Adding resources to {selectedEditor.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddResource(false);
                  setNewResources([{ title: "", url: "", description: "", type: "documentation" }]);
                }}
                className="text-muted-foreground hover:text-foreground p-2"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={onCreateResources} className="p-6 space-y-6">
              {newResources.map((resource, index) => (
                <div key={index} className="bg-muted/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Resource {index + 1}
                    </span>
                    {newResources.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeResourceField(index)}
                        className="text-red-500 hover:text-red-600 p-1"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <div className="text-xs text-muted-foreground font-medium mb-1">Title</div>
                      <input
                        value={resource.title}
                        onChange={(e) => updateResourceField(index, "title", e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                        placeholder="Resource title"
                        disabled={addingResource}
                      />
                    </label>

                    <label className="block">
                      <div className="text-xs text-muted-foreground font-medium mb-1">Type</div>
                      <select
                        value={resource.type}
                        onChange={(e) =>
                          updateResourceField(index, "type", e.target.value as ResourceType)
                        }
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                        disabled={addingResource}
                      >
                        <option value="video">Video</option>
                        <option value="documentation">Documentation</option>
                        <option value="article">Article</option>
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <div className="text-xs text-muted-foreground font-medium mb-1">URL</div>
                    <input
                      type="url"
                      value={resource.url}
                      onChange={(e) => updateResourceField(index, "url", e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                      placeholder="https://..."
                      disabled={addingResource}
                    />
                  </label>

                  <label className="block">
                    <div className="text-xs text-muted-foreground font-medium mb-1">
                      Description (optional)
                    </div>
                    <input
                      value={resource.description}
                      onChange={(e) => updateResourceField(index, "description", e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
                      placeholder="Brief description"
                      disabled={addingResource}
                    />
                  </label>
                </div>
              ))}

              <button
                type="button"
                onClick={addResourceField}
                className="w-full py-3 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors flex items-center justify-center gap-2"
                disabled={addingResource}
              >
                <Plus size={18} />
                Add Another Resource
              </button>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddResource(false);
                    setNewResources([{ title: "", url: "", description: "", type: "documentation" }]);
                  }}
                  className="px-5 py-2 rounded-full font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  disabled={addingResource}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingResource}
                  className="inline-flex items-center justify-center bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-full font-bold transition-colors"
                >
                  {addingResource ? "Adding…" : "Add Resources"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FAB - All users can add editors */}
      <button
        onClick={() => setShowAddEditor(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-carnival-red hover:bg-carnival-red/80 text-white flex items-center justify-center shadow-xl border border-border carnival-glow transition-all hover:scale-105"
        aria-label="Add new editor"
        title="Add new editor"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}

