"use client";

import { useEffect, useMemo, useState } from "react";

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function getTimeLeft(targetDate: Date): TimeLeft {
  const totalMs = Math.max(0, targetDate.getTime() - Date.now());
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return { days, hours, minutes, seconds };
}

export default function SnacksCountdown() {
  const deadline = useMemo(() => new Date("2026-06-30T23:59:59Z"), []);
  const deadlineLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(deadline),
    [deadline],
  );
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setTimeLeft(getTimeLeft(deadline));
    }, 0);
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(deadline));
    }, 1000);
    return () => {
      window.clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [deadline]);

  const display = timeLeft ?? { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const isOver =
    timeLeft !== null &&
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0 &&
    timeLeft.seconds === 0;

  if (isOver) {
    return (
      <p className="text-center text-base font-semibold text-[#6d3510] sm:text-lg">
        The snacks booth closed on {deadlineLabel}.
      </p>
    );
  }

  return (
    <div className="text-center">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#8f4a18]">
        snacks booth shuts on {deadlineLabel}
      </p>
      <div className="mt-4 flex items-start justify-center gap-2 sm:gap-5">
        {[
          { label: "days", value: display.days },
          { label: "hours", value: display.hours },
          { label: "min", value: display.minutes },
          { label: "sec", value: display.seconds },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="min-w-[60px] rounded-2xl border-2 border-[#74210a] bg-[#fff7dc] px-2 py-3 shadow-[3px_3px_0_rgba(116,33,10,1)] sm:min-w-[84px] sm:px-4 sm:py-4"
          >
            <div className="text-2xl font-black tabular-nums text-[#5b1f0a] sm:text-4xl">
              {String(value).padStart(2, "0")}
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#8f4a18] sm:text-xs">
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
