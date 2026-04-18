"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

type Props = {
  projectId: string;
  devlogId: string;
  canEdit: boolean;
  canDelete: boolean;
};

export default function DevlogViewActions({ projectId, devlogId, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Delete this devlog? This cannot be undone.")) return;
    setError(null);
    setDeleting(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/devlogs/${devlogId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Failed (${response.status})`);
        setDeleting(false);
        return;
      }
      router.push(`/projects/${projectId}/devlogs`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {canEdit ? (
        <Link href={`/projects/${projectId}/devlogs/${devlogId}/edit`}>
          <Button variant="secondary">Edit</Button>
        </Link>
      ) : null}
      {canDelete ? (
        <Button
          variant="outline"
          onClick={handleDelete}
          loading={deleting}
          loadingText="Deleting…"
        >
          Delete
        </Button>
      ) : null}
      {error ? <span className="text-sm text-carnival-red">{error}</span> : null}
    </div>
  );
}
