"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { BookOpen, ExternalLink, FileText, Plus, Video, X } from "lucide-react";
import { Input, Select, Button, Modal, Card, Badge, EmptyState } from "@/components/ui";

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

const TYPE_CONFIG = {
  video: { icon: Video, label: "Videos", variant: "error" as const },
  documentation: { icon: BookOpen, label: "Documentation", variant: "info" as const },
  article: { icon: FileText, label: "Articles", variant: "emerald" as const },
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
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
        if (!res.ok) {
          toast.error(typeof data?.error === "string" ? data.error : "Failed to create editor.", { id: toastId });
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

        toast.success(
          successCount === validResources.length
            ? `Added ${successCount} resource(s)!`
            : `Added ${successCount}/${validResources.length} resources`,
          { id: toastId }
        );

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

  const updateResourceField = (index: number, field: keyof (typeof newResources)[0], value: string) => {
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
        const res = await fetch(`/api/resources/${encodeURIComponent(resourceId)}`, { method: "DELETE" });
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
        const res = await fetch(`/api/editors/${encodeURIComponent(editorId)}`, { method: "DELETE" });
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
    const grouped: Record<ResourceType, ResourceItem[]> = { video: [], documentation: [], article: [] };
    for (const r of resources) grouped[r.type].push(r);
    return grouped;
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Explore resources for building plugins and extensions for different editors and programs.
      </p>

      {editors.length === 0 ? (
        <EmptyState title="No editors yet" description="Add an editor to get started." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {editors.map((ed) => (
            <Card
              key={ed.id}
              interactive
              onClick={() => setSelectedEditor(ed)}
              className="p-6 text-left w-full"
            >
              <div className="text-foreground font-bold text-xl truncate">{ed.name}</div>
              {ed.description && (
                <div className="text-muted-foreground mt-2 text-sm line-clamp-2">{ed.description}</div>
              )}
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <BookOpen size={16} />
                <span>{ed.resources.length} resource{ed.resources.length !== 1 ? "s" : ""}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Editor Detail Modal */}
      {selectedEditor && (
        <Modal
          open={true}
          onClose={() => setSelectedEditor(null)}
          title={selectedEditor.name}
          description={selectedEditor.description ?? undefined}
          maxWidth="2xl"
        >
          <div className="space-y-6">
            {selectedEditor.resources.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground">No resources yet for this editor.</div>
                <Button className="mt-4" onClick={() => setShowAddResource(true)}>
                  <Plus size={18} className="mr-2" />
                  Add Resources
                </Button>
              </div>
            ) : (
              <>
                {(["video", "documentation", "article"] as ResourceType[]).map((type) => {
                  const items = groupResourcesByType(selectedEditor.resources)[type];
                  if (items.length === 0) return null;
                  const { icon: Icon, label, variant } = TYPE_CONFIG[type];

                  return (
                    <div key={type}>
                      <h3 className="flex items-center gap-2 text-foreground font-semibold mb-3">
                        <Icon size={18} className="text-muted-foreground" />
                        {label}
                      </h3>
                      <div className="space-y-2">
                        {items.map((r) => (
                          <div key={r.id} className="flex items-start justify-between gap-4 bg-muted/50 rounded-xl p-4">
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
                              {r.description && <p className="text-muted-foreground text-sm mt-1">{r.description}</p>}
                            </div>
                            <Badge variant={variant}>{type}</Badge>
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
                  <Button variant="secondary" onClick={() => setShowAddResource(true)}>
                    <Plus size={16} className="mr-2" />
                    Add More Resources
                  </Button>
                </div>
              </>
            )}

            {isAdmin && (
              <div className="pt-4 border-t border-border">
                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete "${selectedEditor.name}"? This will also delete all its resources.`)) {
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
        </Modal>
      )}

      {/* Add Editor Modal */}
      <Modal open={showAddEditor} onClose={() => setShowAddEditor(false)} title="Add New Editor">
        <form onSubmit={onCreateEditor} className="space-y-4">
          <Input name="name" label="Name" required placeholder="e.g., VS Code, Neovim, Blender" disabled={addingEditor} />
          <Input name="description" label="Description (optional)" placeholder="Brief description of the editor/program" disabled={addingEditor} />
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowAddEditor(false)} disabled={addingEditor}>
              Cancel
            </Button>
            <Button type="submit" loading={addingEditor} loadingText="Creating…">
              Create Editor
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Resources Modal */}
      {selectedEditor && (
        <Modal
          open={showAddResource}
          onClose={() => {
            setShowAddResource(false);
            setNewResources([{ title: "", url: "", description: "", type: "documentation" }]);
          }}
          title="Add Resources"
          description={`Adding resources to ${selectedEditor.name}`}
          maxWidth="2xl"
        >
          <form onSubmit={onCreateResources} className="space-y-6">
            {newResources.map((resource, index) => (
              <div key={index} className="bg-muted/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Resource {index + 1}</span>
                  {newResources.length > 1 && (
                    <button type="button" onClick={() => removeResourceField(index)} className="text-red-500 hover:text-red-600 p-1">
                      <X size={16} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    size="small"
                    label="Title"
                    value={resource.title}
                    onChange={(e) => updateResourceField(index, "title", e.target.value)}
                    placeholder="Resource title"
                    disabled={addingResource}
                  />
                  <Select
                    size="small"
                    label="Type"
                    value={resource.type}
                    onChange={(e) => updateResourceField(index, "type", e.target.value as ResourceType)}
                    disabled={addingResource}
                  >
                    <option value="video">Video</option>
                    <option value="documentation">Documentation</option>
                    <option value="article">Article</option>
                  </Select>
                </div>

                <Input
                  size="small"
                  label="URL"
                  type="url"
                  value={resource.url}
                  onChange={(e) => updateResourceField(index, "url", e.target.value)}
                  placeholder="https://..."
                  disabled={addingResource}
                />
                <Input
                  size="small"
                  label="Description (optional)"
                  value={resource.description}
                  onChange={(e) => updateResourceField(index, "description", e.target.value)}
                  placeholder="Brief description"
                  disabled={addingResource}
                />
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
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setShowAddResource(false);
                  setNewResources([{ title: "", url: "", description: "", type: "documentation" }]);
                }}
                disabled={addingResource}
              >
                Cancel
              </Button>
              <Button type="submit" loading={addingResource} loadingText="Adding…">
                Add Resources
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* FAB */}
      <Button variant="fab" onClick={() => setShowAddEditor(true)} aria-label="Add new editor" title="Add new editor">
        <Plus size={24} />
      </Button>
    </div>
  );
}
