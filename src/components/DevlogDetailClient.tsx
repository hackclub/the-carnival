"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { Badge, Button, Card, CardContent } from "@/components/ui";
import { formatDurationHM } from "@/lib/devlogs";

export type DevlogDetail = {
  id: string;
  title: string;
  content: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  attachments: string[];
  usedAi: boolean;
  aiUsageDescription: string | null;
  hackatimeProjectNameSnapshot: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DevlogDetailClient({
  projectId,
  projectName,
  devlog,
  canEdit,
  canDelete,
}: {
  projectId: string;
  projectName: string;
  devlog: DevlogDetail;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const duration = formatDurationHM(devlog.durationSeconds);

  const onDelete = async () => {
    if (!canDelete) return;
    if (
      !window.confirm(
        "Delete this devlog? The hours it logged will be removed from your project's total.",
      )
    ) {
      return;
    }
    setDeleting(true);
    const toastId = toast.loading("Deleting devlog…");
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/devlogs/${encodeURIComponent(devlog.id)}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : "Failed to delete devlog.";
        toast.error(msg, { id: toastId });
        setDeleting(false);
        return;
      }
      toast.success("Devlog deleted.", { id: toastId });
      router.push(`/projects/${projectId}/devlogs`);
      router.refresh();
    } catch {
      toast.error("Failed to delete devlog.", { id: toastId });
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground mb-1">{projectName}</div>
              <h1 className="text-2xl font-semibold text-foreground">{devlog.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{devlog.authorName}</span>
                <span>·</span>
                <span>
                  {formatDateTime(devlog.startedAt)} → {formatDateTime(devlog.endedAt)}
                </span>
                <Badge variant="info">{duration.label}</Badge>
                {devlog.usedAi ? <Badge variant="warning">AI</Badge> : null}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canEdit ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    router.push(`/projects/${projectId}/devlogs/${devlog.id}/edit`)
                  }
                >
                  Edit
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  variant="outline"
                  onClick={onDelete}
                  loading={deleting}
                  loadingText="Deleting…"
                  className="border-carnival-red/50 text-carnival-red hover:bg-carnival-red/10"
                >
                  Delete
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {devlog.attachments.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="font-semibold text-foreground mb-3">Attachments</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {devlog.attachments.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a
                  key={`${url}-${i}`}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block"
                >
                  <img
                    src={url}
                    alt=""
                    className="w-full rounded-xl border border-border bg-muted object-cover"
                    referrerPolicy="no-referrer"
                  />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <div className="font-semibold text-foreground mb-2">Description</div>
          <div className="text-foreground whitespace-pre-wrap">{devlog.content}</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-2 text-sm">
          <div className="font-semibold text-foreground">AI declaration</div>
          {devlog.usedAi ? (
            <div className="text-muted-foreground">
              <span className="text-foreground font-semibold">Used AI.</span>{" "}
              {devlog.aiUsageDescription ?? "(no description)"}
            </div>
          ) : (
            <div className="text-muted-foreground">No AI was used for this devlog.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 text-xs text-muted-foreground grid grid-cols-2 gap-2">
          <div>
            <div className="uppercase tracking-wide">Hackatime project</div>
            <div className="text-foreground font-mono text-sm">
              {devlog.hackatimeProjectNameSnapshot || "—"}
            </div>
          </div>
          <div>
            <div className="uppercase tracking-wide">Hackatime logged</div>
            <div className="text-foreground font-semibold text-sm">{duration.label}</div>
          </div>
          <div>
            <div className="uppercase tracking-wide">Created</div>
            <div className="text-foreground text-sm">{formatDateTime(devlog.createdAt)}</div>
          </div>
          <div>
            <div className="uppercase tracking-wide">Updated</div>
            <div className="text-foreground text-sm">{formatDateTime(devlog.updatedAt)}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
