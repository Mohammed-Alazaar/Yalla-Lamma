"use client";

import { useFormatter } from "next-intl";
import { cn } from "@/lib/utils";

/** Circular countdown ring driven by the client-side countdown fraction. */
export function TimerRing({
  seconds,
  fraction,
  size = 128,
}: {
  seconds: number;
  fraction: number; // 1 → 0
  size?: number;
}) {
  const format = useFormatter();
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(1, fraction)));
  const low = fraction <= 0.25;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* -rotate-90 puts the start of the arc at 12 o'clock; the ring drains
          symmetrically so it reads the same in LTR and RTL. */}
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-secondary"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset] duration-100 ease-linear", low ? "text-destructive" : "text-primary")}
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center text-3xl font-bold tabular-nums",
          low && "text-destructive",
        )}
      >
        {format.number(seconds)}
      </span>
    </div>
  );
}
