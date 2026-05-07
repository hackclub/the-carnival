"use client";

import { useEffect, useMemo, useState } from "react";
import { carnivalCardClassName, cx } from "@/components/home/shared";

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

export default function Countdown() {
  const deadline = useMemo(() => new Date("2026-04-30T23:59:59Z"), []);
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

  const displayTimeLeft = timeLeft ?? {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  };
  const isOver =
    timeLeft !== null &&
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0 &&
    timeLeft.seconds === 0;

  return (
    <div className="mx-auto max-w-6xl px-1">
      <div
        className={cx(
          carnivalCardClassName,
          "carnival-card-soft relative overflow-hidden px-5 py-6 sm:px-6 sm:py-7",
        )}
      >
        <div className="pointer-events-none absolute inset-x-6 top-0 h-2 rounded-b-full bg-[#7b240a]/15" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8f4a18]">
              Countdown
            </p>
            <h2 className="mt-2 text-3xl font-bold uppercase tracking-[0.08em] text-[#5b1f0a] [text-wrap:balance] sm:text-[2.3rem]">
              Countdown to the Carnival finale.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#6d3510] sm:text-base sm:leading-7">
              Deadline: <span className="font-bold">{deadlineLabel}</span> at{" "}
              <span className="font-bold">23:59 UTC</span>.
            </p>
          </div>

          {!isOver ? (
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Days", value: displayTimeLeft.days },
                { label: "Hours", value: displayTimeLeft.hours },
                { label: "Minutes", value: displayTimeLeft.minutes },
                { label: "Seconds", value: displayTimeLeft.seconds },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="min-w-0 rounded-[1.5rem] border-[3px] border-[#74210a] bg-[#f6a61c] px-3 py-3 text-center shadow-[0_6px_0_#bf6216] sm:px-4 sm:py-4"
                >
                  <div className="text-2xl font-bold text-[#fff7dc] tabular-nums sm:text-4xl">
                    {String(value).padStart(2, "0")}
                  </div>
                  <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffeab3]">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="max-w-md rounded-[1.5rem] border-[3px] border-[#74210a] bg-[#f6a61c] px-5 py-5 text-[#fff7dc] shadow-[0_6px_0_#bf6216]">
              <div className="text-2xl font-bold uppercase tracking-[0.08em] [text-wrap:balance] sm:text-3xl">
                The Carnival deadline has arrived.
              </div>
              <div className="mt-2 text-sm font-semibold leading-6 text-[#fff0c1] sm:text-base">
                Time to light up the midway and submit your masterpiece.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
