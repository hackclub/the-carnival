"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/form";
import {
  FIXED_RATE_TOKENS,
  FIXED_RATE_USD,
  TOKENS_PER_HOUR,
  tokensToHours,
  tokensToUsd,
  usdToTokens,
} from "@/lib/wallet-converter";

type WalletConverterPopoverProps = {
  walletBalance: number | null;
  variant?: "default" | "chip" | "compact";
};

function parseAmount(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNumber(value: number, maximumFractionDigits = 2): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

export default function WalletConverterPopover({
  walletBalance,
  variant = "default",
}: WalletConverterPopoverProps) {
  const [tokenInput, setTokenInput] = useState("10");
  const [usdInput, setUsdInput] = useState("4");

  const tokenAmount = useMemo(() => parseAmount(tokenInput), [tokenInput]);
  const usdAmount = useMemo(() => parseAmount(usdInput), [usdInput]);

  const tokenToUsd = tokenAmount === null ? null : tokensToUsd(tokenAmount);
  const tokenToHours = tokenAmount === null ? null : tokensToHours(tokenAmount);

  const usdToToken = usdAmount === null ? null : usdToTokens(usdAmount);
  const usdToHours = usdToToken === null ? null : tokensToHours(usdToToken);

  return (
    <details className="relative">
      <summary className="list-none cursor-pointer select-none">
        <span
          className={
            variant === "compact"
              ? "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/70 text-sm font-semibold text-foreground"
              : variant === "chip"
                ? "inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/70 px-2.5 py-1.5 text-sm font-semibold text-foreground"
                : "bg-carnival-blue/15 border border-border text-foreground px-4 py-2 rounded-[var(--radius-xl)] font-semibold inline-flex items-center gap-2"
          }
          title="Wallet balance and converter"
        >
          <span>{variant === "compact" ? "🪙" : `🪙 ${walletBalance ?? "—"}`}</span>
          {variant === "default" ? (
            <span className="text-xs text-muted-foreground">Convert ▾</span>
          ) : null}
        </span>
      </summary>

      <div className="absolute right-0 mt-3 z-50 w-[340px] rounded-[var(--radius-2xl)] bg-card/95 backdrop-blur border border-border shadow-xl p-4 space-y-4">
        <div className="text-xs text-muted-foreground">
          Fixed rates:{" "}
          <span className="text-foreground font-medium">
            {FIXED_RATE_TOKENS} tokens = ${FIXED_RATE_USD} and 1 hour = {TOKENS_PER_HOUR} tokens
          </span>
        </div>

        <div className="space-y-2">
          <Input
            size="small"
            label="Tokens"
            type="number"
            min="0"
            step="0.01"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Enter token amount"
          />
          <div className="text-sm text-muted-foreground">
            USD equivalent:{" "}
            <span className="text-foreground font-semibold">
              {tokenToUsd === null ? "—" : formatCurrency(tokenToUsd)}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            Hour equivalent:{" "}
            <span className="text-foreground font-semibold">
              {tokenToHours === null ? "—" : `${formatNumber(tokenToHours)}h`}
            </span>
          </div>
        </div>

        <div className="h-px bg-border" />

        <div className="space-y-2">
          <Input
            size="small"
            label="USD"
            type="number"
            min="0"
            step="0.01"
            value={usdInput}
            onChange={(e) => setUsdInput(e.target.value)}
            placeholder="Enter USD amount"
          />
          <div className="text-sm text-muted-foreground">
            Token equivalent:{" "}
            <span className="text-foreground font-semibold">
              {usdToToken === null ? "—" : formatNumber(usdToToken)}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            Hour equivalent:{" "}
            <span className="text-foreground font-semibold">
              {usdToHours === null ? "—" : `${formatNumber(usdToHours)}h`}
            </span>
          </div>
        </div>
      </div>
    </details>
  );
}
