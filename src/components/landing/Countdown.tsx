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

export default function Countdown() {
  const deadline = useMemo(() => new Date("2026-05-31T23:59:59Z"), []);
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
    <div className="mx-auto mt-10 max-w-3xl px-4 text-center sm:mt-14">
      {!isOver ? (
        <>
          <p className="text-base font-semibold text-[#8f4a18] sm:text-lg">
            the gates close on <strong>{deadlineLabel}</strong> at 23:59 UTC —
          </p>
          <div className="mt-3 flex items-start justify-center gap-4 sm:gap-7">
            {[
              { label: "days", value: displayTimeLeft.days },
              { label: "hours", value: displayTimeLeft.hours },
              { label: "minutes", value: displayTimeLeft.minutes },
              { label: "seconds", value: displayTimeLeft.seconds },
            ].map(({ label, value }, index) => (
              <div key={label} className="flex items-start gap-4 sm:gap-7">
                {index > 0 && (
                  <span
                    aria-hidden="true"
                    className="text-3xl font-black text-[#e08609] sm:text-5xl"
                  >
                    :
                  </span>
                )}
                <div>
                  <div className="text-4xl font-black tabular-nums text-[#5b1f0a] sm:text-6xl">
                    {String(value).padStart(2, "0")}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-[#8f4a18]">
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mx-auto max-w-xl text-lg font-semibold leading-8 text-[#6d3510] [text-wrap:balance] sm:text-xl">
          The gates closed on {deadlineLabel}. If you shipped something, head
          to the dashboard and claim your tickets.
        </p>
      )}
    </div>
  );
}
