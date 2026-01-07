import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getServerSession } from "@/lib/server-session";
import { db } from "@/db";
import { editor, resource } from "@/db/schema";
import ResourcesClient, { type EditorWithResources } from "@/components/ResourcesClient";

export default async function ResourcesPage() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/resources");
  }

  const role = (session.user as { role?: unknown } | undefined)?.role;
  const isAdmin = role === "admin";

  const editors = await db
    .select({
      id: editor.id,
      name: editor.name,
      slug: editor.slug,
      description: editor.description,
      iconUrl: editor.iconUrl,
    })
    .from(editor)
    .orderBy(editor.name);

  const resources = await db
    .select({
      id: resource.id,
      editorId: resource.editorId,
      title: resource.title,
      url: resource.url,
      description: resource.description,
      type: resource.type,
    })
    .from(resource)
    .orderBy(resource.type, resource.createdAt);

  // Group resources by editor
  const resourcesByEditor = new Map<string, typeof resources>();
  for (const r of resources) {
    const list = resourcesByEditor.get(r.editorId) ?? [];
    list.push(r);
    resourcesByEditor.set(r.editorId, list);
  }

  const initial: EditorWithResources[] = editors.map((e) => ({
    id: e.id,
    name: e.name,
    slug: e.slug,
    description: e.description,
    iconUrl: e.iconUrl,
    resources: resourcesByEditor.get(e.id) ?? [],
  }));

  return (
    <AppShell title="Resources">
      <ResourcesClient initial={initial} isAdmin={isAdmin} />
    </AppShell>
  );
}

