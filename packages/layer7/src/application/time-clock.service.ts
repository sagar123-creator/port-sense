import type { PortId } from "@port-sense/layer2-canonical";
import {
  CALENDAR_MAX,
  CALENDAR_MIN,
  type ClockSnapshot,
  type DailyDwellRow,
  type DwellBasis,
  type DwellStat,
  type PortClockReading,
} from "../domain/types.js";
import {
  loadDaily2023,
  loadMonthlyLdb,
  loadTemperatures,
  publishedExportHoursFallback,
  TIME_ENGINE_PORTS,
} from "../infrastructure/store.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function clampCalendarDate(raw: string): string {
  if (!ISO_DATE.test(raw)) return CALENDAR_MIN;
  if (raw < CALENDAR_MIN) return CALENDAR_MIN;
  if (raw > CALENDAR_MAX) return CALENDAR_MAX;
  return raw;
}

export function analog2023Date(asOfDate: string): string {
  const mmdd = asOfDate.slice(5);
  const analog = `2023-${mmdd}`;
  const daily = loadDaily2023();
  if (daily.days.some((d) => d.date === analog)) return analog;
  // 2024-02-29 → 2023-02-28
  if (mmdd === "02-29") return "2023-02-28";
  const sorted = daily.days.map((d) => d.date);
  return sorted[0] ?? "2023-01-01";
}

function findDaily(date: string): DailyDwellRow | undefined {
  return loadDaily2023().days.find((d) => d.date === date);
}

function monthlyExportHours(asOfDate: string): { periodKey: string; hours: number } | null {
  const key = asOfDate.slice(0, 7);
  const row = loadMonthlyLdb().months.find((m) => m.periodKey === key);
  if (!row) return null;
  return { periodKey: row.periodKey, hours: row.exportDwellHours };
}

function temperatureFor(portId: PortId, date: string): {
  meanC: number;
  minC: number;
  maxC: number;
} | null {
  const series = loadTemperatures().ports[portId];
  const hit = series?.find((p) => p.date === date);
  if (!hit) return null;
  return { meanC: hit.meanC, minC: hit.minC, maxC: hit.maxC };
}

function readingForPort(
  portId: PortId,
  asOfDate: string,
  analog: string,
  jnptHours: number,
  jnptBasis: DwellBasis,
  jnptNote: string,
  typicalMeanHours: number | null,
  dwellStat: DwellStat,
): PortClockReading {
  const temps = loadTemperatures();
  const t = temperatureFor(portId, asOfDate);
  if (!t) {
    throw new Error(`No temperature for ${portId} on ${asOfDate}`);
  }
  const tail =
    typicalMeanHours != null && typicalMeanHours > 0 ? jnptHours / typicalMeanHours : 1;
  const baselines = publishedExportHoursFallback();
  const isJnpt = portId === "INNSA";
  const dwellHours = isJnpt
    ? jnptHours
    : Math.round(baselines[portId] * tail * 100) / 100;
  const dwellBasis: DwellBasis = isJnpt ? jnptBasis : "scaled_from_jnpt_shape";
  const dwellNote = isJnpt
    ? jnptNote
    : `This port has no 2023 container CSV. Hours = published dwell × (JNPT p90 / JNPT mean that day). Analog ${analog}.`;

  return {
    portId,
    temperatureC: t.meanC,
    temperatureMinC: t.minC,
    temperatureMaxC: t.maxC,
    temperatureSource: temps.source,
    dwellHours,
    typicalMeanHours: isJnpt ? typicalMeanHours : baselines[portId] ?? null,
    dwellStat,
    dwellBasis,
    dwellNote,
    scaleVsJnptYear: Math.round(tail * 1000) / 1000,
  };
}

export class TimeClockService {
  resolveDay(rawDate: string): ClockSnapshot {
    const asOfDate = clampCalendarDate(rawDate);
    const analog = analog2023Date(asOfDate);
    const dailyExact = asOfDate.startsWith("2023") ? findDaily(asOfDate) : undefined;
    const dailyAnalog = findDaily(analog);
    const monthly = monthlyExportHours(asOfDate);
    const yearMean = loadDaily2023().yearMeanHours;

    let jnptHours: number;
    let jnptBasis: DwellBasis;
    let jnptNote: string;
    let typicalMeanHours: number | null;
    let dwellStat: DwellStat;
    let jnptDaily: DailyDwellRow | null = dailyExact ?? dailyAnalog ?? null;
    let monthlyPeriodKey: string | null = null;
    let analogDate: string | null = analog;

    if (dailyExact) {
      jnptHours = dailyExact.p90Hours;
      typicalMeanHours = dailyExact.meanHours;
      dwellStat = "p90";
      jnptBasis = "jnpt_events_2023";
      jnptNote = `JNPT billed wait = p90 ${dailyExact.p90Hours}h from ${dailyExact.count} verified 2023 events on ${asOfDate} (daily mean ${dailyExact.meanHours}h). Mean is often still inside free time.`;
      analogDate = null;
    } else if (monthly) {
      jnptHours = monthly.hours;
      typicalMeanHours = monthly.hours;
      dwellStat = "monthly_ldb";
      jnptBasis = "jnpt_monthly_ldb";
      jnptNote = `JNPT official LDB monthly export dwell for ${monthly.periodKey} (no container-level CSV this month).`;
      monthlyPeriodKey = monthly.periodKey;
      analogDate = analog;
    } else {
      jnptHours = dailyAnalog?.p90Hours ?? yearMean;
      typicalMeanHours = dailyAnalog?.meanHours ?? yearMean;
      dwellStat = dailyAnalog ? "p90" : "mean";
      jnptBasis = "analog_2023_mmdd";
      jnptNote = `No JNPT events for ${asOfDate}. Using ${analog} 2023 p90 wait (same month-day).`;
    }

    const ports: PortClockReading[] = TIME_ENGINE_PORTS.map((portId) =>
      readingForPort(
        portId,
        asOfDate,
        analog,
        jnptHours,
        jnptBasis,
        jnptNote,
        typicalMeanHours,
        dwellStat,
      ),
    );

    return {
      asOfDate,
      analogDate,
      jnptDaily,
      monthlyPeriodKey,
      ports,
      honestyNote:
        "Temperature is Open-Meteo historical 2 m air temperature for that calendar date — not a port sensor. " +
        "JNPT billed wait is the day's p90 from verified 2023 events (not invented). Daily mean is shown separately and is often inside free time. Other ports are scaled from that shape. This is not live AIS.",
    };
  }

  jnptDailyIndex(): ReadonlyArray<{
    date: string;
    count: number;
    meanHours: number;
    p90Hours: number;
  }> {
    return loadDaily2023().days.map((day) => ({
      date: day.date,
      count: day.count,
      meanHours: day.meanHours,
      p90Hours: day.p90Hours,
    }));
  }

  dwellHoursFor(portId: PortId, rawDate: string): number {
    const snap = this.resolveDay(rawDate);
    const row = snap.ports.find((p) => p.portId === portId);
    if (!row) throw new Error(`No clock reading for ${portId}`);
    return row.dwellHours;
  }

  dwellByPort(rawDate: string): Partial<Record<PortId, number>> {
    const snap = this.resolveDay(rawDate);
    const out: Partial<Record<PortId, number>> = {};
    for (const row of snap.ports) {
      out[row.portId] = row.dwellHours;
    }
    return out;
  }

  temperatureC(portId: PortId, rawDate: string): number {
    const snap = this.resolveDay(rawDate);
    const row = snap.ports.find((p) => p.portId === portId);
    if (!row) throw new Error(`No temperature for ${portId}`);
    return row.temperatureC;
  }
}
