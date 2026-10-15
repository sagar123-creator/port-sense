/**
 * DWM warehouse domain types.
 *
 * Two hard rules encoded in the types themselves:
 *  - `DataMode` is attached to every dataset, fact row and analytical result.
 *    Real (published/imported-verified) and synthetic (illustrative demo) records
 *    must never mix inside one query — the OLAP engine enforces one mode per query.
 *  - Missing measurements are `null`, never zero. Zero means "measured zero".
 */

export type DataMode = "real" | "synthetic";

/** Supported fact datasets (warehouse cube names). */
export type DatasetId =
  | "port_traffic" //  cargo tonnes per port × month
  | "port_dwell" //    dwell hours per port × month (published)
  | "port_trt" //      turnaround time hours per port × fiscal year (PIB/MoPSW)
  | "vessel_queue"; //  at-berth / at-anchory counts per port × day (IPA published)

export const DATASET_IDS: readonly DatasetId[] = [
  "port_traffic",
  "port_dwell",
  "port_trt",
  "vessel_queue",
];

export function isDatasetId(value: string): value is DatasetId {
  return (DATASET_IDS as readonly string[]).includes(value);
}

/** Dimension levels of the date hierarchy (roll-up order, fine → coarse). */
export const DATE_HIERARCHY = ["day", "month", "quarter", "fiscal_year", "year"] as const;
export type DateLevel = (typeof DATE_HIERARCHY)[number];

/** Dimension levels of the port hierarchy (roll-up order, fine → coarse). */
export const PORT_HIERARCHY = ["port", "coast", "national"] as const;
export type PortLevel = (typeof PORT_HIERARCHY)[number];

export function isDateLevel(value: string): value is DateLevel {
  return (DATE_HIERARCHY as readonly string[]).includes(value);
}

export function isPortLevel(value: string): value is PortLevel {
  return (PORT_HIERARCHY as readonly string[]).includes(value);
}

export type Aggregation = "sum" | "avg" | "min" | "max" | "count";

export const AGGREGATIONS: readonly Aggregation[] = ["sum", "avg", "min", "max", "count"];

export function isAggregation(value: string): value is Aggregation {
  return (AGGREGATIONS as readonly string[]).includes(value);
}

/** A dimension filter (slice = one, dice = several). */
export interface DimensionFilter {
  /** Which dimension to filter on. */
  readonly dimension: "date" | "port" | "cargo" | "source";
  /**
   * Values to keep. For `date` filters the value is a date_key (YYYY-MM-DD),
   * a month_key (YYYY-MM), a quarter (YYYY-Qn) or a fiscal year (FY2023-24)
   * depending on `level`.
   */
  readonly values: readonly string[];
  /** Hierarchy level the filter values are expressed at (date/port only). */
  readonly level?: DateLevel | PortLevel;
}

/** OLAP query over one fact dataset at exactly one DataMode. */
export interface OlapQuery {
  readonly dataset: DatasetId;
  readonly mode: DataMode;
  /** Row dimension: "date" (hierarchy) or "port" (hierarchy) or "cargo"/"source" (flat). */
  readonly rows: { readonly dimension: "date" | "port" | "cargo" | "source"; readonly level?: DateLevel | PortLevel };
  /** Optional column dimension for pivot (cross-tab). */
  readonly columns?: { readonly dimension: "date" | "port" | "cargo" | "source"; readonly level?: DateLevel | PortLevel };
  readonly measures: readonly { readonly field: string; readonly aggregation: Aggregation }[];
  readonly filters?: readonly DimensionFilter[];
  /** Guard rail: max result rows (prevents runaway exports). */
  readonly limit?: number;
}

export interface OlapCell {
  readonly rowLabel: string;
  readonly columnLabel?: string;
  readonly values: Readonly<Record<string, number | null>>;
}

export interface OlapResult {
  readonly dataset: DatasetId;
  readonly mode: DataMode;
  readonly grain: string;
  readonly measures: readonly string[];
  readonly rows: readonly OlapCell[];
  readonly rowCount: number;
  readonly truncated: boolean;
  readonly unitNotes: Readonly<Record<string, string>>;
  readonly sourceIds: readonly string[];
  readonly generatedAt: string;
}

/** One transformed record staged for load (post-validation). */
export interface StagedRecord {
  readonly dataset: DatasetId;
  readonly naturalKey: string;
  readonly dateKey: string; // anchor date_key in dim_date (month facts → 1st of month)
  readonly portId: string; // canonical layer-2 style id (INNSA…) or IMPORTED:<slug>
  readonly cargoCategory: string;
  readonly sourceId: string;
  readonly measures: Readonly<Record<string, number | null>>;
  readonly originalUnit?: string;
  readonly originalValue?: number;
  /** Dwell fact only: measurement basis label carried alongside numeric measures. */
  readonly dwellBasis?: string;
  /** Vessel-queue fact only: IPA remark text (non-numeric payload). */
  readonly remark?: string | null;
}

export interface RejectedRecord {
  readonly rowNumber: number;
  readonly reason: string;
  readonly raw: string;
}

export interface EtlBatchSummary {
  readonly batchId: string;
  readonly dataset: DatasetId;
  readonly mode: DataMode;
  readonly sourceId: string;
  readonly totalRecords: number;
  readonly inserted: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly rejected: number;
  readonly rejectedRecords: readonly RejectedRecord[];
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly status: "completed" | "completed_with_rejects" | "failed";
  readonly notes: readonly string[];
}

export interface ImportBatchRow {
  readonly batchId: string;
  readonly dataset: string;
  readonly mode: string;
  readonly sourceId: string;
  readonly totalRecords: number;
  readonly inserted: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly rejected: number;
  readonly status: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly notes: string;
}

/** K-means clustering result over ports. */
export interface ClusterResult {
  readonly mode: DataMode;
  readonly features: readonly string[];
  readonly k: number;
  readonly seed: number;
  readonly observations: readonly {
    readonly portId: string;
    readonly portName: string;
    readonly values: readonly number[];
    readonly cluster: number;
  }[];
  readonly clusters: readonly {
    readonly cluster: number;
    readonly memberPortIds: readonly string[];
    readonly centroids: readonly number[]; // original units (de-standardised)
  }[];
  readonly silhouette: number | null;
  readonly excludedPorts: readonly { readonly portId: string; readonly reason: string }[];
  readonly limitations: readonly string[];
  readonly generatedAt: string;
}

/** An observation flagged by anomaly detection. */
export interface AnomalyFlag {
  readonly dataset: DatasetId;
  readonly portId: string;
  readonly portName: string;
  readonly periodLabel: string;
  readonly dateKey: string;
  readonly field: string;
  readonly value: number;
  readonly baseline: number;
  readonly score: number; // |z| (modified z-score using MAD)
  readonly kind: "performance" | "data_quality";
  readonly sourceId: string;
  readonly explanation: string;
}

export interface AnomalyResult {
  readonly mode: DataMode;
  readonly method: string;
  readonly threshold: number;
  readonly seriesExamined: number;
  readonly pointsExamined: number;
  readonly flags: readonly AnomalyFlag[];
  readonly limitations: readonly string[];
  readonly generatedAt: string;
}

/** Honest predictive-analysis report — infrastructure with evaluated model, or documented refusal. */
export interface PredictionReport {
  readonly status: "model_trained" | "insufficient_data";
  readonly mode: DataMode;
  readonly target: string;
  readonly dataset: DatasetId | null;
  readonly algorithm: string;
  readonly features: readonly string[];
  readonly trainRows: number;
  readonly testRows: number;
  readonly split: string;
  readonly metrics: Readonly<Record<string, number>> | null;
  readonly baselineMetrics: Readonly<Record<string, number>> | null;
  readonly beatsBaseline: boolean | null;
  readonly limitations: readonly string[];
  readonly generatedAt: string;
}
