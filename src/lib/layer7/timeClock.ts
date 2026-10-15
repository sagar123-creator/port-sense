import "server-only";

import { DEMO_CALENDAR_DEFAULT } from "@/lib/layer2/demoCalendar";
import {
  createTimeRuntime,
  type TimeRuntime,
} from "@port-sense/layer7-time";
import type { PortId } from "@port-sense/layer2-canonical";

let timeRuntime: TimeRuntime | null = null;

export function getTimeRuntime(): TimeRuntime {
  timeRuntime ??= createTimeRuntime();
  return timeRuntime;
}

export function defaultCalendarDate(): string {
  return DEMO_CALENDAR_DEFAULT;
}

export function parseAsOfDate(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  if (raw < "2023-01-01" || raw > "2024-12-31") return undefined;
  return raw;
}

export function dwellHoursByPort(asOfDate: string): Partial<Record<PortId, number>> {
  return getTimeRuntime().clock.dwellByPort(asOfDate);
}
