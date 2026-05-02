"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, CardContent, FormLabel, Input, Textarea } from "@/components/ui";

export type DevlogFormInitial = {
  title: string;
  content: string;
};

type Props = {
  projectId: string;
  devlogId?: string;
  initial?: DevlogFormInitial;
  onCancelHref: string;
  onSavedHref: (devlogId: string) => string;
  submitLabel?: string;
};

const MAX_TITLE = 200;
const MAX_CONTENT = 20_000;

export default function DevlogForm({
  projectId,
  devlogId,
  initial,
  onCancelHref,
  onSavedHref,
  submitLabel = "Publish devlog",
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = typeof devlogId === "string" && devlogId.length > 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle) {
      setError("Title is required");
      return;
    }
    if (trimmedTitle.length > MAX_TITLE) {
      setError(`Title must be ${MAX_TITLE} characters or less`);
      return;
    }
    if (!trimmedContent) {
      setError("Content is required");
      return;
    }
    if (trimmedContent.length > MAX_CONTENT) {
      setError(`Content must be ${MAX_CONTENT} characters or less`);
      return;
    }

    setSubmitting(true);
    try {
      const url = isEdit
        ? `/api/projects/${projectId}/devlogs/${devlogId}`
        : `/api/projects/${projectId}/devlogs`;
      const response = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmedTitle, content: trimmedContent }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Request failed (${response.status})`);
        setSubmitting(false);
        return;
      }

      const data = (await response.json()) as { devlog: { id: string } };
      const savedId = data.devlog?.id ?? devlogId ?? "";
      router.push(onSavedHref(savedId));
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <FormLabel>Title</FormLabel>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_TITLE}
              placeholder="What did you work on today?"
              disabled={submitting}
              required
            />
            <div className="text-xs text-muted-foreground mt-1">
              {title.length} / {MAX_TITLE}
            </div>
          </div>

          <div>
            <FormLabel>
              Devlog entry
              <span className="text-muted-foreground font-normal">
                {" "}
                — describe what you built, decisions you made, and how long it
                took.
              </span>
            </FormLabel>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={MAX_CONTENT}
              rows={14}
              placeholder="Describe your progress here. Reviewers can read your devlogs as justification for the hours you spent on this project."
              disabled={submitting}
              required
            />
            <div className="text-xs text-muted-foreground mt-1">
              {content.length} / {MAX_CONTENT}
            </div>
          </div>

          {error ? (
            <div className="rounded-[var(--radius-xl)] border border-carnival-red/40 bg-carnival-red/10 text-carnival-red px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <Button type="submit" loading={submitting} loadingText="Saving…">
              {submitLabel}
            </Button>
            <a href={onCancelHref} className="text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </a>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
