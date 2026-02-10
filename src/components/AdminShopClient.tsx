"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Button, Input, Modal, Textarea } from "@/components/ui";

export type AdminShopItemDTO = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
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
  tokenCost: number;
  fulfillmentLink: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  fulfilledAt: string | null;
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
  initial: { items: AdminShopItemDTO[]; orders: AdminShopOrderDTO[] };
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
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
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

  const onFulfill = useCallback(async (orderId: string) => {
    const order = ordersById.get(orderId);
    if (!order) {
      toast.error("Order not found.");
      return;
    }
    const link = (fulfillmentLinks[orderId] ?? "").trim();
    const override = (deductOverrides[orderId] ?? "").trim();
    const overrideNote = (deductOverrideNotes[orderId] ?? "").trim();
    if (!link) {
      toast.error("Enter a fulfillment proof link first.");
      return;
    }
    if (override !== "" && !overrideNote) {
      toast.error("Add an override note when manually setting token deduction.");
      return;
    }
    if (override !== "" && !/^\d+$/.test(override)) {
      toast.error("Override token deduction must be a non-negative integer.");
      return;
    }
    if (override !== "" && Number(override) > order.requesterTokenBalance) {
      toast.error(`Cannot deduct more than ${order.requesterTokenBalance} available tokens.`);
      return;
    }
    const shouldContinue = window.confirm(`Fulfill order for ${order.requesterName}?`);
    if (!shouldContinue) return;

    setBusyOrderId(orderId);
    const toastId = toast.loading("Fulfilling…");
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
        const msg = typeof data?.error === "string" ? data.error : "Failed to fulfill order.";
        toast.error(msg, { id: toastId });
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
    const order = ordersById.get(orderId);
    if (!order) {
      toast.error("Order not found.");
      return;
    }
    const reason = (denyReasons[orderId] ?? "").trim();
    if (!reason) {
      toast.error("Add a reason before denying this order.");
      return;
    }

    setBusyOrderId(orderId);
    const toastId = toast.loading("Denying…");
    try {
      const res = await fetch(`/api/admin/shop/orders/${encodeURIComponent(orderId)}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : "Failed to deny order.";
        toast.error(msg, { id: toastId });
        setBusyOrderId(null);
        return;
      }
      toast.success("Order denied.", { id: toastId });
      window.location.reload();
    } catch {
      toast.error("Failed to deny order.", { id: toastId });
      setBusyOrderId(null);
    }
  }, [denyReasons, ordersById]);

  return (
    <div className="space-y-8">
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="text-foreground font-semibold text-lg">Items</div>
        {initial.items.length === 0 ? (
          <div className="text-muted-foreground mt-3">No items yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-4">
            {initial.items.map((i) => (
              <div key={i.id} className="rounded-2xl border border-border bg-muted p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={i.imageUrl}
                  alt=""
                  className="w-full h-40 object-cover rounded-xl border border-border bg-background"
                  referrerPolicy="no-referrer"
                />
                <div className="mt-3">
                  <div className="text-foreground font-bold truncate">{i.name}</div>
                  {i.description ? (
                    <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{i.description}</div>
                  ) : null}
                  <div className="text-sm text-muted-foreground mt-1">
                    ~{i.approvedHoursNeeded} hours • {i.tokenCost} tokens
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Link
                    href={`/admin/shop/items/${encodeURIComponent(i.id)}`}
                    className="text-sm font-semibold text-carnival-blue hover:underline"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canManageOrders ? (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            {ORDER_FILTERS.map((f) => {
              const isActive = f.value === activeFilter;
              return (
                <Link
                  key={f.value}
                  href={`/admin/shop?status=${f.value}`}
                  className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
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
              <div className="text-foreground font-semibold text-lg">
                {activeFilter === "all"
                  ? "All orders"
                  : activeFilter === "fulfilled"
                    ? "Fulfilled orders"
                    : activeFilter === "denied"
                      ? "Denied orders"
                      : "Pending orders"}
              </div>
              <div className="text-muted-foreground mt-1">
                {activeFilter === "fulfilled"
                  ? "Previously-fulfilled orders."
                  : activeFilter === "denied"
                    ? "Previously-denied orders and their reasons."
                    : "Fulfill pending orders or deny them with a reason."}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">{filteredOrders.length} shown</div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-muted-foreground mt-4">
              {activeFilter === "fulfilled"
                ? "No fulfilled orders."
                : activeFilter === "denied"
                  ? "No denied orders."
                  : activeFilter === "pending"
                  ? "No pending orders."
                  : "No orders."}
            </div>
          ) : (
            <div className="space-y-3 mt-4">
              {filteredOrders.map((o) => (
                <div key={o.id} className="rounded-2xl border border-border bg-muted px-4 py-4">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="min-w-0 flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={o.itemImageUrl}
                        alt={o.itemName}
                        className="w-16 h-16 object-cover rounded-lg border border-border bg-background shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <div className="text-foreground font-semibold truncate">Requested item: {o.itemName}</div>
                        {o.itemDescription ? (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.itemDescription}</div>
                        ) : null}
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(o.createdAt).toLocaleString()} • price {o.tokenCost} tokens • {o.requesterName}
                          {o.requesterEmail ? ` (${o.requesterEmail})` : ""} • available {o.requesterTokenBalance} tokens •{" "}
                          <span className="font-semibold">{o.status}</span>
                          {o.status === "fulfilled" && o.fulfilledAt
                            ? ` • fulfilled ${new Date(o.fulfilledAt).toLocaleString()}`
                            : ""}
                          {o.status === "cancelled" && o.cancelledAt
                            ? ` • denied ${new Date(o.cancelledAt).toLocaleString()}`
                            : ""}
                        </div>
                        {o.status === "cancelled" && o.cancellationReason ? (
                          <div className="text-xs text-carnival-red mt-1">Reason: {o.cancellationReason}</div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex-1 flex items-center justify-end">
                      <Button variant="outline" onClick={() => setSelectedOrderId(o.id)}>
                        View order
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <Modal
        open={!!selectedOrder}
        onClose={() => setSelectedOrderId(null)}
        title={selectedOrder ? selectedOrder.itemName : "Order details"}
        description={selectedOrder ? `${selectedOrder.requesterName}${selectedOrder.requesterEmail ? ` • ${selectedOrder.requesterEmail}` : ""}` : ""}
        maxWidth="2xl"
      >
        {selectedOrder ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-muted p-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedOrder.itemImageUrl}
                  alt={selectedOrder.itemName}
                  className="w-full md:w-48 h-48 object-cover rounded-xl border border-border bg-background shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <div className="text-foreground text-lg font-bold">{selectedOrder.itemName}</div>
                  {selectedOrder.itemDescription ? (
                    <div className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{selectedOrder.itemDescription}</div>
                  ) : (
                    <div className="text-sm text-muted-foreground mt-2">No item description provided.</div>
                  )}
                  <div className="text-sm text-muted-foreground mt-3">
                    Price: <span className="text-foreground font-semibold">{selectedOrder.tokenCost}</span> tokens
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Available tokens now:{" "}
                    <span className="text-foreground font-semibold">{selectedOrder.requesterTokenBalance}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Placed: {new Date(selectedOrder.createdAt).toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Status: <span className="font-semibold">{selectedOrder.status}</span>
                  </div>
                </div>
              </div>
            </div>

            {selectedOrder.status === "pending" ? (
              <div className="space-y-4">
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
                    loadingText="Fulfilling…"
                    onClick={() => onFulfill(selectedOrder.id)}
                  >
                    Fulfill order
                  </Button>
                  <Button
                    variant="outline"
                    loading={busyOrderId === selectedOrder.id}
                    loadingText="Denying…"
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

