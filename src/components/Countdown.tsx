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
  const deadline = useMemo(() => new Date("2025-11-30T23:59:59Z"), []);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(getTimeLeft(deadline));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(deadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const isOver =
    timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

  return (
    <div className="relative mx-auto max-w-4xl mt-10">
      {/* Garland frame */}
      <div className="pointer-events-none absolute -inset-2 rounded-3xl ring-4 ring-amber-300/50" />
      <div className="pointer-events-none absolute -inset-4 rounded-3xl blur-xl" style={{
        background:
          "radial-gradient(120px 40px at 8% 0%, #f59e0b30, transparent), radial-gradient(120px 40px at 92% 0%, #ef444430, transparent)"
      }} />

      <div className="relative rounded-3xl bg-white/80 backdrop-blur-md ring-1 ring-amber-200 shadow-lg p-5 md:p-7">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-xl md:text-2xl font-extrabold text-amber-900">🎪 Countdown to the Carnival Finale</span>
        </div>

        {!isOver ? (
          <div className="grid grid-cols-4 gap-2 md:gap-4 text-center">
            {[{ label: "Days", value: timeLeft.days }, { label: "Hours", value: timeLeft.hours }, { label: "Minutes", value: timeLeft.minutes }, { label: "Seconds", value: timeLeft.seconds }].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-2xl bg-gradient-to-b from-amber-50 to-white ring-1 ring-amber-200 p-3 md:p-4 shadow-sm transform transition-transform hover:-translate-y-0.5"
              >
                <div className="text-2xl md:text-4xl font-black text-amber-900 tabular-nums">
                  {String(value).padStart(2, "0")}
                </div>
                <div className="text-[10px] md:text-xs uppercase tracking-wide text-amber-700">{label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-amber-900">
            <div className="text-3xl md:text-4xl font-extrabold">🎉 The Carnival deadline has arrived! 🎉</div>
            <div className="mt-2 text-sm md:text-base text-amber-800">Time to light up the midway and submit your masterpiece.</div>
          </div>
        )}

        {/* bunting */}
        <div className="pointer-events-none absolute -top-3 left-4 right-4 flex justify-between">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="w-0 h-0 border-l-6 border-r-6 border-l-transparent border-r-transparent"
              style={{
                borderBottom: `12px solid ${["#f43f5e","#fb923c","#f59e0b","#22c55e","#3b82f6","#a855f7"][i % 6]}`
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}


