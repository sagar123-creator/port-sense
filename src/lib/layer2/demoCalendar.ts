import type { CarrierId } from "@/types";

export type DemoDateBucket = "billed" | "zero";

export interface DemoCalendarDay {
  readonly date: string;
  readonly bucket: DemoDateBucket;
  readonly meanHours: number;
  readonly p90Hours: number;
  readonly count: number;
}

/** Published export dry free time — used only to colour wait-fee vs ₹0. */
export const EXPORT_FREE_DAYS: Record<CarrierId, number> = {
  hapag: 4,
  maersk: 7,
  msc: 7,
  cmacgm: 10,
  undecided: 7,
};

export function analog2023Date(iso: string): string {
  const mmdd = iso.slice(5);
  if (mmdd === "02-29") return "2023-02-28";
  return `2023-${mmdd}`;
}

export function shiftYear(iso: string, year: number): string {
  return `${year}-${iso.slice(5)}`;
}

/** 20 verified 2023 JNPT days: 14 billed (70%) / 6 inside free time (30%) on Hapag 4-day p90. */
export const DEMO_CALENDAR_DEFAULT = "2023-07-17";

export const DEMO_CALENDAR_DAYS: readonly DemoCalendarDay[] = [
  { date: "2023-07-17", bucket: "billed", meanHours: 90.4, p90Hours: 214.88, count: 50 },
  { date: "2023-07-13", bucket: "billed", meanHours: 90.45, p90Hours: 189.62, count: 34 },
  { date: "2023-06-04", bucket: "billed", meanHours: 85.94, p90Hours: 184.49, count: 39 },
  { date: "2023-07-11", bucket: "billed", meanHours: 81.29, p90Hours: 181.97, count: 29 },
  { date: "2023-07-14", bucket: "billed", meanHours: 88.99, p90Hours: 181.55, count: 39 },
  { date: "2023-06-05", bucket: "billed", meanHours: 88, p90Hours: 178.86, count: 29 },
  { date: "2023-07-20", bucket: "billed", meanHours: 85.35, p90Hours: 176.58, count: 46 },
  { date: "2023-07-07", bucket: "billed", meanHours: 98.1, p90Hours: 176.52, count: 26 },
  { date: "2023-10-22", bucket: "billed", meanHours: 78.78, p90Hours: 175.11, count: 39 },
  { date: "2023-08-27", bucket: "billed", meanHours: 89.78, p90Hours: 172.4, count: 20 },
  { date: "2023-08-02", bucket: "billed", meanHours: 87.02, p90Hours: 171.58, count: 40 },
  { date: "2023-06-23", bucket: "billed", meanHours: 88.18, p90Hours: 168.37, count: 45 },
  { date: "2023-06-08", bucket: "billed", meanHours: 78.67, p90Hours: 164.73, count: 40 },
  { date: "2023-04-07", bucket: "billed", meanHours: 74.25, p90Hours: 164.62, count: 36 },
  { date: "2023-11-26", bucket: "zero", meanHours: 49.83, p90Hours: 68.27, count: 33 },
  { date: "2023-05-19", bucket: "zero", meanHours: 47.74, p90Hours: 71.44, count: 33 },
  { date: "2023-02-22", bucket: "zero", meanHours: 50.75, p90Hours: 72.96, count: 36 },
  { date: "2023-03-07", bucket: "zero", meanHours: 46.62, p90Hours: 75.95, count: 52 },
  { date: "2023-01-18", bucket: "zero", meanHours: 47.75, p90Hours: 75.35, count: 36 },
  { date: "2023-12-27", bucket: "zero", meanHours: 54.82, p90Hours: 78.93, count: 41 },
];

export function demoDay(date: string): DemoCalendarDay | undefined {
  return DEMO_CALENDAR_DAYS.find((d) => d.date === date);
}

function formatDayLabel(date: string): string {
  const [y, m, d] = date.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(m) - 1] ?? m;
  return `${Number(d)} ${month} ${y}`;
}

export function demoDateSelectOptions(): Array<{
  value: string;
  label: string;
  group: string;
}> {
  return DEMO_CALENDAR_DAYS.map((day) => ({
    value: day.date,
    label: formatDayLabel(day.date),
    group:
      day.bucket === "billed"
        ? "Wait fee (14 days · 70%)"
        : "Inside free time (6 days · 30%)",
  }));
}
