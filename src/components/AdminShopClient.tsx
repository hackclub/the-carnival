"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Button, Input } from "@/components/ui";

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
  status: "pending" | "fulfilled" | "cancelled";
  itemName: string;
  tokenCost: number;
  fulfillmentLink: string | null;
  createdAt: string;
  fulfilledAt: string | null;
};

type OrderFilterKey = "all" | "pending" | "fulfilled";

const ORDER_FILTERS: Array<{ label: string; value: OrderFilterKey }> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Fulfilled", value: "fulfilled" },
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
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    if (activeFilter === "all") return initial.orders;
    if (activeFilter === "pending") return initial.orders.filter((o) => o.status === "pending");
    return initial.orders.filter((o) => o.status === "fulfilled");
  }, [activeFilter, initial.orders]);

  const onFulfill = useCallback(async (orderId: string) => {
    const link = (fulfillmentLinks[orderId] ?? "").trim();
    if (!link) {
      toast.error("Enter a fulfillment proof link first.");
      return;
    }

    setBusyOrderId(orderId);
    const toastId = toast.loading("Fulfilling…");
    try {
      const res = await fetch(`/api/admin/shop/orders/${encodeURIComponent(orderId)}/fulfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fulfillmentLink: link }),
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
  }, [fulfillmentLinks]);

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
                {activeFilter === "all" ? "All orders" : activeFilter === "fulfilled" ? "Fulfilled orders" : "Pending orders"}
              </div>
              <div className="text-muted-foreground mt-1">
                {activeFilter === "fulfilled"
                  ? "Previously-fulfilled orders."
                  : "Enter fulfillment proof link (HCB card) and fulfill."}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">{filteredOrders.length} shown</div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-muted-foreground mt-4">
              {activeFilter === "fulfilled"
                ? "No fulfilled orders."
                : activeFilter === "pending"
                  ? "No pending orders."
                  : "No orders."}
            </div>
          ) : (
            <div className="space-y-3 mt-4">
              {filteredOrders.map((o) => (
                <div key={o.id} className="rounded-2xl border border-border bg-muted px-4 py-4">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-foreground font-semibold truncate">{o.itemName}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(o.createdAt).toLocaleString()} • {o.tokenCost} tokens • user {o.userId} •{" "}
                        <span className="font-semibold">{o.status}</span>
                        {o.status === "fulfilled" && o.fulfilledAt
                          ? ` • fulfilled ${new Date(o.fulfilledAt).toLocaleString()}`
                          : ""}
                      </div>
                    </div>
                    {o.status === "pending" ? (
                      <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                        <Input
                          placeholder="Fulfillment proof link (HCB card)…"
                          value={fulfillmentLinks[o.id] ?? ""}
                          onChange={(e) =>
                            setFulfillmentLinks((m) => ({ ...m, [o.id]: e.target.value }))
                          }
                          size="small"
                        />
                        <Button
                          variant="secondary"
                          loading={busyOrderId === o.id}
                          loadingText="Fulfilling…"
                          onClick={() => onFulfill(o.id)}
                        >
                          Fulfill
                        </Button>
                      </div>
                    ) : o.status === "fulfilled" ? (
                      <div className="flex-1 flex items-center justify-end">
                        {o.fulfillmentLink ? (
                          <a
                            href={o.fulfillmentLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-semibold text-carnival-blue hover:underline truncate"
                          >
                            View fulfillment proof
                          </a>
                        ) : (
                          <div className="text-sm text-muted-foreground">No proof link.</div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-end">
                        <div className="text-sm text-muted-foreground">Cancelled.</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

