import { haversineKm } from "../domain/geo.js";
import { getPtpkRate, type PtpkMode } from "../domain/ptpk-rates.js";

/**
 * Inland freight predictor matching the team notebook:
 * exact haversine km, PTPK baseline, Random Forest on synthetic bills
 * (baseline × 0.95–1.22 for tolls / fuel / handling).
 * Not a booked rate. Not GPS highway km.
 */
export const MARKET_OVERLAY_MIN = 0.95;
export const MARKET_OVERLAY_MAX = 1.22;
export const MARKET_OVERLAY_MEAN =
  (MARKET_OVERLAY_MIN + MARKET_OVERLAY_MAX) / 2;

const MODE_ORDER: readonly PtpkMode[] = ["road", "rail_bulk", "rail_parcel"];

const TRAIN_PORTS = [
  { lat: 18.9499, lng: 72.9515 },
  { lat: 13.1007, lng: 80.2938 },
  { lat: 9.9634, lng: 76.2602 },
  { lat: 17.6868, lng: 83.2185 },
  { lat: 22.5448, lng: 88.309 },
] as const;

type FeatureRow = readonly [number, number, number];

type TreeNode =
  | { readonly kind: "leaf"; readonly value: number }
  | {
      readonly kind: "split";
      readonly feature: 0 | 1 | 2;
      readonly threshold: number;
      readonly left: TreeNode;
      readonly right: TreeNode;
    };

interface TrainRow {
  readonly x: FeatureRow;
  readonly y: number;
}

const N_TREES = 28;
const MAX_DEPTH = 8;
const MIN_LEAF = 8;
const QUANTILES = 12;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function modeCode(mode: PtpkMode): number {
  return MODE_ORDER.indexOf(mode);
}

function baselineCost(km: number, tonnes: number, mode: PtpkMode): number {
  return Math.max(0, km) * getPtpkRate(km, mode) * Math.max(0.01, tonnes);
}

function buildTrainingRows(rng: () => number): TrainRow[] {
  const rows: TrainRow[] = [];
  let guard = 0;
  while (rows.length < 1500 && guard < 8000) {
    guard += 1;
    const i = Math.floor(rng() * TRAIN_PORTS.length);
    const j = Math.floor(rng() * TRAIN_PORTS.length);
    if (i === j) continue;
    const from = TRAIN_PORTS[i]!;
    const to = TRAIN_PORTS[j]!;
    const dist = haversineKm(from, to);
    const weight = 1 + rng() * 49;
    const code = Math.floor(rng() * 3);
    const mode = MODE_ORDER[code]!;
    const base = baselineCost(dist, weight, mode);
    const actual = base * (MARKET_OVERLAY_MIN + rng() * (MARKET_OVERLAY_MAX - MARKET_OVERLAY_MIN));
    rows.push({ x: [dist, weight, code], y: actual });
  }
  return rows;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function splitMse(leftY: readonly number[], rightY: readonly number[]): number {
  if (leftY.length < MIN_LEAF || rightY.length < MIN_LEAF) return Number.POSITIVE_INFINITY;
  const leftMean = mean(leftY);
  const rightMean = mean(rightY);
  let error = 0;
  for (const value of leftY) error += (value - leftMean) ** 2;
  for (const value of rightY) error += (value - rightMean) ** 2;
  return error;
}

function thresholdsFor(values: readonly number[]): number[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (let q = 1; q <= QUANTILES; q += 1) {
    const idx = Math.min(sorted.length - 1, Math.floor((sorted.length * q) / (QUANTILES + 1)));
    const value = sorted[idx]!;
    if (out.length === 0 || value !== out[out.length - 1]) out.push(value);
  }
  return out;
}

function grow(rows: readonly TrainRow[], depth: number, rng: () => number): TreeNode {
  const ys = rows.map((row) => row.y);
  if (depth >= MAX_DEPTH || rows.length < MIN_LEAF * 2) {
    return { kind: "leaf", value: mean(ys) };
  }

  let bestError = Number.POSITIVE_INFINITY;
  let bestFeature: 0 | 1 | 2 = 0;
  let bestThreshold = 0;

  const features: Array<0 | 1 | 2> = [0, 1, 2];
  for (let i = features.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = features[i]!;
    features[i] = features[j]!;
    features[j] = swap;
  }

  for (const feature of features) {
    const cuts = thresholdsFor(rows.map((row) => row.x[feature]));
    for (const threshold of cuts) {
      const leftY: number[] = [];
      const rightY: number[] = [];
      for (const row of rows) {
        if (row.x[feature] <= threshold) leftY.push(row.y);
        else rightY.push(row.y);
      }
      const error = splitMse(leftY, rightY);
      if (error < bestError) {
        bestError = error;
        bestFeature = feature;
        bestThreshold = threshold;
      }
    }
  }

  if (!Number.isFinite(bestError)) {
    return { kind: "leaf", value: mean(ys) };
  }

  const left = rows.filter((row) => row.x[bestFeature] <= bestThreshold);
  const right = rows.filter((row) => row.x[bestFeature] > bestThreshold);
  if (left.length < MIN_LEAF || right.length < MIN_LEAF) {
    return { kind: "leaf", value: mean(ys) };
  }

  return {
    kind: "split",
    feature: bestFeature,
    threshold: bestThreshold,
    left: grow(left, depth + 1, rng),
    right: grow(right, depth + 1, rng),
  };
}

function walk(node: TreeNode, x: FeatureRow): number {
  if (node.kind === "leaf") return node.value;
  return x[node.feature] <= node.threshold ? walk(node.left, x) : walk(node.right, x);
}

function bootstrap(rows: readonly TrainRow[], rng: () => number): TrainRow[] {
  const out: TrainRow[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    out.push(rows[Math.floor(rng() * rows.length)]!);
  }
  return out;
}

function trainForest(): TreeNode[] {
  const rng = mulberry32(42);
  const rows = buildTrainingRows(rng);
  const trees: TreeNode[] = [];
  for (let i = 0; i < N_TREES; i += 1) {
    trees.push(grow(bootstrap(rows, rng), 0, rng));
  }
  return trees;
}

const FOREST = trainForest();

function forestPredict(km: number, tonnes: number, mode: PtpkMode): number {
  const x: FeatureRow = [km, tonnes, modeCode(mode)];
  return mean(FOREST.map((tree) => walk(tree, x)));
}

export interface FreightModeQuote {
  readonly mode: PtpkMode;
  readonly ratePtpk: number;
  readonly baselineInr: number;
  readonly predictedInr: number;
}

export interface FreightQuote {
  readonly km: number;
  readonly tonnes: number;
  readonly quotes: readonly FreightModeQuote[];
}

export function quoteFreightCost(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  tonnes: number,
  modes: readonly PtpkMode[] = MODE_ORDER,
): FreightQuote {
  const km = Math.round(haversineKm(from, to) * 100) / 100;
  const weight = Math.max(0.01, tonnes);
  const quotes = modes.map((mode) => {
    const ratePtpk = getPtpkRate(km, mode);
    const baselineInr = Math.round(baselineCost(km, weight, mode));
    const raw = forestPredict(km, weight, mode);
    const lo = baselineInr * MARKET_OVERLAY_MIN;
    const hi = baselineInr * MARKET_OVERLAY_MAX;
    const predictedInr = Math.round(Math.min(hi, Math.max(lo, raw)));
    return { mode, ratePtpk, baselineInr, predictedInr };
  });
  return { km, tonnes: weight, quotes };
}
