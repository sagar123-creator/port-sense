import { MONTHLY_CARGO, MONTHLY_CARGO_PERIODS, monthlyCargoForPeriod } from "@/lib/layer2/monthlyCargo";
import { portShortLabel } from "@/lib/layer2/portLabels";
import { SAMPLE_INPUT } from "@/lib/layer2/sample";
import { compareAllPorts } from "@/lib/layer3/demurrageCalc";
import { quoteCityToPort } from "@/lib/layer6/cargoCost.service";
import { DEFAULT_START_LOCATION_ID, getStartLocation } from "@/lib/layer4/startLocations";
import { PORTS } from "@/lib/layer2/ports";

export const YEAR_2526_PORTS = ["jnpt", "chennai", "cochin", "vizag", "kolkata"] as const;
export type Year2526PortId = (typeof YEAR_2526_PORTS)[number];

const MONTH_SHORT: Record<string, string> = {
  "2025-10": "Oct 25",
  "2025-11": "Nov 25",
  "2025-12": "Dec 25",
  "2026-01": "Jan 26",
  "2026-02": "Feb 26",
  "2026-03": "Mar 26",
  "2026-04": "Apr 26",
  "2026-05": "May 26",
  "2026-06": "Jun 26",
  "2026-07": "Jul 26",
};

export interface CargoMonthPoint {
  readonly periodKey: string;
  readonly label: string;
  readonly total: number;
  readonly byPort: Record<Year2526PortId, number>;
}

export interface PortCargoTotal {
  readonly portId: Year2526PortId;
  readonly label: string;
  readonly tonnes: number;
}

export interface ExtraWaitRow {
  readonly portId: string;
  readonly label: string;
  readonly extraDwellDays: number;
  readonly extraCostInr: number;
}

export interface InlandHaulRow {
  readonly portId: string;
  readonly label: string;
  readonly km: number;
  readonly roadPredictedInr: number;
  readonly railPredictedInr: number;
  readonly cheapestInr: number;
}

export function cargoMonthSeries(): CargoMonthPoint[] {
  return MONTHLY_CARGO_PERIODS.map((periodKey) => {
    const rows = monthlyCargoForPeriod(periodKey);
    const byPort = {
      jnpt: 0,
      chennai: 0,
      cochin: 0,
      vizag: 0,
      kolkata: 0,
    } as Record<Year2526PortId, number>;
    for (const row of rows) {
      if (row.portUiId in byPort) {
        byPort[row.portUiId as Year2526PortId] = row.tonnes;
      }
    }
    return {
      periodKey,
      label: MONTH_SHORT[periodKey] ?? periodKey,
      total: rows.reduce((sum, row) => sum + row.tonnes, 0),
      byPort,
    };
  });
}

export function cargoPortTotalsFromSeries(series: readonly CargoMonthPoint[]): PortCargoTotal[] {
  const sums: Record<Year2526PortId, number> = {
    jnpt: 0,
    chennai: 0,
    cochin: 0,
    vizag: 0,
    kolkata: 0,
  };
  for (const point of series) {
    for (const portId of YEAR_2526_PORTS) {
      sums[portId] += point.byPort[portId];
    }
  }
  return YEAR_2526_PORTS.map((portId) => ({
    portId,
    label: portShortLabel(portId),
    tonnes: sums[portId],
  })).sort((a, b) => b.tonnes - a.tonnes);
}

export function cargoPortTotals(): PortCargoTotal[] {
  return cargoPortTotalsFromSeries(cargoMonthSeries());
}

export function seriesForCalendarYear(
  series: readonly CargoMonthPoint[],
  year: 2025 | 2026,
): CargoMonthPoint[] {
  const prefix = `${year}-`;
  return series.filter((point) => point.periodKey.startsWith(prefix));
}

export function extraWaitForTypicalBooking(): ExtraWaitRow[] {
  return compareAllPorts({
    shipDate: SAMPLE_INPUT.shipDate,
    containerType: SAMPLE_INPUT.containerType,
    carrierId: SAMPLE_INPUT.carrierId,
    containerCount: SAMPLE_INPUT.containerCount,
  }).map(({ port, result }) => ({
    portId: port.id,
    label: portShortLabel(port.id, port.name),
    extraDwellDays: port.extraDwellDays,
    extraCostInr: result?.estimatedCostINR ?? 0,
  }));
}

export function inlandFromDefaultCity(): InlandHaulRow[] {
  const city = getStartLocation(DEFAULT_START_LOCATION_ID);
  return PORTS.map((port) => {
    const haul = quoteCityToPort({
      startCityId: city.id,
      toPortId: port.id,
      containerType: SAMPLE_INPUT.containerType,
      containerCount: SAMPLE_INPUT.containerCount,
    });
    const road = haul?.quotes.find((row) => row.mode === "road");
    const rail = haul?.quotes.find((row) => row.mode === "rail_bulk");
    const cheapest = Math.min(road?.predictedCostInr ?? Infinity, rail?.predictedCostInr ?? Infinity);
    return {
      portId: port.id,
      label: portShortLabel(port.id, port.name),
      km: haul?.km ?? 0,
      roadPredictedInr: road?.predictedCostInr ?? 0,
      railPredictedInr: rail?.predictedCostInr ?? 0,
      cheapestInr: Number.isFinite(cheapest) ? cheapest : 0,
    };
  });
}

export const YEAR_2526_SOURCE = {
  file: MONTHLY_CARGO.source.file,
  jnpaLdb: MONTHLY_CARGO.source.officialDayWiseWaitFee.jnpaNlds,
  grain: "Monthly cargo tonnes · Oct 2025–Jul 2026 · five major ports",
  tonnesNote: "Figures are tonnes of cargo handled — not containers and not wait-fee.",
} as const;

/**
 * One modelled 8×40ft extra-wait lot per 1 lakh tonnes at that gate.
 * Throughput is mostly not delayed boxes — this is a conservative slice, not every tonne.
 */
export const TONNES_PER_MODELLED_LOT = 100_000;

export function savingsVsCheapest(extraWait: readonly ExtraWaitRow[]): SavingsRow[] {
  if (extraWait.length === 0) return [];
  const floor = Math.min(...extraWait.map((row) => row.extraCostInr));
  return extraWait
    .map((row) => ({
      portId: row.portId,
      label: row.label,
      extraCostInr: row.extraCostInr,
      extraDwellDays: row.extraDwellDays,
      savedInr: Math.max(0, row.extraCostInr - floor),
    }))
    .sort((a, b) => b.savedInr - a.savedInr);
}

export interface SavingsRow {
  readonly portId: string;
  readonly label: string;
  readonly extraCostInr: number;
  readonly extraDwellDays: number;
  readonly savedInr: number;
}

export function lostByPort(
  savings: readonly SavingsRow[],
  portTotals: readonly PortCargoTotal[],
): SavingsRow[] {
  const byId = new Map(savings.map((row) => [row.portId, row]));
  return portTotals
    .map((port) => {
      const row = byId.get(port.portId);
      const savedInr = row
        ? Math.round((port.tonnes / TONNES_PER_MODELLED_LOT) * row.savedInr)
        : 0;
      return {
        portId: port.portId,
        label: port.label,
        extraCostInr: row?.extraCostInr ?? 0,
        extraDwellDays: row?.extraDwellDays ?? 0,
        savedInr,
      };
    })
    .sort((a, b) => b.savedInr - a.savedInr);
}

export interface YearSliceStats {
  readonly year: 2025 | 2026 | "combined";
  readonly heading: string;
  readonly rangeLabel: string;
  readonly months: number;
  readonly totalTransit: number;
  readonly totalLost: number;
  readonly lostRows: readonly SavingsRow[];
}

function sliceFromSeries(
  series: readonly CargoMonthPoint[],
  extraWait: readonly ExtraWaitRow[],
  meta: Pick<YearSliceStats, "year" | "heading" | "rangeLabel">,
): YearSliceStats {
  const savings = savingsVsCheapest(extraWait);
  const totals = cargoPortTotalsFromSeries(series);
  const lostRows = lostByPort(savings, totals);
  const totalLost = lostRows.reduce((sum, row) => sum + row.savedInr, 0);
  const totalTransit = series.reduce((sum, row) => sum + row.total, 0);
  return {
    ...meta,
    months: series.length,
    totalTransit,
    totalLost,
    lostRows,
  };
}

export function transitStats(series: readonly CargoMonthPoint[], extraWait: readonly ExtraWaitRow[]) {
  const y2025Series = seriesForCalendarYear(series, 2025);
  const y2026Series = seriesForCalendarYear(series, 2026);
  const combined = sliceFromSeries(series, extraWait, {
    year: "combined",
    heading: "Combined",
    rangeLabel: "Oct 2025 – Jul 2026",
  });
  const y2025 = sliceFromSeries(y2025Series, extraWait, {
    year: 2025,
    heading: "2025",
    rangeLabel: "Oct – Dec 2025",
  });
  const y2026 = sliceFromSeries(y2026Series, extraWait, {
    year: 2026,
    heading: "2026",
    rangeLabel: "Jan – Jul 2026",
  });
  const months = Math.max(1, combined.months);
  const avgExtraDays =
    extraWait.reduce((sum, row) => sum + row.extraDwellDays, 0) / Math.max(1, extraWait.length);
  const savings = savingsVsCheapest(extraWait);
  return {
    totalTransit: combined.totalTransit,
    months,
    avgMonthlyTransit: combined.totalTransit / months,
    avgExtraDays,
    totalLost: combined.totalLost,
    maxSaved: savings[0]?.savedInr ?? 0,
    savings,
    lostRows: combined.lostRows,
    y2025,
    y2026,
    combined,
  };
}
