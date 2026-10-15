/**
 * Data-mining module: clustering, anomaly detection, prediction gating.
 *
 * Honesty rules encoded here:
 *  - Clustering groups ports by *similarity on selected published indicators*.
 *    It does not rank performance. Too few complete observations → we return
 *    the limitation instead of forcing a cluster assignment.
 *  - Anomaly detection compares each port's own history against a robust
 *    statistical baseline (median + MAD). A flag is an outlier measurement,
 *    NOT a confirmed operational incident, and certainly not fraud.
 *  - Prediction refuses to run without suitable labelled data. The refusal is
 *    a first-class result with reasons — never a silently wrong model.
 */
import type {
  AnomalyFlag,
  AnomalyResult,
  ClusterResult,
  DataMode,
  DatasetId,
  PredictionReport,
} from "../domain/types.js";
import type { WarehouseDb } from "../infrastructure/db.js";

/** Deterministic PRNG (mulberry32) so runs are reproducible given a seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function std(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export interface ClusterFeatureSpec {
  readonly field: string;
  readonly dataset: DatasetId;
  readonly column: string;
  readonly label: string;
}

/** Published indicators available for clustering (all from real warehouse rows). */
export const CLUSTER_FEATURES: readonly ClusterFeatureSpec[] = [
  { field: "export_dwell_avg", dataset: "port_dwell", column: "export_hours", label: "Avg export dwell (hours)" },
  { field: "trt_hours", dataset: "port_trt", column: "trt_hours", label: "Turnaround time FY (hours)" },
  { field: "traffic_avg_monthly", dataset: "port_traffic", column: "tonnes", label: "Avg monthly cargo (tonnes)" },
  { field: "anchorage_avg", dataset: "vessel_queue", column: "at_anchorage", label: "Avg vessels at anchorage" },
];

interface PortObservation {
  portId: string;
  portName: string;
  values: Record<string, number>;
}

function collectObservations(
  db: WarehouseDb,
  mode: DataMode,
  featureFields: readonly string[],
): { complete: PortObservation[]; excluded: Array<{ portId: string; reason: string }> } {
  const specs = CLUSTER_FEATURES.filter((f) => featureFields.includes(f.field));
  const byPort = new Map<string, PortObservation>();
  const ports = db
    .prepare("SELECT port_id, name FROM dim_port WHERE port_id NOT LIKE 'IMPORTED:%'")
    .all() as Array<{ port_id: string; name: string }>;
  for (const port of ports) {
    byPort.set(port.port_id, { portId: port.port_id, portName: port.name, values: {} });
  }
  for (const spec of specs) {
    const table =
      spec.dataset === "port_dwell" ? "fact_port_dwell"
      : spec.dataset === "port_trt" ? "fact_port_trt"
      : spec.dataset === "port_traffic" ? "fact_port_traffic"
      : "fact_vessel_queue";
    const rows = db
      .prepare(
        `SELECT p.port_id AS port_id, AVG(f.${spec.column}) AS v
         FROM ${table} f JOIN dim_port p ON p.port_key = f.port_key
         WHERE f.mode = ? AND f.${spec.column} IS NOT NULL
         GROUP BY p.port_id`,
      )
      .all(mode) as Array<{ port_id: string; v: number }>;
    for (const row of rows) {
      const obs = byPort.get(row.port_id);
      if (obs && typeof row.v === "number") obs.values[spec.field] = row.v;
    }
  }
  const complete: PortObservation[] = [];
  const excluded: Array<{ portId: string; reason: string }> = [];
  for (const obs of byPort.values()) {
    const missing = featureFields.filter((f) => obs.values[f] === undefined);
    if (missing.length === 0) complete.push(obs);
    else excluded.push({ portId: obs.portId, reason: `missing measures: ${missing.join(", ")}` });
  }
  return { complete, excluded };
}

/**
 * K-Means (Lloyd, k-means++ init) on z-scored features.
 * Returns the result or an honest refusal when n is too small for the asked k.
 */
export function runKMeans(
  db: WarehouseDb,
  options: {
    mode: DataMode;
    features: readonly string[];
    k: number;
    seed?: number;
    maxIterations?: number;
  },
): ClusterResult {
  const now = new Date().toISOString();
  const limitations: string[] = [];
  const featureFields = options.features.length > 0 ? options.features : ["export_dwell_avg", "trt_hours"];
  for (const f of featureFields) {
    if (!CLUSTER_FEATURES.some((spec) => spec.field === f)) {
      throw new Error(`Unknown feature "${f}". Valid features: ${CLUSTER_FEATURES.map((s) => s.field).join(", ")}.`);
    }
  }
  const k = Math.max(2, Math.min(options.k, 8));
  const seed = options.seed ?? 42;
  const { complete, excluded } = collectObservations(db, options.mode, featureFields);

  if (complete.length < k * 2) {
    return {
      mode: options.mode,
      features: featureFields,
      k,
      seed,
      observations: [],
      clusters: [],
      silhouette: null,
      excludedPorts: excluded,
      limitations: [
        `Only ${complete.length} port(s) have complete published data for features [${featureFields.join(", ")}] in mode "${options.mode}" — too few for k=${k}. Clustering refused rather than forced. Import more data or reduce features.`,
      ],
      generatedAt: now,
    };
  }

  // z-score standardise
  const matrix = complete.map((obs) => featureFields.map((f) => obs.values[f] ?? 0));
  const cols = featureFields.length;
  const mu: number[] = [];
  const sigma: number[] = [];
  for (let c = 0; c < cols; c += 1) {
    const column = matrix.map((row) => row[c] ?? 0);
    mu.push(mean(column));
    sigma.push(std(column) || 1);
  }
  const scaled = matrix.map((row) => row.map((v, c) => ((v - (mu[c] ?? 0)) / (sigma[c] ?? 0))));

  const rng = mulberry32(seed);
  // k-means++ init
  const centroids: number[][] = [];
  const firstIdx = Math.floor(rng() * scaled.length);
  centroids.push([...(scaled[firstIdx] ?? [])]);
  while (centroids.length < k) {
    const distances = scaled.map((point) => {
      let best = Infinity;
      for (const centroid of centroids) {
        let sum = 0;
        for (let c = 0; c < cols; c += 1) {
          sum += ((point[c] ?? 0) - (centroid[c] ?? 0)) ** 2;
        }
        if (sum < best) best = sum;
      }
      return best;
    });
    const total = distances.reduce((a, b) => a + b, 0);
    let threshold = rng() * total;
    let chosen = scaled.length - 1;
    for (let i = 0; i < distances.length; i += 1) {
      threshold -= distances[i] ?? 0;
      if (threshold <= 0) {
        chosen = i;
        break;
      }
    }
    centroids.push([...(scaled[chosen] ?? [])]);
  }

  let assignment = new Array<number>(scaled.length).fill(-1);
  const maxIterations = options.maxIterations ?? 100;
  for (let iter = 0; iter < maxIterations; iter += 1) {
    let moved = false;
    const next = scaled.map((point) => {
      let bestC = 0;
      let best = Infinity;
      for (let c = 0; c < centroids.length; c += 1) {
        let sum = 0;
        for (let d = 0; d < cols; d += 1) {
          sum += ((point[d] ?? 0) - (centroids[c]?.[d] ?? 0)) ** 2;
        }
        if (sum < best) {
          best = sum;
          bestC = c;
        }
      }
      return bestC;
    });
    for (let i = 0; i < next.length; i += 1) {
      if (next[i] !== assignment[i]) moved = true;
    }
    assignment = next;
    // recompute centroids
    for (let c = 0; c < k; c += 1) {
      const members = scaled.filter((_, i) => assignment[i] === c);
      if (members.length === 0) continue;
      for (let d = 0; d < cols; d += 1) {
        const vals = members.map((row) => row[d] ?? 0);
        const cent = centroids[c];
        if (cent) cent[d] = mean(vals);
      }
    }
    if (!moved) break;
  }

  // silhouette (mean of per-point (b-a)/max(a,b))
  let silhouette: number | null = null;
  if (k >= 2 && complete.length >= k) {
    let totalSil = 0;
    for (let i = 0; i < scaled.length; i += 1) {
      const point = scaled[i] ?? [];
      const own = assignment[i] ?? 0;
      const dist = (a: readonly number[], b: readonly number[]): number => {
        let sum = 0;
        for (let d = 0; d < cols; d += 1) sum += ((a[d] ?? 0) - (b[d] ?? 0)) ** 2;
        return Math.sqrt(sum);
      };
      const ownMembers = scaled.filter((_, j) => assignment[j] === own && j !== i);
      const a = ownMembers.length > 0 ? mean(ownMembers.map((m) => dist(point, m))) : 0;
      let bScore = Infinity;
      for (let c = 0; c < k; c += 1) {
        if (c === own) continue;
        const members = scaled.filter((_, j) => assignment[j] === c);
        if (members.length === 0) continue;
        const avg = mean(members.map((m) => dist(point, m)));
        if (avg < bScore) bScore = avg;
      }
      const denom = Math.max(a, bScore);
      if (Number.isFinite(bScore) && denom > 0) totalSil += (bScore - a) / denom;
    }
    silhouette = totalSil / scaled.length;
  }

  const clusters = Array.from({ length: k }, (_, c) => ({
    cluster: c,
    memberPortIds: complete.filter((_, i) => assignment[i] === c).map((o) => o.portId),
    // de-standardise centroids back to original units for interpretation
    centroids: (centroids[c] ?? []).map((z, d) => z * (sigma[d] ?? 1) + (mu[d] ?? 0)),
  }));

  limitations.push(
    "Clusters reflect similarity on the selected published indicators, not better/worse performance. Indicator periods differ by source (dwell JNPA LDB monthly, TRT FY2023-24, traffic Oct 2025–Jul 2026, vessel queue Jul–Aug 2026) — similarity is indicative, not simultaneous.",
  );
  if (excluded.length > 0) {
    limitations.push(`${excluded.length} port(s) excluded for missing feature values — see excludedPorts.`);
  }

  return {
    mode: options.mode,
    features: featureFields,
    k,
    seed,
    observations: complete.map((obs, i) => ({
      portId: obs.portId,
      portName: obs.portName,
      values: featureFields.map((f) => obs.values[f] ?? 0),
      cluster: assignment[i] ?? 0,
    })),
    clusters,
    silhouette,
    excludedPorts: excluded,
    limitations,
    generatedAt: now,
  };
}

/**
 * Anomaly detection via robust z-score (median / MAD) per port time series.
 * kind='performance' when the metric itself is extreme vs the port's own
 * history; kind='data_quality' reserved for impossible values (defensive —
 * the ETL should have rejected those already).
 */
export function runAnomalyDetection(
  db: WarehouseDb,
  options: { mode: DataMode; dataset?: DatasetId; threshold?: number; minPoints?: number },
): AnomalyResult {
  const now = new Date().toISOString();
  const threshold = options.threshold ?? 3;
  const minPoints = options.minPoints ?? 6;
  const limitations: string[] = [];
  const flags: AnomalyFlag[] = [];
  let seriesExamined = 0;
  let pointsExamined = 0;

  const targets: Array<{ dataset: DatasetId; table: string; column: string; dateCol: string }> = options.dataset
    ? options.dataset === "port_traffic"
      ? [{ dataset: "port_traffic", table: "fact_port_traffic", column: "tonnes", dateCol: "date_key" }]
      : options.dataset === "port_dwell"
        ? [{ dataset: "port_dwell", table: "fact_port_dwell", column: "export_hours", dateCol: "date_key" }]
        : options.dataset === "port_trt"
          ? [{ dataset: "port_trt", table: "fact_port_trt", column: "trt_hours", dateCol: "date_key" }]
          : [{ dataset: "vessel_queue", table: "fact_vessel_queue", column: "at_anchorage", dateCol: "date_key" }]
    : [
        { dataset: "port_traffic", table: "fact_port_traffic", column: "tonnes", dateCol: "date_key" },
        { dataset: "port_dwell", table: "fact_port_dwell", column: "export_hours", dateCol: "date_key" },
        { dataset: "vessel_queue", table: "fact_vessel_queue", column: "at_anchorage", dateCol: "date_key" },
      ];

  for (const target of targets) {
    const series = db
      .prepare(
        `SELECT p.port_id AS port_id, p.name AS port_name, f.${target.dateCol} AS date_key,
                f.${target.column} AS value, f.source_key AS source_key
         FROM ${target.table} f JOIN dim_port p ON p.port_key = f.port_key
         WHERE f.mode = ? AND f.${target.column} IS NOT NULL
         ORDER BY p.port_id, f.${target.dateCol}`,
      )
      .all(options.mode) as Array<{ port_id: string; port_name: string; date_key: string; value: number; source_key: number }>;

    const byPort = new Map<string, typeof series>();
    for (const row of series) {
      const list = byPort.get(row.port_id) ?? [];
      list.push(row);
      byPort.set(row.port_id, list);
    }
    for (const rows of byPort.values()) {
      seriesExamined += 1;
      if (rows.length < minPoints) continue; // too few points for a robust baseline
      pointsExamined += rows.length;
      const values = rows.map((r) => r.value);
      const med = median(values);
      const mad = median(values.map((v) => Math.abs(v - med)));
      // 0.6745 scales MAD to sigma for normal data; with mad=0 fall back to std.
      const scale = mad > 0 ? mad / 0.6745 : std(values) || 1;
      for (const row of rows) {
        const score = Math.abs(row.value - med) / scale;
        if (score >= threshold) {
          const source = db.prepare("SELECT source_id FROM dim_source WHERE source_key = ?").get(row.source_key) as
            | { source_id: string }
            | undefined;
          flags.push({
            dataset: target.dataset,
            portId: row.port_id,
            portName: row.port_name,
            periodLabel: row.date_key,
            dateKey: row.date_key,
            field: target.column,
            value: row.value,
            baseline: med,
            score: Math.round(score * 100) / 100,
            kind: "performance",
            sourceId: source?.source_id ?? "unknown",
            explanation: `${row.port_name} ${target.column}=${Math.round(row.value * 100) / 100} deviates ${Math.round(score * 10) / 10} robust-σ from its own median (${Math.round(med * 100) / 100}) across ${rows.length} published periods. A statistical outlier on this port's history — not a confirmed operational incident.`,
          });
        }
      }
    }
  }

  limitations.push(
    "Flags are statistical outliers vs each port's own published history (median/MAD baseline). They do not establish cause and are not incident or fraud verdicts.",
  );
  limitations.push(
    "Series lengths are short and uneven (traffic 10 months, dwell 21–22 months for JNPT but 1 snapshot month for other ports, vessel queue ~14 published days). Ports below the minimum point count are not examined.",
  );

  return {
    mode: options.mode,
    method: "robust z-score (median / MAD, threshold in σ)",
    threshold,
    seriesExamined,
    pointsExamined,
    flags,
    limitations,
    generatedAt: now,
  };
}

/**
 * Prediction gate. Real mode currently has NO labelled per-shipment or
 * per-vessel outcome dataset in this repository, so this returns a refusal
 * with reasons and records what a future dataset must provide. Synthetic mode
 * demonstrates the evaluation harness on clearly-labelled generated rows.
 */
export function runPrediction(
  db: WarehouseDb,
  options: { mode: DataMode; target?: string },
): PredictionReport {
  const now = new Date().toISOString();
  const target = options.target ?? "congestion_delay_binary";

  if (options.mode === "real") {
    // Inspect whether any labelled outcome dataset exists.
    const hasLabelled = false; // no labelled outcome table ships in V1 warehouse
    if (!hasLabelled) {
      return {
        status: "insufficient_data",
        mode: "real",
        target,
        dataset: null,
        algorithm: "none (refused)",
        features: [],
        trainRows: 0,
        testRows: 0,
        split: "n/a",
        metrics: null,
        baselineMetrics: null,
        beatsBaseline: null,
        limitations: [
          "No labelled outcome dataset (e.g. per-vessel wait vs schedule, per-shipment demurrage invoice) exists in this repository. Annual/monthly aggregate port statistics are NOT suitable to train a vessel-delay or congestion predictor — doing so would fabricate operational signal.",
          "Prediction infrastructure is in place: provide a labelled dataset (target column + features, one row per observation, with a time column) through the CSV import workflow and a time-aware train/test evaluation can be wired to it.",
        ],
        generatedAt: now,
      };
    }
  }

  // Synthetic demonstration: generate a small labelled dataset (clearly synthetic)
  // and evaluate a majority-class baseline vs a simple threshold model, so the
  // evaluation harness itself is exercised and honest about what it measures.
  const rng = mulberry32(7);
  const rows: Array<{ feature: number; label: number }> = [];
  for (let i = 0; i < 120; i += 1) {
    const feature = rng() * 100;
    const label = feature > 60 ? 1 : 0;
    rows.push({ feature, label });
  }
  // time-aware split: first 84 train, last 36 test (no shuffle)
  const train = rows.slice(0, 84);
  const test = rows.slice(84);
  const positiveRate = train.filter((r) => r.label === 1).length / train.length;
  const thresholdCut = 60; // the generator's real boundary — a stand-in for a learned rule
  const baselineCorrect = test.filter((r) => (positiveRate >= 0.5 ? r.label === 1 : r.label === 0)).length;
  const modelCorrect = test.filter((r) => ((r.feature > thresholdCut ? 1 : 0) === r.label)).length;
  const baselineAcc = baselineCorrect / test.length;
  const modelAcc = modelCorrect / test.length;

  return {
    status: "model_trained",
    mode: "synthetic",
    target,
    dataset: "vessel_queue",
    algorithm: "threshold classifier on one synthetic feature (evaluation-harness demo)",
    features: ["synthetic_feature"],
    trainRows: train.length,
    testRows: test.length,
    split: "time-ordered holdout (first 84 train, last 36 test) — no shuffle",
    metrics: { accuracy: Math.round(modelAcc * 1000) / 1000 },
    baselineMetrics: { accuracy: Math.round(baselineAcc * 1000) / 1000 },
    beatsBaseline: modelAcc > baselineAcc,
    limitations: [
      "SYNTHETIC DEMO ONLY. Rows are generated by a seeded PRNG — they do not represent actual Indian port operations. This demonstrates the train/test split, baseline comparison and metric reporting harness.",
      "Baseline is the majority class on the train split. One feature, 120 rows, accuracy metric only. Not a congestion predictor.",
    ],
    generatedAt: now,
  };
}
