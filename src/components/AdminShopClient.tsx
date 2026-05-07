"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import ShopItemSuggestionStatusBadge from "@/components/ShopItemSuggestionStatusBadge";
import ShopOrderStatusBadge from "@/components/ShopOrderStatusBadge";
import CopyableText from "@/components/CopyableText";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Modal,
  Textarea,
} from "@/components/ui";

export type AdminShopItemDTO = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  orderNoteRequired: boolean;
  approvedHoursNeeded: number;
  tokenCost: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminShopOrderDTO = {
  id: string;
  userId: string;
  requesterName: string;
  requesterEmail: string | null;
  requesterTokenBalance: number;
  status: "pending" | "fulfilled" | "cancelled";
  itemName: string;
  itemImageUrl: string;
  itemDescription: string | null;
  orderNote: string | null;
  quantity: number;
  unitTokenCost: number;
  tokenCost: number;
  fulfillmentLink: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  fulfilledAt: string | null;
};

export type AdminShopSuggestionDTO = {
  id: string;
  submittedByUserId: string;
  submitterName: string;
  submitterEmail: string | null;
  status: "pending" | "approved" | "rejected";
  name: string;
  description: string | null;
  imageUrl: string | null;
  referenceUrl: string | null;
  orderNoteRequired: boolean;
  approvedHoursNeeded: number;
  tokenCost: number;
  rejectionReason: string | null;
  approvedShopItemId: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

type OrderFilterKey = "all" | "pending" | "fulfilled" | "denied";

const ORDER_FILTERS: Array<{ label: string; value: OrderFilterKey }> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Fulfilled", value: "fulfilled" },
  { label: "Denied", value: "denied" },
];

export default function AdminShopClient({
  initial,
  canManageOrders = true,
}: {
  initial: {
    items: AdminShopItemDTO[];
    orders: AdminShopOrderDTO[];
    suggestions: AdminShopSuggestionDTO[];
  };
  canManageOrders?: boolean;
}) {
  const searchParams = useSearchParams();
  const rawStatus = searchParams.get("status");
  const allowed = useMemo(() => new Set(ORDER_FILTERS.map((f) => f.value)), []);
  const activeFilter: OrderFilterKey = allowed.has(rawStatus as OrderFilterKey)
    ? (rawStatus as OrderFilterKey)
    : "pending";

  const [fulfillmentLinks, setFulfillmentLinks] = useState<Record<string, string>>({});
  const [deductOverrides, setDeductOverrides] = useState<Record<string, string>>({});
  const [deductOverrideNotes, setDeductOverrideNotes] = useState<Record<string, string>>({});
  const [denyReasons, setDenyReasons] = useState<Record<string, string>>({});
  const [suggestionRejectReasons, setSuggestionRejectReasons] = useState<Record<string, string>>({});
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [busySuggestionId, setBusySuggestionId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const ordersById = useMemo(
    () => new Map(initial.orders.map((order) => [order.id, order])),
    [initial.orders],
  );
  const selectedOrder = selectedOrderId ? ordersById.get(selectedOrderId) ?? null : null;

  const filteredOrders = useMemo(() => {
    if (activeFilter === "all") return initial.orders;
    if (activeFilter === "pending") return initial.orders.filter((o) => o.status === "pending");
    if (activeFilter === "fulfilled") return initial.orders.filter((o) => o.status === "fulfilled");
    return initial.orders.filter((o) => o.status === "cancelled");
  }, [activeFilter, initial.orders]);

  const pendingSuggestions = useMemo(
    () => initial.suggestions.filter((suggestion) => suggestion.status === "pending"),
    [initial.suggestions],
  );

  const onFulfill = useCallback(async (orderId: string) => {
    const order = ordersById.get(orderId);
    if (!order) return toast.error("Order not found.");
    const link = (fulfillmentLinks[orderId] ?? "").trim();
    const override = (deductOverrides[orderId] ?? "").trim();
    const overrideNote = (deductOverrideNotes[orderId] ?? "").trim();
    if (!link) return toast.error("Enter a fulfillment proof link first.");
    if (override !== "" && !overrideNote) {
      return toast.error("Add an override note when manually setting token deduction.");
    }
    if (override !== "" && !/^\d+$/.test(override)) {
      return toast.error("Override token deduction must be a non-negative integer.");
    }
    if (override !== "" && Number(override) > order.requesterTokenBalance) {
      return toast.error(`Cannot deduct more than ${order.requesterTokenBalance} available tokens.`);
    }
    if (!window.confirm(`Fulfill order for ${order.requesterName}?`)) return;

    setBusyOrderId(orderId);
    const toastId = toast.loading("Fulfilling...");
    try {
      const res = await fetch(`/api/admin/shop/orders/${encodeURIComponent(orderId)}/fulfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillmentLink: link,
          deductTokensOverride: override === "" ? undefined : override,
          deductTokensOverrideNote: override === "" ? undefined : overrideNote,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Failed to fulfill order.", {
          id: toastId,
        });
        setBusyOrderId(null);
        return;
      }
      toast.success("Fulfilled.", { id: toastId });
      window.location.reload();
    } catch {
      toast.error("Failed to fulfill order.", { id: toastId });
      setBusyOrderId(null);
    }
  }, [deductOverrideNotes, deductOverrides, fulfillmentLinks, ordersById]);

  const onDeny = useCallback(async (orderId: string) => {
    const reason = (denyReasons[orderId] ?? "").trim();
    if (!reason) return toast.error("Add a reason before denying this order.");

    setBusyOrderId(orderId);
    const toastId = toast.loading("Denying...");
    try {
      const res = await fetch(`/api/admin/shop/orders/${encodeURIComponent(orderId)}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Failed to deny order.", {
          id: toastId,
        });
        setBusyOrderId(null);
        return;
      }
      toast.success("Order denied.", { id: toastId });
      window.location.reload();
    } catch {
      toast.error("Failed to deny order.", { id: toastId });
      setBusyOrderId(null);
    }
  }, [denyReasons]);

  const onApproveSuggestion = useCallback(async (suggestionId: string) => {
    setBusySuggestionId(suggestionId);
    const toastId = toast.loading("Approving suggestion...");
    try {
      const res = await fetch(
        `/api/admin/shop/item-suggestions/${encodeURIComponent(suggestionId)}/approve`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Failed to approve.", {
          id: toastId,
        });
        setBusySuggestionId(null);
        return;
      }
      toast.success("Suggestion approved.", { id: toastId });
      window.location.reload();
    } catch {
      toast.error("Failed to approve.", { id: toastId });
      setBusySuggestionId(null);
    }
  }, []);

  const onRejectSuggestion = useCallback(async (suggestionId: string) => {
    const reason = (suggestionRejectReasons[suggestionId] ?? "").trim();
    if (!reason) return toast.error("Add a rejection reason first.");
    setBusySuggestionId(suggestionId);
    const toastId = toast.loading("Rejecting suggestion...");
    try {
      const res = await fetch(
        `/api/admin/shop/item-suggestions/${encodeURIComponent(suggestionId)}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Failed to reject.", {
          id: toastId,
        });
        setBusySuggestionId(null);
        return;
      }
      toast.success("Suggestion rejected.", { id: toastId });
      window.location.reload();
    } catch {
      toast.error("Failed to reject.", { id: toastId });
      setBusySuggestionId(null);
    }
  }, [suggestionRejectReasons]);

  const onDeleteItem = useCallback(async (itemId: string) => {
    if (!window.confirm("Delete this shop item? This cannot be undone.")) return;
    setDeletingItemId(itemId);
    const toastId = toast.loading("Deleting item…");
    try {
      const res = await fetch(`/api/admin/shop/items/${encodeURIComponent(itemId)}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Failed to delete item.", { id: toastId });
        setDeletingItemId(null);
        return;
      }
      toast.success("Item deleted.", { id: toastId });
      window.location.reload();
    } catch {
      toast.error("Failed to delete item.", { id: toastId });
      setDeletingItemId(null);
    }
  }, []);

  return (
    <div className="flex flex-col gap-8">
      {canManageOrders ? (
        <Card>
          <CardHeader>
            <CardTitle>Suggested items</CardTitle>
            <CardDescription>Approve user suggestions into official shop items.</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingSuggestions.length === 0 ? (
              <EmptyState title="No pending suggestions" description="Suggested items will appear here." />
            ) : (
              <div className="flex flex-col gap-3">
                {pendingSuggestions.map((s) => (
                  <Card key={s.id} variant="flat">
                    <CardContent className="pt-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-semibold text-foreground">{s.name}</div>
                            <ShopItemSuggestionStatusBadge status={s.status} />
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Suggested by {s.submitterName}
                            {s.submitterEmail ? ` (${s.submitterEmail})` : ""} • {s.tokenCost} tokens • ~
                            {s.approvedHoursNeeded} hours
                          </div>
                          {s.description ? (
                            <div className="mt-2 text-sm text-muted-foreground line-clamp-2">{s.description}</div>
                          ) : null}
                          {s.referenceUrl ? (
                            <a
                              href={s.referenceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-block text-sm font-semibold text-carnival-blue hover:underline"
                            >
                              Reference
                            </a>
                          ) : null}
                        </div>
                        <div className="flex min-w-[260px] flex-col gap-2">
                          <Textarea
                            value={suggestionRejectReasons[s.id] ?? ""}
                            onChange={(e) =>
                              setSuggestionRejectReasons((prev) => ({ ...prev, [s.id]: e.target.value }))
                            }
                            rows={2}
                            placeholder="Reason if rejecting..."
                            disabled={busySuggestionId === s.id}
                          />
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              loading={busySuggestionId === s.id}
                              loadingText="Rejecting..."
                              onClick={() => onRejectSuggestion(s.id)}
                            >
                              Reject
                            </Button>
                            <Button
                              variant="secondary"
                              loading={busySuggestionId === s.id}
                              loadingText="Approving..."
                              onClick={() => onApproveSuggestion(s.id)}
                            >
                              Approve
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          {initial.items.length === 0 ? (
            <EmptyState title="No items yet" />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {initial.items.map((i) => (
                <Card key={i.id} variant="flat">
                  <CardContent className="pt-5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={i.imageUrl}
                      alt=""
                      className="h-40 w-full rounded-[var(--radius-xl)]  border border-border bg-background object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="mt-3">
                      <div className="font-bold text-foreground truncate">{i.name}</div>
                      {i.description ? (
                        <div className="mt-1 text-sm text-muted-foreground line-clamp-2">{i.description}</div>
                      ) : null}
                      <div className="mt-1 text-sm text-muted-foreground">
                        ~{i.approvedHoursNeeded} hours • {i.tokenCost} tokens
                      </div>
                      {i.orderNoteRequired ? (
                        <div className="mt-1 text-xs font-medium text-carnival-blue">Requester note required</div>
                      ) : null}
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <Link
                        href={`/admin/shop/items/${encodeURIComponent(i.id)}`}
                        className="text-sm font-semibold text-carnival-blue hover:underline"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => onDeleteItem(i.id)}
                        disabled={deletingItemId === i.id}
                        className="text-sm font-semibold text-rose-400 hover:text-rose-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingItemId === i.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canManageOrders ? (
        <Card>
          <CardContent className="pt-5">
            <div className="mb-4 flex flex-wrap gap-2">
              {ORDER_FILTERS.map((f) => {
                const isActive = f.value === activeFilter;
                return (
                  <Link
                    key={f.value}
                    href={`/admin/shop?status=${f.value}`}
                    className={`inline-flex items-center rounded-[var(--radius-xl)] border px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-carnival-red text-white border-carnival-red"
                        : "bg-card text-foreground border-border hover:bg-muted"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {f.label}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-end justify-between gap-4">
              <div>
                <CardTitle>
                  {activeFilter === "all"
                    ? "All orders"
                    : activeFilter === "fulfilled"
                      ? "Fulfilled orders"
                      : activeFilter === "denied"
                        ? "Denied orders"
                        : "Pending orders"}
                </CardTitle>
                <CardDescription>
                  {activeFilter === "fulfilled"
                    ? "Previously fulfilled orders."
                    : activeFilter === "denied"
                      ? "Previously denied orders and their reasons."
                      : "Fulfill pending orders or deny them with a reason."}
                </CardDescription>
              </div>
              <div className="text-sm text-muted-foreground">{filteredOrders.length} shown</div>
            </div>

            {filteredOrders.length === 0 ? (
              <EmptyState title="No orders" />
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {filteredOrders.map((o) => (
                  <Card key={o.id} variant="flat">
                    <CardContent className="pt-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={o.itemImageUrl}
                            alt={o.itemName}
                            className="h-16 w-16 shrink-0 rounded-lg  border border-border bg-background object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground truncate">Requested item: {o.itemName}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {new Date(o.createdAt).toLocaleString()} • qty {o.quantity} • {o.tokenCost} tokens •{" "}
                              {o.requesterName}
                              {o.requesterEmail ? <>{" ("}<CopyableText text={o.requesterEmail} className="inline text-xs" />{")"}</> : ""} • available{" "}
                              {o.requesterTokenBalance} tokens
                            </div>
                            <div className="mt-2">
                              <ShopOrderStatusBadge status={o.status} />
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" onClick={() => setSelectedOrderId(o.id)}>
                          View order
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Modal
        open={!!selectedOrder}
        onClose={() => setSelectedOrderId(null)}
        title={selectedOrder ? selectedOrder.itemName : "Order details"}
        description={
          selectedOrder
            ? `${selectedOrder.requesterName}${selectedOrder.requesterEmail ? ` • ${selectedOrder.requesterEmail}` : ""}`
            : ""
        }
        maxWidth="2xl"
      >
        {selectedOrder ? (
          <div className="flex flex-col gap-6">
            <Card variant="flat">
              <CardContent className="pt-5">
                <div className="flex flex-col gap-4 md:flex-row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedOrder.itemImageUrl}
                    alt={selectedOrder.itemName}
                    className="h-48 w-full shrink-0 rounded-[var(--radius-xl)]  border border-border bg-background object-cover md:w-48"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0">
                    <div className="text-lg font-bold text-foreground">{selectedOrder.itemName}</div>
                    {selectedOrder.itemDescription ? (
                      <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedOrder.itemDescription}
                      </div>
                    ) : null}
                    <div className="mt-3 text-sm text-muted-foreground">
                      Qty {selectedOrder.quantity} × {selectedOrder.unitTokenCost} tokens ={" "}
                      <span className="font-semibold text-foreground">{selectedOrder.tokenCost}</span> tokens
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Available tokens now:{" "}
                      <span className="font-semibold text-foreground">{selectedOrder.requesterTokenBalance}</span>
                    </div>
                    <div className="mt-2">
                      <ShopOrderStatusBadge status={selectedOrder.status} />
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">
                      Request note:
                      <div className="mt-1 text-foreground whitespace-pre-wrap">
                        {selectedOrder.orderNote ?? "No note provided."}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {selectedOrder.status === "pending" ? (
              <div className="flex flex-col gap-4">
                <Input
                  label="Fulfillment proof link"
                  placeholder="https://..."
                  value={fulfillmentLinks[selectedOrder.id] ?? ""}
                  onChange={(e) =>
                    setFulfillmentLinks((m) => ({ ...m, [selectedOrder.id]: e.target.value }))
                  }
                />
                <Input
                  label={`Override token deduction (max ${selectedOrder.requesterTokenBalance})`}
                  placeholder={`Default ${selectedOrder.tokenCost}`}
                  value={deductOverrides[selectedOrder.id] ?? ""}
                  onChange={(e) =>
                    setDeductOverrides((m) => ({ ...m, [selectedOrder.id]: e.target.value }))
                  }
                  inputMode="numeric"
                  min={0}
                  max={selectedOrder.requesterTokenBalance}
                />
                <Textarea
                  label="Override note (required when overriding)"
                  placeholder="Why you are overriding the token deduction..."
                  value={deductOverrideNotes[selectedOrder.id] ?? ""}
                  onChange={(e) =>
                    setDeductOverrideNotes((m) => ({ ...m, [selectedOrder.id]: e.target.value }))
                  }
                  rows={4}
                />
                <Textarea
                  label="Denial reason (required to deny)"
                  placeholder="Why this order request is being denied..."
                  value={denyReasons[selectedOrder.id] ?? ""}
                  onChange={(e) =>
                    setDenyReasons((m) => ({ ...m, [selectedOrder.id]: e.target.value }))
                  }
                  rows={4}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="secondary"
                    loading={busyOrderId === selectedOrder.id}
                    loadingText="Fulfilling..."
                    onClick={() => onFulfill(selectedOrder.id)}
                  >
                    Fulfill order
                  </Button>
                  <Button
                    variant="outline"
                    loading={busyOrderId === selectedOrder.id}
                    loadingText="Denying..."
                    onClick={() => onDeny(selectedOrder.id)}
                  >
                    Deny order
                  </Button>
                </div>
              </div>
            ) : selectedOrder.status === "fulfilled" ? (
              <div className="text-sm text-muted-foreground">
                {selectedOrder.fulfilledAt
                  ? `Fulfilled at ${new Date(selectedOrder.fulfilledAt).toLocaleString()}. `
                  : ""}
                {selectedOrder.fulfillmentLink ? (
                  <a
                    href={selectedOrder.fulfillmentLink}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-carnival-blue hover:underline"
                  >
                    View fulfillment proof
                  </a>
                ) : (
                  "No proof link."
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                {selectedOrder.cancelledAt
                  ? `Denied at ${new Date(selectedOrder.cancelledAt).toLocaleString()}. `
                  : ""}
                Reason: {selectedOrder.cancellationReason ?? "No reason provided."}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
