/** Deterministic live-sample pulse — same tick always yields the same offset. */
export function queuePulse(baseQueued: number, tick: number): number {
  return Math.max(0, baseQueued + Math.round(Math.sin(tick / 2) * 2));
}

export function congestionPulse(baseScore: number, tick: number): number {
  return Math.min(100, Math.max(0, baseScore + Math.round(Math.sin(tick / 3) * 1.5)));
}
