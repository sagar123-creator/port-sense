/**
 * Pure scoring math for the dashboard's "historical context" what-if overlay.
 *
 * No React, no I/O: every number the overlay prints is produced here so the
 * arithmetic can be inspected and re-computed independently. The index is an
 * advisory overlay only — it never touches or replaces the app's congestion
 * score, and it never invents a missing indicator:
 *
 *   1. min–max normalise each indicator across the ports shown (0–100);
 *   2. invert dwell + turnaround so lower hours score higher (throughput is
 *      reported as scale, not as "better service");
 *   3. weighted mean over the components a port actually has published
 *      (weights renormalise over available components; a weight of 0 drops
 *      the indicator entirely).
 */
import type { PortMatrixRow } from "./queries";

export type WeightKey = "dwell" | "trt" | "throughput";

export const WEIGHT_KEYS: readonly WeightKey[] = ["dwell", "trt", "throughput"];

/** Reference ranking: all three indicators weighted equally. */
export const EQUAL_WEIGHTS: Record<WeightKey, number> = { dwell: 1, trt: 1, throughput: 1 };

export interface PortScore {
  portId: string;
  /** 0–100 per indicator, null when the port has no published value. */
  components: Record<WeightKey, number | null>;
  /** Weighted mean of available components, null when nothing usable. */
  composite: number | null;
  /** Components that contributed (published AND weight > 0). */
  used: WeightKey[];
}

/** Min–max normalise across present values; nulls stay null, <2 values → all null. */
export function normalise(values: readonly (number | null)[]): Array<number | null> {
  const present = values.filter((v): v is number => v !== null);
  if (present.length < 2) return values.map(() => null);
  const min = Math.min(...present);
  const max = Math.max(...present);
  if (max === min) return values.map((v) => (v === null ? null : 50));
  return values.map((v) => (v === null ? null : ((v - min) / (max - min)) * 100));
}

/** Component scores + composite for the given weights (see file header for the rules). */
export function computeScores(
  ports: readonly PortMatrixRow[],
  weights: Record<WeightKey, number>,
): PortScore[] {
  const dwellNorm = normalise(ports.map((p) => p.exportDwellHours));
  const trtNorm = normalise(ports.map((p) => p.trtHours));
  const cargoNorm = normalise(ports.map((p) => p.avgMonthlyTonnes));
  return ports.map((port, i) => {
    const components: Record<WeightKey, number | null> = {
      dwell: dwellNorm[i] === null ? null : 100 - dwellNorm[i], // lower dwell → better
      trt: trtNorm[i] === null ? null : 100 - trtNorm[i], // lower TRT → better
      throughput: cargoNorm[i], // higher cargo → more scale (neutral)
    };
    const used = WEIGHT_KEYS.filter((k) => components[k] !== null && weights[k] > 0);
    const totalWeight = used.reduce((sum, k) => sum + weights[k], 0);
    const composite =
      totalWeight > 0
        ? used.reduce((sum, k) => sum + (components[k] as number) * weights[k], 0) / totalWeight
        : null;
    return { portId: port.portId, components, composite, used };
  });
}

/**
 * Deterministic ranking under the given weights: composite desc, then port
 * name asc. Ports with no usable component sort last (composite -Infinity).
 */
export function rankBy(
  ports: readonly PortMatrixRow[],
  weights: Record<WeightKey, number>,
): Array<{ portId: string; composite: number }> {
  const nameOf = new Map(ports.map((p) => [p.portId, p.portName]));
  return computeScores(ports, weights)
    .map((score) => ({
      portId: score.portId,
      composite: score.composite ?? Number.NEGATIVE_INFINITY,
    }))
    .sort(
      (a, b) =>
        b.composite - a.composite ||
        (nameOf.get(a.portId) ?? "").localeCompare(nameOf.get(b.portId) ?? ""),
    );
}
