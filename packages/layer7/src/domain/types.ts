/**
 * Layer 7 — Time engine (calendar + simulated live replay).
 * Does not invent AIS. Dwell for 2023 JNPT comes from the verified event CSV.
 */

import type { PortId } from "@port-sense/layer2-canonical";

export const LIVE_INTERVAL_MINUTES = 10 as const;
export const CALENDAR_MIN = "2023-01-01" as const;
export const CALENDAR_MAX = "2024-12-31" as const;

export type DwellBasis =
  | "jnpt_events_2023"
  | "jnpt_monthly_ldb"
  | "analog_2023_mmdd"
  | "scaled_from_jnpt_shape";

/** Billed wait uses p90 of that day's verified events (mean is shown separately). */
export type DwellStat = "p90" | "mean" | "monthly_ldb";

export interface DailyDwellRow {
  readonly date: string;
  readonly count: number;
  readonly meanHours: number;
  readonly p50Hours: number;
  readonly p90Hours: number;
  readonly minHours: number;
  readonly maxHours: number;
  readonly sampleHours: readonly number[];
}

export interface TemperaturePoint {
  readonly date: string;
  readonly meanC: number;
  readonly minC: number;
  readonly maxC: number;
}

export interface PortClockReading {
  readonly portId: PortId;
  readonly temperatureC: number;
  readonly temperatureMinC: number;
  readonly temperatureMaxC: number;
  readonly temperatureSource: string;
  readonly dwellHours: number;
  readonly typicalMeanHours: number | null;
  readonly dwellStat: DwellStat;
  readonly dwellBasis: DwellBasis;
  readonly dwellNote: string;
  readonly scaleVsJnptYear: number;
}

export interface ClockSnapshot {
  readonly asOfDate: string;
  readonly analogDate: string | null;
  readonly jnptDaily: DailyDwellRow | null;
  readonly monthlyPeriodKey: string | null;
  readonly ports: readonly PortClockReading[];
  readonly honestyNote: string;
}

export interface LiveObservation {
  readonly id: string;
  readonly postedAt: string;
  readonly asOfDate: string;
  readonly portId: PortId;
  readonly dwellHours: number;
  readonly temperatureC: number;
  readonly label: string;
}

export interface LiveFeed {
  readonly asOfDate: string;
  readonly tickMinutes: typeof LIVE_INTERVAL_MINUTES;
  readonly nextPostAt: string;
  readonly observations: readonly LiveObservation[];
  readonly clock: ClockSnapshot;
  readonly agentNote: string;
}

/** IPA Daily Vessels Position — snapshot counts, not AIS and not dwell. */
export interface IpaVesselRow {
  readonly date: string;
  readonly ipaName: string;
  readonly portId: PortId | null;
  readonly uiPortId: string | null;
  readonly inProduct: boolean;
  readonly atBerth: number | null;
  readonly atAnchorage: number | null;
  readonly remark: string | null;
  readonly sourceFile: string | null;
  readonly note: string;
  readonly cargo: IpaCargoYtd | null;
}

export interface IpaCargoYtd {
  readonly period: "apr-jul";
  readonly tonnes2026k: number;
  readonly tonnes2025k: number;
  readonly variationPct: number;
}

export interface IpaMissingProductPort {
  readonly portId: PortId;
  readonly uiPortId: string;
  readonly reason: string;
}

export interface IpaVesselBoard {
  readonly asOfDate: string;
  readonly latestDate: string;
  readonly dates: readonly string[];
  readonly source: string;
  readonly sourceUrl: string;
  readonly rows: readonly IpaVesselRow[];
  readonly missingProductPorts: readonly IpaMissingProductPort[];
  readonly honestyNote: string;
}
