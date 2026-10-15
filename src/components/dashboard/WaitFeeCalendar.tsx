"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftYear } from "@/lib/data/demoCalendar";
import {
  isWaitFee,
  loadJnptCalendar,
  lookupJnptDay,
  type JnptCalendarDay,
} from "@/lib/data/jnptCalendar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const YEAR_TABS = [
  { id: "2023", label: "2023" },
  { id: "2024", label: "2024" },
] as const;

type CalendarYear = (typeof YEAR_TABS)[number]["id"];

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function mondayOffset(year: number, monthIndex: number): number {
  const sundayIndex = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  return (sundayIndex + 6) % 7;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

interface WaitFeeCalendarProps {
  value: string;
  freeDays: number;
  onChange: (date: string) => void;
}

export function WaitFeeCalendar({ value, freeDays, onChange }: WaitFeeCalendarProps) {
  const selectedYear = (value.slice(0, 4) === "2024" ? "2024" : "2023") as CalendarYear;
  const selectedMonth = Math.max(0, Math.min(11, Number(value.slice(5, 7)) - 1));
  const [year, setYear] = useState<CalendarYear>(selectedYear);
  const [monthIndex, setMonthIndex] = useState(selectedMonth);
  const [days, setDays] = useState<readonly JnptCalendarDay[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setYear(selectedYear);
    setMonthIndex(selectedMonth);
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    let cancelled = false;
    loadJnptCalendar().then((payload) => {
      if (cancelled) return;
      if (!payload) {
        setError("Verified wait-fee calendar unavailable");
        return;
      }
      setError(null);
      setDays(payload.days);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const yearNum = Number(year);
  const blanks = mondayOffset(yearNum, monthIndex);
  const count = daysInMonth(yearNum, monthIndex);
  const selected = lookupJnptDay(days, value);
  const billed = selected ? isWaitFee(selected.p90Hours, freeDays) : false;

  const cells = useMemo(() => {
    const out: Array<{ iso: string; day: number; hit: JnptCalendarDay | undefined }> = [];
    for (let day = 1; day <= count; day += 1) {
      const iso = isoDate(yearNum, monthIndex, day);
      out.push({ iso, day, hit: lookupJnptDay(days, iso) });
    }
    return out;
  }, [count, days, monthIndex, yearNum]);

  const goMonth = (delta: number) => {
    const nextMonth = monthIndex + delta;
    const next = new Date(Date.UTC(yearNum, nextMonth, 1));
    const nextYear = next.getUTCFullYear();
    if (nextYear < 2023 || nextYear > 2024) return;
    setYear(String(nextYear) as CalendarYear);
    setMonthIndex(next.getUTCMonth());
  };

  const onYearChange = (nextYear: CalendarYear) => {
    setYear(nextYear);
    const candidate = shiftYear(value, Number(nextYear));
    if (lookupJnptDay(days, candidate)) onChange(candidate);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          items={YEAR_TABS}
          value={year}
          onChange={onYearChange}
          label="Wait-fee year"
        />
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-ink-2 hover:bg-white/[0.06]"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="min-w-[9.5rem] text-center text-small font-semibold text-ink">
            {MONTHS[monthIndex]} {year}
          </p>
          <button
            type="button"
            onClick={() => goMonth(1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-ink-2 hover:bg-white/[0.06]"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {WEEKDAYS.map((label) => (
          <p key={label} className="px-0.5 py-1 text-center text-[0.58rem] font-semibold uppercase text-ink-4 sm:text-label">
            {label}
          </p>
        ))}
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden="true" />
        ))}
        {cells.map((cell) => {
          const enabled = Boolean(cell.hit);
          const wait = cell.hit ? isWaitFee(cell.hit.p90Hours, freeDays) : false;
          const active = cell.iso === value;
          return (
            <button
              key={cell.iso}
              type="button"
              disabled={!enabled}
              onClick={() => onChange(cell.iso)}
              className={cn(
                "flex min-h-[2.55rem] flex-col items-center justify-center rounded-md border px-0.5 py-1 text-[0.7rem] tabular-nums sm:min-h-[3.1rem] sm:rounded-lg sm:px-1 sm:text-label",
                !enabled && "cursor-not-allowed border-transparent text-ink-4/40",
                enabled && !active && wait && "border-hairline bg-brand-orange/12 text-ink",
                enabled && !active && !wait && "border-hairline bg-surface-0/40 text-ink-3",
                active && "border-brand-orange/60 bg-brand-orange/20 text-ink",
              )}
            >
              <span>{cell.day}</span>
              {enabled ? (
                <span className="text-[0.62rem] font-semibold uppercase tracking-[0.04em]">
                  {wait ? "Fee" : "₹0"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {error ? <p className="text-small text-risk-high">{error}</p> : null}

      {selected ? (
        <p className="rounded-panel border border-hairline bg-surface-0/40 px-3 py-2.5 text-small text-ink-3">
          {value}
          {" · "}
          <span className="font-semibold text-ink">{billed ? "Wait fee" : "No wait fee"}</span>
        </p>
      ) : (
        <p className="text-small text-ink-4">Pick a filled day.</p>
      )}
    </div>
  );
}
