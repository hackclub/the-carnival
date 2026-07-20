"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ANNOUNCEMENT_VARIANT_LABELS,
  ANNOUNCEMENT_VARIANTS,
  isAnnouncementVisible,
  type AnnouncementDto,
  type AnnouncementVariantKey,
} from "@/lib/announcements-shared";

type FormState = {
  message: string;
  href: string;
  linkLabel: string;
  variant: AnnouncementVariantKey;
  isActive: boolean;
  startsAt: string; // datetime-local, treated as UTC
  endsAt: string;
};

const EMPTY_FORM: FormState = {
  message: "",
  href: "",
  linkLabel: "",
  variant: "carnival",
  isActive: true,
  startsAt: "",
  endsAt: "",
};

const PREVIEW_CLASSES: Record<AnnouncementVariantKey, string> = {
  carnival: "bg-[#b91c1c] text-white",
  info: "bg-[#1d4ed8] text-white",
  success: "bg-[#047857] text-white",
  warning: "bg-[#f59e0b] text-[#451a03]",
};

function isoToInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.replace(/:\d{2}(\.\d{1,3})?Z$/, "");
}

function inputValueToIso(value: string): string | null {
  if (!value.trim()) return null;
  const iso = `${value.trim()}:00.000Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function formatWindow(a: AnnouncementDto): string {
  const fmt = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "UTC",
        }).format(new Date(iso))
      : null;
  const start = fmt(a.startsAtIso);
  const end = fmt(a.endsAtIso);
  if (!start && !end) return "always";
  if (start && end) return `${start} → ${end} UTC`;
  if (start) return `from ${start} UTC`;
  return `until ${end} UTC`;
}

function toFormState(a: AnnouncementDto): FormState {
  return {
    message: a.message,
    href: a.href ?? "",
    linkLabel: a.linkLabel ?? "",
    variant: a.variant,
    isActive: a.isActive,
    startsAt: isoToInputValue(a.startsAtIso),
    endsAt: isoToInputValue(a.endsAtIso),
  };
}

export default function AdminAnnouncementsClient({ initial }: { initial: AnnouncementDto[] }) {
  const [announcements, setAnnouncements] = useState<AnnouncementDto[]>(initial);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }, []);

  const submit = useCallback(async () => {
    if (!form.message.trim()) {
      toast.error("Message is required.");
      return;
    }
    const payload = {
      message: form.message.trim(),
      href: form.href.trim() || null,
      linkLabel: form.linkLabel.trim() || null,
      variant: form.variant,
      isActive: form.isActive,
      startsAt: inputValueToIso(form.startsAt),
      endsAt: inputValueToIso(form.endsAt),
    };

    setBusy(true);
    const toastId = toast.loading(editingId ? "Updating…" : "Publishing…");
    try {
      const res = await fetch(
        editingId
          ? `/api/admin/announcements/${encodeURIComponent(editingId)}`
          : "/api/admin/announcements",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await res.json().catch(() => null)) as
        | { announcements?: AnnouncementDto[]; error?: string }
        | null;
      if (!res.ok || !data?.announcements) {
        toast.error(data?.error || "Failed to save announcement.", { id: toastId });
        return;
      }
      setAnnouncements(data.announcements);
      resetForm();
      toast.success(editingId ? "Announcement updated." : "Announcement published.", {
        id: toastId,
      });
    } catch {
      toast.error("Failed to save announcement.", { id: toastId });
    } finally {
      setBusy(false);
    }
  }, [form, editingId, resetForm]);

  const toggleActive = useCallback(async (a: AnnouncementDto) => {
    setBusy(true);
    const toastId = toast.loading(a.isActive ? "Deactivating…" : "Activating…");
    try {
      const res = await fetch(`/api/admin/announcements/${encodeURIComponent(a.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: a.message,
          href: a.href,
          linkLabel: a.linkLabel,
          variant: a.variant,
          isActive: !a.isActive,
          startsAt: a.startsAtIso,
          endsAt: a.endsAtIso,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { announcements?: AnnouncementDto[]; error?: string }
        | null;
      if (!res.ok || !data?.announcements) {
        toast.error(data?.error || "Failed to update.", { id: toastId });
        return;
      }
      setAnnouncements(data.announcements);
      toast.success(a.isActive ? "Deactivated." : "Activated.", { id: toastId });
    } catch {
      toast.error("Failed to update.", { id: toastId });
    } finally {
      setBusy(false);
    }
  }, []);

  const remove = useCallback(async (a: AnnouncementDto) => {
    setBusy(true);
    const toastId = toast.loading("Deleting…");
    try {
      const res = await fetch(`/api/admin/announcements/${encodeURIComponent(a.id)}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as
        | { announcements?: AnnouncementDto[]; error?: string }
        | null;
      if (!res.ok || !data?.announcements) {
        toast.error(data?.error || "Failed to delete.", { id: toastId });
        return;
      }
      setAnnouncements(data.announcements);
      if (editingId === a.id) resetForm();
      toast.success("Deleted.", { id: toastId });
    } catch {
      toast.error("Failed to delete.", { id: toastId });
    } finally {
      setBusy(false);
    }
  }, [editingId, resetForm]);

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="platform-surface-card p-5">
        <h2 className="text-lg font-bold text-foreground">
          {editingId ? "Edit announcement" : "New announcement"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Shows as a banner at the top of every page. Leave the window empty to show it
          immediately and indefinitely. Times are UTC.
        </p>

        <div className="mt-4 space-y-3">
          <div
            className={`flex items-center justify-center rounded-[var(--radius-xl)] px-10 py-2.5 text-center text-sm font-semibold ${PREVIEW_CLASSES[form.variant]}`}
          >
            <p>
              {form.message.trim() || "Your announcement text…"}
              {form.href.trim() ? (
                <>
                  {" "}
                  <span className="underline underline-offset-2">
                    {form.linkLabel.trim() || "Learn more"}
                  </span>
                </>
              ) : null}
            </p>
          </div>

          <textarea
            value={form.message}
            onChange={(e) => setField("message", e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="🍿 Snacks is back! Ship a new extension before July 31 and earn $1.50/hr in snacks on top of your grant."
            className="w-full bg-background border border-border rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={form.href}
              onChange={(e) => setField("href", e.target.value)}
              placeholder="Link (optional) — /snacks or https://…"
              className="w-full bg-background border border-border rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
            />
            <input
              type="text"
              value={form.linkLabel}
              onChange={(e) => setField("linkLabel", e.target.value)}
              maxLength={60}
              placeholder="Link label (optional) — defaults to “Learn more”"
              className="w-full bg-background border border-border rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-carnival-blue/40"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:w-52">
              <Select
                value={form.variant}
                onValueChange={(value) => setField("variant", value as AnnouncementVariantKey)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Variant" />
                </SelectTrigger>
                <SelectContent>
                  {ANNOUNCEMENT_VARIANTS.map((variant) => (
                    <SelectItem key={variant} value={variant}>
                      {ANNOUNCEMENT_VARIANT_LABELS[variant]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Show from</span>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setField("startsAt", e.target.value)}
                className="bg-background border border-border rounded-[var(--radius-xl)] px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>until</span>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setField("endsAt", e.target.value)}
                className="bg-background border border-border rounded-[var(--radius-xl)] px-2 py-1.5 text-sm text-foreground"
              />
              <span className="text-xs font-semibold">UTC</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setField("isActive", e.target.checked)}
                className="h-4 w-4"
              />
              Active
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="rounded-[var(--radius-xl)] bg-carnival-red px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-carnival-red/80 disabled:cursor-not-allowed disabled:bg-carnival-red/40"
            >
              {editingId ? "Save changes" : "Publish announcement"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-[var(--radius-xl)] border border-border bg-background/60 px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-background"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="platform-surface-card p-5">
        <h2 className="text-lg font-bold text-foreground">All announcements</h2>
        <div className="mt-3 space-y-3">
          {announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            announcements.map((a) => {
              const live = isAnnouncementVisible(a, now);
              return (
                <div
                  key={a.id}
                  className="rounded-[var(--radius-xl)] border border-border bg-background/60 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{a.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ANNOUNCEMENT_VARIANT_LABELS[a.variant]} · {formatWindow(a)}
                        {a.href ? ` · links to ${a.href}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          live
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-foreground/10 text-muted-foreground"
                        }`}
                      >
                        {live ? "live now" : a.isActive ? "scheduled/expired" : "inactive"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(a.id);
                          setForm(toFormState(a));
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="rounded-[var(--radius-xl)] border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-background"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(a)}
                        disabled={busy}
                        className="rounded-[var(--radius-xl)] border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-background disabled:opacity-50"
                      >
                        {a.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(a)}
                        disabled={busy}
                        className="rounded-[var(--radius-xl)] border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
