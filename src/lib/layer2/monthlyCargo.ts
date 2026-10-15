import monthlyCargoJson from "@/lib/layer2/monthlyCargo.json";

export interface MonthlyCargoRow {
  readonly portUiId: string;
  readonly sourceName: string;
  readonly periodKey: string;
  readonly monthLabel: string;
  readonly tonnes: number;
}

export interface MonthlyCargoFile {
  readonly source: {
    readonly file: string;
    readonly grain: "month";
    readonly unit: "tonnes";
    readonly notDayWise: true;
    readonly notCompanyWise: true;
    readonly notDestinationWise: true;
    readonly officialDayWiseWaitFee: {
      readonly status: "not_found";
      readonly years: readonly string[];
      readonly jnpaNlds: string;
      readonly note: string;
    };
  };
  readonly portMap: Readonly<Record<string, string>>;
  readonly rows: readonly MonthlyCargoRow[];
}

export const MONTHLY_CARGO = monthlyCargoJson as MonthlyCargoFile;

export const MONTHLY_CARGO_PERIODS = [
  ...new Set(MONTHLY_CARGO.rows.map((row) => row.periodKey)),
] as const;

export function periodKeyFromIso(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return iso.slice(0, 7);
}

export function monthlyCargoForPeriod(periodKey: string): MonthlyCargoRow[] {
  return MONTHLY_CARGO.rows.filter((row) => row.periodKey === periodKey);
}

function compactCount(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) {
    const cr = abs / 1e7;
    const n = cr >= 10 ? cr.toFixed(0) : cr.toFixed(1).replace(/\.0$/, "");
    return `${sign}${n}Cr`;
  }
  if (abs >= 1e5) {
    const lakh = abs / 1e5;
    const n = lakh >= 10 ? lakh.toFixed(0) : lakh.toFixed(1).replace(/\.0$/, "");
    return `${sign}${n}L`;
  }
  return `${sign}${Math.round(abs).toString()}`;
}

export function formatTonnes(tonnes: number): string {
  const rounded = Math.round(tonnes);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}${groupIndianTonnes(String(Math.abs(rounded)))} tonnes`;
}

function groupIndianTonnes(intDigits: string): string {
  if (intDigits.length <= 3) return intDigits;
  const last3 = intDigits.slice(-3);
  const rest = intDigits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

export function formatTonnesCompact(tonnes: number): string {
  return `${compactCount(tonnes)} tonnes`;
}

/** Axis labels — number only (unit is in the chart title). */
export function formatTonnesAxis(tonnes: number): string {
  return compactCount(tonnes);
}
