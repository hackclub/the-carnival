"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Card, CardContent } from "@/components/ui";

export type ReviewDevlog = {
  id: string;
  title: string;
  content: string;
  createdAt: string; // ISO
  authorName: string;
};

type Props = {
  projectId: string;
  devlogs: ReviewDevlog[];
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DevlogItem({ devlog, projectId }: { devlog: ReviewDevlog; projectId: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = devlog.content.length > 500;
  const preview =
    expanded || !isLong ? devlog.content : `${devlog.content.slice(0, 500).trimEnd()}…`;

  return (
    <li className="rounded-xl border border-border bg-background/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{devlog.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {devlog.authorName} · {formatDateTime(devlog.createdAt)}
          </div>
        </div>
        <Link
          href={`/projects/${projectId}/devlogs/${devlog.id}`}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
        >
          Open ↗
        </Link>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {preview}
      </p>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs text-muted-foreground hover:text-foreground"
        >
          {expanded ? "Show less" : "Show full devlog"}
        </button>
      ) : null}
    </li>
  );
}

export default function ReviewDevlogsPanel({ projectId, devlogs }: Props) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">Creator devlogs</h3>
          <Badge>{devlogs.length}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          The creator&apos;s written justification for hours spent. Use these to
          verify time claims against Hackatime data.
        </p>

        {devlogs.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
            The creator has not posted any devlogs for this project.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {devlogs.map((d) => (
              <DevlogItem key={d.id} devlog={d} projectId={projectId} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
