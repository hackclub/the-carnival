"use client";

import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import ShopItemSuggestionStatusBadge from "@/components/ShopItemSuggestionStatusBadge";
import ShopOrderStatusBadge from "@/components/ShopOrderStatusBadge";
import { R2ImageUpload } from "@/components/R2ImageUpload";
import {
  Badge,
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
import { SHOP_ORDER_MAX_QUANTITY, calculateShopOrderTotal } from "@/lib/shop-shared";

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
  quantity: number;
  unitTokenCost: number;
  tokenCost: number;
  fulfillmentLink: string | null;
  fulfilledAt: string | null;
  createdAt: string;
};

export type ShopItemSuggestionDTO = {
  id: string;
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
    suggestions: ShopItemSuggestionDTO[];
  };
}) {
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [showOrders, setShowOrders] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [orderNote, setOrderNote] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [showSuggest, setShowSuggest] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [suggestForm, setSuggestForm] = useState({
    name: "",
    description: "",
    imageUrl: "",
    referenceUrl: "",
    orderNoteRequired: false,
    approvedHoursNeeded: "0",
    tokenCost: "0",
  });

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
    setQuantity("1");
  }, []);

  const onOrder = useCallback(async (item: ShopItemDTO, note: string, rawQuantity: string) => {
    const cleanedNote = note.trim();
    const parsedQuantity = Number(rawQuantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > SHOP_ORDER_MAX_QUANTITY) {
      toast.error(`Quantity must be a whole number between 1 and ${SHOP_ORDER_MAX_QUANTITY}.`);
      return;
    }
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
        body: JSON.stringify({
          itemId: item.id,
          orderNote: cleanedNote || undefined,
          quantity: parsedQuantity,
        }),
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
      setQuantity("1");
      window.location.reload();
    } catch {
      toast.error("Failed to place order.", { id: toastId });
      setBusyItemId(null);
    }
  }, []);

  const onSuggest = useCallback(async () => {
    if (!suggestForm.name.trim()) {
      toast.error("Item name is required.");
      return;
    }
    setSuggestBusy(true);
    const toastId = toast.loading("Sending suggestion...");
    try {
      const res = await fetch("/api/shop/item-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: suggestForm.name,
          description: suggestForm.description,
          imageUrl: suggestForm.imageUrl || undefined,
          referenceUrl: suggestForm.referenceUrl || undefined,
          orderNoteRequired: suggestForm.orderNoteRequired,
          approvedHoursNeeded: suggestForm.approvedHoursNeeded,
          tokenCost: suggestForm.tokenCost,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Failed to suggest item.", {
          id: toastId,
        });
        setSuggestBusy(false);
        return;
      }
      toast.success("Suggestion sent.", { id: toastId });
      setShowSuggest(false);
      window.location.reload();
    } catch {
      toast.error("Failed to suggest item.", { id: toastId });
      setSuggestBusy(false);
    }
  }, [suggestForm]);

  const pendingCount = initial.orders.filter((o) => o.status === "pending").length;

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Your wallet</CardTitle>
            <CardDescription>
            Balance: <span className="text-foreground font-bold">{initial.balance}</span> tokens
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => setShowSuggest(true)}>
            Suggest item
          </Button>
          <Button variant="outline" onClick={() => setShowSuggestions(true)}>
            My suggestions{initial.suggestions.length ? ` (${initial.suggestions.length})` : ""}
          </Button>
          {canViewLedger ? (
            <Button variant="secondary" onClick={() => setShowLedger(true)}>
              View ledger
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setShowOrders(true)}>
            My orders{pendingCount ? ` (${pendingCount})` : ""}
          </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Shop items</CardTitle>
            <CardDescription>Order items with your tokens. Admins fulfill orders later.</CardDescription>
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
        </CardHeader>

        <CardContent>
        {items.length === 0 ? (
          <EmptyState title="No shop items yet" description="Suggest something you would like to see here." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
            {items.map((i) => (
              <Card key={i.id} variant="flat">
                <CardContent className="pt-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={i.imageUrl}
                  alt=""
                  className="h-44 w-full rounded-[var(--radius-xl)]  border-2 border-[var(--carnival-border)] bg-background object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="mt-4 flex flex-col gap-1">
                  <div className="text-foreground font-bold text-lg truncate">{i.name}</div>
                  {i.description ? (
                    <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{i.description}</div>
                  ) : null}
                  <div className="text-sm text-muted-foreground mt-1">
                    ~{i.approvedHoursNeeded} hours • Exact:{" "}
                    <span className="text-foreground font-semibold">{i.tokenCost}</span> tokens
                  </div>
                  {i.orderNoteRequired ? (
                    <div className="text-xs text-carnival-blue mt-1 font-medium">Requester note required</div>
                  ) : null}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <Badge variant="info">{i.tokenCost} tokens each</Badge>
                  <Button
                    variant="secondary"
                    loading={busyItemId === i.id}
                    loadingText="Ordering…"
                    onClick={() => openOrderModal(i.id)}
                  >
                    Order
                  </Button>
                </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </CardContent>
      </Card>

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
          <div className="flex flex-col gap-3">
            {initial.orders.map((o) => (
              <Card key={o.id} variant="flat">
                <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-foreground font-semibold truncate">{o.itemName}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(o.createdAt).toLocaleString()} • Qty {o.quantity} • {o.tokenCost} tokens
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
                  <ShopOrderStatusBadge status={o.status} />
                </div>
                </CardContent>
              </Card>
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
          <div className="flex flex-col gap-4">
            <div className="text-sm text-muted-foreground">
              Cost:{" "}
              <span className="text-foreground font-semibold">
                {selectedItem.tokenCost} tokens each
              </span>
            </div>
            <Input
              label="Quantity"
              type="number"
              min="1"
              max={SHOP_ORDER_MAX_QUANTITY}
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={busyItemId === selectedItem.id}
            />
            <div className="rounded-[var(--radius-xl)]  border-2 border-[var(--carnival-border)] bg-muted px-3 py-2 text-sm text-muted-foreground">
              Total:{" "}
              <span className="font-semibold text-foreground">
                {calculateShopOrderTotal(selectedItem.tokenCost, Number(quantity) || 1)} tokens
              </span>
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
                onClick={() => onOrder(selectedItem, orderNote, quantity)}
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

      <Modal
        open={showSuggest}
        onClose={() => setShowSuggest(false)}
        title="Suggest shop item"
        description="Suggest an item and the token price you think makes sense. Admins review before it appears in the shop."
        maxWidth="lg"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Item name"
            value={suggestForm.name}
            onChange={(e) => setSuggestForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Desk lamp"
            disabled={suggestBusy}
          />
          <Textarea
            label="Description"
            value={suggestForm.description}
            onChange={(e) => setSuggestForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            disabled={suggestBusy}
          />
          <R2ImageUpload
            label="Suggested image"
            value={suggestForm.imageUrl}
            onChange={(url) => setSuggestForm((f) => ({ ...f, imageUrl: url }))}
            kind="shop_item_image"
            disabled={suggestBusy}
            helperText="Optional, but it helps admins review the item faster."
          />
          <Input
            label="Reference URL"
            value={suggestForm.referenceUrl}
            onChange={(e) => setSuggestForm((f) => ({ ...f, referenceUrl: e.target.value }))}
            placeholder="https://..."
            disabled={suggestBusy}
          />
          <label className="flex items-start gap-3 rounded-[var(--radius-xl)]  border-2 border-[var(--carnival-border)] bg-muted px-4 py-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-carnival-blue"
              checked={suggestForm.orderNoteRequired}
              onChange={(e) =>
                setSuggestForm((f) => ({ ...f, orderNoteRequired: e.target.checked }))
              }
              disabled={suggestBusy}
            />
            <span className="text-sm">
              <span className="block font-medium text-foreground">Require requester note</span>
              <span className="block text-muted-foreground">Useful for items with size, color, or shipping choices.</span>
            </span>
          </label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Approved hours needed"
              value={suggestForm.approvedHoursNeeded}
              onChange={(e) =>
                setSuggestForm((f) => ({ ...f, approvedHoursNeeded: e.target.value }))
              }
              inputMode="numeric"
              disabled={suggestBusy}
            />
            <Input
              label="Token cost"
              value={suggestForm.tokenCost}
              onChange={(e) => setSuggestForm((f) => ({ ...f, tokenCost: e.target.value }))}
              inputMode="numeric"
              disabled={suggestBusy}
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setShowSuggest(false)} disabled={suggestBusy}>
              Cancel
            </Button>
            <Button variant="secondary" loading={suggestBusy} loadingText="Sending..." onClick={onSuggest}>
              Send suggestion
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showSuggestions}
        onClose={() => setShowSuggestions(false)}
        title="My suggestions"
        description="Admins review suggested items before they appear in the official shop."
        maxWidth="lg"
      >
        {initial.suggestions.length === 0 ? (
          <EmptyState title="No suggestions yet" description="Suggest an item you want to see in the shop." />
        ) : (
          <div className="flex flex-col gap-3">
            {initial.suggestions.map((s) => (
              <Card key={s.id} variant="flat">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate">{s.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleString()} • {s.tokenCost} tokens • ~
                        {s.approvedHoursNeeded} hours
                      </div>
                      {s.rejectionReason ? (
                        <div className="mt-2 text-sm text-muted-foreground">
                          Reason: {s.rejectionReason}
                        </div>
                      ) : null}
                    </div>
                    <ShopItemSuggestionStatusBadge status={s.status} />
                  </div>
                </CardContent>
              </Card>
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
                <div key={l.id} className="platform-nested-surface px-4 py-4">
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
