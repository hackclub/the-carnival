"use client";

import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button, Input, Modal, Textarea } from "@/components/ui";

export type ShopItemDTO = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  orderNoteRequired: boolean;
  approvedHoursNeeded: number;
  tokenCost: number;
};

export type ShopOrderDTO = {
  id: string;
  status: "pending" | "fulfilled" | "cancelled";
  shopItemId: string;
  itemName: string;
  itemImageUrl: string;
  orderNote: string | null;
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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [orderNote, setOrderNote] = useState("");

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initial.items;
    return initial.items.filter((i) => {
      if (i.name.toLowerCase().includes(q)) return true;
      const d = (i.description ?? "").toLowerCase();
      return d.includes(q);
    });
  }, [initial.items, search]);

  const itemsById = useMemo(() => new Map(initial.items.map((item) => [item.id, item])), [initial.items]);
  const selectedItem = selectedItemId ? itemsById.get(selectedItemId) ?? null : null;

  const openOrderModal = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
    setOrderNote("");
  }, []);

  const onOrder = useCallback(async (item: ShopItemDTO, note: string) => {
    const cleanedNote = note.trim();
    if (item.orderNoteRequired && !cleanedNote) {
      toast.error("A request note is required for this item.");
      return;
    }

    setBusyItemId(item.id);
    const toastId = toast.loading("Placing order…");
    try {
      const res = await fetch("/api/shop/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, orderNote: cleanedNote || undefined }),
      });
      const data = (await res.json().catch(() => null)) as { error?: unknown; id?: string } | null;
      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : "Failed to place order.";
        toast.error(msg, { id: toastId });
        setBusyItemId(null);
        return;
      }
      toast.success("Order placed.", { id: toastId });
      setSelectedItemId(null);
      setOrderNote("");
      window.location.reload();
    } catch {
      toast.error("Failed to place order.", { id: toastId });
      setBusyItemId(null);
    }
  }, []);

  const pendingCount = initial.orders.filter((o) => o.status === "pending").length;

  return (
    <div className="space-y-8">
      <div className="carnival-card carnival-card-soft flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between sm:p-7">
        <div>
          <div className="text-foreground font-black uppercase tracking-[0.08em] text-lg">Your wallet</div>
          <div className="text-muted-foreground mt-1">
            Balance: <span className="text-foreground font-bold tabular-nums">{initial.balance}</span> tokens
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

      <div className="carnival-card p-6 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-foreground font-black uppercase tracking-[0.08em] text-lg">Shop items</div>
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
              <div
                key={i.id}
                className="carnival-card carnival-card-soft p-4 transition-transform duration-200 hover:-translate-y-1"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={i.imageUrl}
                  alt=""
                  className="h-44 w-full rounded-xl border border-[#74210a]/25 bg-background object-cover shadow-[0_6px_16px_rgba(120,53,15,0.12)]"
                  referrerPolicy="no-referrer"
                />
                <div className="mt-4">
                  <div className="text-foreground font-bold text-lg truncate">{i.name}</div>
                  {i.description ? (
                    <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{i.description}</div>
                  ) : null}
                  <div className="text-sm text-muted-foreground mt-1">
                    ~{i.approvedHoursNeeded} hours • Exact:{" "}
                    <span className="text-foreground font-semibold tabular-nums">{i.tokenCost}</span> tokens
                  </div>
                  {i.orderNoteRequired ? (
                    <div className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#8f4a18]">
                      Requester note required
                    </div>
                  ) : null}
                </div>
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    loading={busyItemId === i.id}
                    loadingText="Ordering…"
                    onClick={() => openOrderModal(i.id)}
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
              <div key={o.id} className="carnival-card carnival-card-soft px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-foreground font-semibold truncate">{o.itemName}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(o.createdAt).toLocaleString()} • {o.tokenCost} tokens
                    </div>
                    {o.orderNote ? (
                      <div className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                        Request note: {o.orderNote}
                      </div>
                    ) : null}
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

      <Modal
        open={!!selectedItem}
        onClose={() => {
          setSelectedItemId(null);
          setOrderNote("");
        }}
        title={selectedItem ? `Order ${selectedItem.name}` : "Place order"}
        description={
          selectedItem?.orderNoteRequired
            ? "This item requires a request note."
            : "Add an optional request note for admins."
        }
        maxWidth="lg"
      >
        {selectedItem ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Cost: <span className="text-foreground font-semibold tabular-nums">{selectedItem.tokenCost}</span> tokens
            </div>
            <Textarea
              label={selectedItem.orderNoteRequired ? "Request note (required)" : "Request note (optional)"}
              placeholder="Add any details admins should know before fulfilling this request..."
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              rows={4}
              disabled={busyItemId === selectedItem.id}
            />
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                loading={busyItemId === selectedItem.id}
                loadingText="Ordering…"
                onClick={() => onOrder(selectedItem, orderNote)}
              >
                Place order
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedItemId(null);
                  setOrderNote("");
                }}
                disabled={busyItemId === selectedItem.id}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
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
                <div key={l.id} className="carnival-card carnival-card-soft px-4 py-4">
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
