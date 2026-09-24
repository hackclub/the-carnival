"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { Input, FormLabel } from "@/components/ui/form";
import { DatePicker } from "@/components/ui/date-picker";
import {
  deriveHackatimeConnectionStatus,
  hackatimeConnectUrl,
} from "@/lib/hackatime-connection";

export type AccountProfileInitial = {
  birthday: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  country: string | null;
  zipPostalCode: string | null;
  hackatimeUserId: string | null;
  hackatimeConnectedAt: string | null;
  // A working token is stored. False with a connectedAt timestamp means the
  // token was revoked on Hackatime's side and the user needs to reconnect.
  hackatimeConnected: boolean;
};

const HACKATIME_CONNECT_URL = hackatimeConnectUrl("/account");

function toClean(v: string) {
  const s = v.trim();
  return s ? s : "";
}

export default function AccountProfileClient({ initial }: { initial: AccountProfileInitial }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const hackatimeStatus = deriveHackatimeConnectionStatus({
    hasToken: initial.hackatimeConnected,
    connectedAt: initial.hackatimeConnectedAt,
  });

  const startHackatimeOAuth = useCallback(() => {
    window.location.href = HACKATIME_CONNECT_URL;
  }, []);

  const onDisconnectHackatime = useCallback(async () => {
    const confirmed = window.confirm(
      "Disconnect Hackatime from Carnival? You'll need to reconnect before Carnival can list your Hackatime projects or refresh project hours.",
    );
    if (!confirmed) return;
    setDisconnecting(true);
    const toastId = toast.loading("Disconnecting Hackatime…");
    try {
      const res = await fetch("/api/hackatime/disconnect", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (!res.ok) {
        const message =
          typeof data?.error === "string" ? data.error : "Failed to disconnect Hackatime.";
        toast.error(message, { id: toastId });
        return;
      }
      toast.success("Hackatime disconnected.", { id: toastId });
      router.refresh();
    } catch {
      toast.error("Failed to disconnect Hackatime.", { id: toastId });
    } finally {
      setDisconnecting(false);
    }
  }, [router]);

  const [birthday, setBirthday] = useState(initial.birthday ?? "");
  const [addressLine1, setAddressLine1] = useState(initial.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(initial.addressLine2 ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [stateProvince, setStateProvince] = useState(initial.stateProvince ?? "");
  const [country, setCountry] = useState(initial.country ?? "");
  const [zipPostalCode, setZipPostalCode] = useState(initial.zipPostalCode ?? "");

  const requiredMissing = useMemo(() => {
    const missing: string[] = [];
    if (!toClean(addressLine1)) missing.push("Address (Line 1)");
    if (!toClean(city)) missing.push("City");
    if (!toClean(stateProvince)) missing.push("State / Province");
    if (!toClean(country)) missing.push("Country");
    if (!toClean(zipPostalCode)) missing.push("ZIP / Postal Code");
    return missing;
  }, [addressLine1, city, country, stateProvince, zipPostalCode]);

  const onSave = useCallback(async () => {
    setSaving(true);
    const toastId = toast.loading("Saving profile…");
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birthday,
          addressLine1,
          addressLine2,
          city,
          stateProvince,
          country,
          zipPostalCode,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (!res.ok) {
        const message = typeof data?.error === "string" ? data.error : "Failed to save profile.";
        toast.error(message, { id: toastId });
        setSaving(false);
        return;
      }
      toast.success("Profile saved.", { id: toastId });
      setSaving(false);
    } catch {
      toast.error("Failed to save profile.", { id: toastId });
      setSaving(false);
    }
  }, [addressLine1, addressLine2, birthday, city, country, stateProvince, zipPostalCode]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Hackatime</CardTitle>
              <CardDescription>Connection status for project time tracking.</CardDescription>
            </div>
            <Badge
              variant={
                hackatimeStatus === "connected"
                  ? "success"
                  : hackatimeStatus === "needs_reconnect"
                    ? "error"
                    : "warning"
              }
            >
              {hackatimeStatus === "connected"
                ? "Connected"
                : hackatimeStatus === "needs_reconnect"
                  ? "Needs reconnect"
                  : "Not connected"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {hackatimeStatus === "connected" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Connected
                {initial.hackatimeConnectedAt
                  ? ` ${new Date(initial.hackatimeConnectedAt).toLocaleString()}`
                  : ""}
                {initial.hackatimeUserId ? (
                  <>
                    {" "}
                    as <span className="font-mono text-foreground">{initial.hackatimeUserId}</span>
                  </>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={startHackatimeOAuth}>
                  Reconnect
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onDisconnectHackatime}
                  disabled={disconnecting}
                >
                  {disconnecting ? "Disconnecting…" : "Disconnect"}
                </Button>
              </div>
            </div>
          ) : hackatimeStatus === "needs_reconnect" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Carnival&apos;s access to your Hackatime account is no longer valid. This usually
                happens when Carnival is removed from Hackatime&apos;s Authorized Applications.
                Reconnect to load your projects and refresh hours again.
              </div>
              <Button type="button" variant="primary" onClick={startHackatimeOAuth}>
                Reconnect Hackatime
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Connect Hackatime so Carnival can read your coding time.
              </div>
              <Button type="button" variant="secondary" onClick={startHackatimeOAuth}>
                Connect Hackatime
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shipping address</CardTitle>
          <CardDescription>
            We use this for grants. You’ll fill it once on your first submission, and you can update it any time.
          </CardDescription>
        </CardHeader>
        <CardContent>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <FormLabel>Birthday</FormLabel>
          <DatePicker value={birthday} onChange={(v) => setBirthday(v)} />
        </div>
        <Input
          label="Address (Line 1) *"
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          placeholder="Street address, PO box, company name, c/o"
          autoComplete="address-line1"
        />
        <Input
          label="Address (Line 2)"
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
          placeholder="Apartment, suite, unit, building, floor"
          autoComplete="address-line2"
        />
        <Input
          label="City *"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          autoComplete="address-level2"
        />
        <Input
          label="State / Province *"
          value={stateProvince}
          onChange={(e) => setStateProvince(e.target.value)}
          placeholder="State / Province"
          autoComplete="address-level1"
        />
        <Input
          label="Country *"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="Country"
          autoComplete="country-name"
        />
        <Input
          label="ZIP / Postal Code *"
          value={zipPostalCode}
          onChange={(e) => setZipPostalCode(e.target.value)}
          placeholder="ZIP / Postal Code"
          autoComplete="postal-code"
        />
      </div>

      {requiredMissing.length ? (
        <div className="mt-5 text-sm text-muted-foreground">
          Missing required fields for first submission:{" "}
          <span className="text-foreground font-medium">{requiredMissing.join(", ")}</span>
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-end gap-3">
        <Button
          type="button"
          onClick={onSave}
          disabled={saving}
          loading={saving}
          loadingText="Saving..."
        >
          Save
        </Button>
      </div>
        </CardContent>
      </Card>
    </div>
  );
}
