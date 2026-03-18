"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button, Input, Textarea } from "@/components/ui";
import { R2ImageUpload } from "@/components/R2ImageUpload";

type ItemForm = {
  id?: string;
  name: string;
  description: string;
  imageUrl: string;
  orderNoteRequired: boolean;
  approvedHoursNeeded: string;
  tokenCost: string;
};

export default function AdminShopItemFormClient({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string;
    orderNoteRequired: boolean;
    approvedHoursNeeded: number;
    tokenCost: number;
  };
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<ItemForm>(() => ({
    id: initial?.id,
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    imageUrl: initial?.imageUrl ?? "",
    orderNoteRequired: initial?.orderNoteRequired ?? false,
    approvedHoursNeeded: String(initial?.approvedHoursNeeded ?? 0),
    tokenCost: String(initial?.tokenCost ?? 0),
  }));

  const canSubmit = useMemo(() => {
    return !!form.name.trim() && !!form.imageUrl.trim();
  }, [form.imageUrl, form.name]);

  const onSubmit = useCallback(async () => {
    if (!canSubmit) {
      toast.error("Please fill in name and image URL.");
      return;
    }
    setBusy(true);
    const toastId = toast.loading(mode === "create" ? "Creating…" : "Saving…");
    try {
      const payload = {
        name: form.name,
        description: form.description.trim() || null,
        imageUrl: form.imageUrl,
        orderNoteRequired: form.orderNoteRequired,
        approvedHoursNeeded: Number(form.approvedHoursNeeded),
        tokenCost: Number(form.tokenCost),
      };
      const res =
        mode === "create"
          ? await fetch("/api/admin/shop/items", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/admin/shop/items/${encodeURIComponent(form.id ?? "")}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

      const data = (await res.json().catch(() => null)) as { error?: unknown; item?: { id?: string } } | null;
      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : "Failed.";
        toast.error(msg, { id: toastId });
        setBusy(false);
        return;
      }
      toast.success(mode === "create" ? "Created." : "Saved.", { id: toastId });
      window.location.href = "/admin/shop";
    } catch {
      toast.error(mode === "create" ? "Failed to create." : "Failed to save.", { id: toastId });
      setBusy(false);
    }
  }, [canSubmit, form, mode]);

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-muted-foreground">
          {mode === "create" ? "Create a new shop item." : "Edit this shop item."}
        </div>
        <Link href="/admin/shop" className="text-sm font-semibold text-carnival-blue hover:underline">
          ← Back
        </Link>
      </div>

      <Input
        label="Item name"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        placeholder="e.g. Mechanical keyboard"
      />
      <Textarea
        label="Short description (optional)"
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        placeholder="A short blurb shown in the shop…"
        rows={3}
        disabled={busy}
      />
      <R2ImageUpload
        label="Item image"
        value={form.imageUrl}
        onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
        kind="shop_item_image"
        disabled={busy}
        helperText="This image is required and will be shown in the shop."
      />
      <label className="flex items-start gap-3 rounded-2xl border border-border bg-muted px-4 py-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-carnival-blue"
          checked={form.orderNoteRequired}
          onChange={(e) => setForm((f) => ({ ...f, orderNoteRequired: e.target.checked }))}
          disabled={busy}
        />
        <span className="text-sm">
          <span className="block text-foreground font-medium">Require requester note</span>
          <span className="block text-muted-foreground mt-1">
            Shoppers must include a note before ordering this item.
          </span>
        </span>
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Approved hours needed (shown as ~x hours)"
          value={form.approvedHoursNeeded}
          onChange={(e) => setForm((f) => ({ ...f, approvedHoursNeeded: e.target.value }))}
          inputMode="numeric"
        />
        <Input
          label="Token cost (exact)"
          value={form.tokenCost}
          onChange={(e) => setForm((f) => ({ ...f, tokenCost: e.target.value }))}
          inputMode="numeric"
        />
      </div>

      <div className="pt-2">
        <Button variant="secondary" loading={busy} loadingText={mode === "create" ? "Creating…" : "Saving…"} onClick={onSubmit}>
          {mode === "create" ? "Create item" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
