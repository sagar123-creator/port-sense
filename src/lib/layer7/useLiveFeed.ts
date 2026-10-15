"use client";

import { useEffect, useState } from "react";
import { formatIST } from "@/lib/utils";

export function useLiveClock(intervalMs = 20_000): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setLabel(formatIST());
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return label;
}

export function useLiveTick(intervalMs = 8_000): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return tick;
}
