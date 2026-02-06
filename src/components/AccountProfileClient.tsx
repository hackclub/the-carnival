"use client";

import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/form";

export type AccountProfileInitial = {
  birthday: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  country: string | null;
  zipPostalCode: string | null;
};

function toClean(v: string) {
  const s = v.trim();
  return s ? s : "";
}

export default function AccountProfileClient({ initial }: { initial: AccountProfileInitial }) {
  const [saving, setSaving] = useState(false);

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
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="text-foreground font-semibold text-lg">Shipping address</div>
      <div className="text-muted-foreground mt-1">
        We use this for grants. You’ll fill it once on your first submission, and you can update it any time.
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Birthday"
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          autoComplete="bday"
        />
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
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="bg-carnival-red hover:bg-carnival-red/80 disabled:bg-carnival-red/50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-full font-bold transition-colors shadow-md leading-none"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

