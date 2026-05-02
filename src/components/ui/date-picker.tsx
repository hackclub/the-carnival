"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ============================================================================
// DatePicker — single date (YYYY-MM-DD string value)
// ============================================================================

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

function toDate(value: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toDateString(date: Date | undefined): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DatePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "Pick a date",
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = toDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-[var(--radius-xl)] border border-input bg-background px-4 py-3 text-sm text-foreground transition-colors",
          "hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground",
          className,
        )}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        {selected ? format(selected, "PPP") : <span>{placeholder}</span>}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(day) => {
            onChange(toDateString(day));
            setOpen(false);
          }}
          defaultMonth={selected}
        />
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// DateTimePicker — date + time (ISO string or datetime-local string)
// ============================================================================

type DateTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  min?: string;
  max?: string;
};

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseDatetimeLocal(value: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function DateTimePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "Pick date & time",
  className,
  min,
  max,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const dtLocal = toDatetimeLocalValue(value);
  const selected = parseDatetimeLocal(dtLocal);

  const timeRef = React.useRef<HTMLInputElement>(null);

  const currentTime = React.useMemo(() => {
    if (!dtLocal) return "00:00";
    return dtLocal.split("T")[1] ?? "00:00";
  }, [dtLocal]);

  const handleDaySelect = React.useCallback(
    (day: Date | undefined) => {
      if (!day) return;
      const pad = (n: number) => String(n).padStart(2, "0");
      const datePart = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
      onChange(`${datePart}T${currentTime}`);
    },
    [currentTime, onChange],
  );

  const handleTimeChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = e.target.value;
      if (!selected) {
        const today = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const datePart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
        onChange(`${datePart}T${time}`);
        return;
      }
      const pad = (n: number) => String(n).padStart(2, "0");
      const datePart = `${selected.getFullYear()}-${pad(selected.getMonth() + 1)}-${pad(selected.getDate())}`;
      onChange(`${datePart}T${time}`);
    },
    [onChange, selected],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-[var(--radius-xl)] border border-input bg-background px-4 py-3 text-sm text-foreground transition-colors",
          "hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground",
          className,
        )}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        {selected ? (
          format(selected, "PPP p")
        ) : (
          <span>{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleDaySelect}
          defaultMonth={selected}
        />
        <div className="border-t border-border px-3 py-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Time
            <input
              ref={timeRef}
              type="time"
              value={currentTime}
              onChange={handleTimeChange}
              className="rounded-[var(--radius-lg)] border border-input bg-background px-2 py-1 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}
