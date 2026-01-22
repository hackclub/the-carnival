"use client";

import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button, Input, Modal } from "@/components/ui";

export type ShopItemDTO = {
  id: string;
  name: string;
  imageUrl: string;
  approvedHoursNeeded: number;
  tokenCost: number;
};

export type ShopOrderDTO = {
  id: string;
  status: "pending" | "fulfilled" | "cancelled";
  shopItemId: string;
  itemName: string;
  itemImageUrl: string;
  tokenCost: number;
  fulfillmentLink: string | null;
  fulfilledAt: string | null;
  createdAt: string;
};

export type ShopLedgerDTO = {
  id: string;
  kind: "issue" | "deduct";
  tokens: number;
  reason: string;
  createdAt: string;
};

export default function ShopClient({
  initial,
  canViewLedger,
}: {
  canViewLedger: boolean;
  initial: {
    balance: number;
    items: ShopItemDTO[];
    orders: ShopOrderDTO[];
    ledger: ShopLedgerDTO[];
  };
}) {
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [showOrders, setShowOrders] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [search, setSearch] = useState("");

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initial.items;
    return initial.items.filter((i) => i.name.toLowerCase().includes(q));
  }, [initial.items, search]);

  const onOrder = useCallback(async (itemId: string) => {
    setBusyItemId(itemId);
    const toastId = toast.loading("Placing order…");
    try {
      const res = await fetch("/api/shop/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const data = (await res.json().catch(() => null)) as { error?: unknown; id?: string } | null;
      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : "Failed to place order.";
        toast.error(msg, { id: toastId });
        setBusyItemId(null);
        return;
      }
      toast.success("Order placed.", { id: toastId });
      window.location.reload();
    } catch {
      toast.error("Failed to place order.", { id: toastId });
      setBusyItemId(null);
    }
  }, []);

  const pendingCount = initial.orders.filter((o) => o.status === "pending").length;

  return (
    <div className="space-y-8">
      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-foreground font-semibold text-lg">Your wallet</div>
          <div className="text-muted-foreground mt-1">
            Balance: <span className="text-foreground font-bold">{initial.balance}</span> tokens
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canViewLedger ? (
            <Button variant="secondary" onClick={() => setShowLedger(true)}>
              View ledger
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setShowOrders(true)}>
            My orders{pendingCount ? ` (${pendingCount})` : ""}
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-foreground font-semibold text-lg">Shop items</div>
            <div className="text-muted-foreground mt-1">Order items with your tokens. Admins fulfill orders later.</div>
          </div>
          <div className="w-full md:w-80">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items…"
              aria-label="Search shop items"
              size="small"
            />
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-muted-foreground mt-6">No shop items yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
            {items.map((i) => (
              <div key={i.id} className="rounded-2xl border border-border bg-muted p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={i.imageUrl}
                  alt=""
                  className="w-full h-44 object-cover rounded-xl border border-border bg-background"
                  referrerPolicy="no-referrer"
                />
                <div className="mt-4">
                  <div className="text-foreground font-bold text-lg truncate">{i.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    ~{i.approvedHoursNeeded} hours • Exact:{" "}
                    <span className="text-foreground font-semibold">{i.tokenCost}</span> tokens
                  </div>
                </div>
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    loading={busyItemId === i.id}
                    loadingText="Ordering…"
                    onClick={() => onOrder(i.id)}
                  >
                    Order
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={showOrders}
        onClose={() => setShowOrders(false)}
        title="My orders"
        description="Pending orders are fulfilled by an admin; tokens are deducted on fulfillment."
        maxWidth="lg"
      >
        {initial.orders.length === 0 ? (
          <div className="text-muted-foreground">No orders yet.</div>
        ) : (
          <div className="space-y-3">
            {initial.orders.map((o) => (
              <div key={o.id} className="rounded-2xl border border-border bg-muted px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-foreground font-semibold truncate">{o.itemName}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(o.createdAt).toLocaleString()} • {o.tokenCost} tokens
                    </div>
                    {o.fulfillmentLink ? (
                      <a
                        href={o.fulfillmentLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-carnival-blue hover:underline mt-2 inline-block"
                      >
                        Fulfillment proof
                      </a>
                    ) : null}
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {o.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {canViewLedger ? (
        <Modal
          open={showLedger}
          onClose={() => setShowLedger(false)}
          title="Token ledger"
          description={`Balance: ${initial.balance} tokens`}
          maxWidth="lg"
        >
          {initial.ledger.length === 0 ? (
            <div className="text-muted-foreground">No ledger entries yet.</div>
          ) : (
            <div className="space-y-3">
              {initial.ledger.map((l) => (
                <div key={l.id} className="rounded-2xl border border-border bg-muted px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-foreground font-semibold truncate">{l.reason}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(l.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-bold">
                      <span className={l.kind === "issue" ? "text-carnival-blue" : "text-carnival-red"}>
                        {l.kind === "issue" ? "+" : "-"}
                        {l.tokens}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
}

