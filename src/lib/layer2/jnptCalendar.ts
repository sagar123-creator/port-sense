import { analog2023Date } from "@/lib/layer2/demoCalendar";

export interface JnptCalendarDay {
  readonly date: string;
  readonly count: number;
  readonly meanHours: number;
  readonly p90Hours: number;
}

export interface JnptCalendarPayload {
  ok: boolean;
  billedStat: "p90";
  source: string;
  analogNote: string;
  days: readonly JnptCalendarDay[];
}

let cache: JnptCalendarPayload | null = null;
let inflight: Promise<JnptCalendarPayload | null> | null = null;

export async function loadJnptCalendar(): Promise<JnptCalendarPayload | null> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/api/calendar")
    .then(async (res) => {
      const data = (await res.json()) as JnptCalendarPayload | { ok?: false };
      if (!data.ok || !("days" in data)) return null;
      cache = data;
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function lookupJnptDay(
  days: readonly JnptCalendarDay[],
  iso: string,
): JnptCalendarDay | undefined {
  const analog = analog2023Date(iso);
  return days.find((day) => day.date === analog);
}

export function isWaitFee(p90Hours: number, freeDays: number): boolean {
  return p90Hours > freeDays * 24;
}
