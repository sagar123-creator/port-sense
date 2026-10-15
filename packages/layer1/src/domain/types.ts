/** Layer 1 domain types — independent of Layer 2 storage. */

export type FileFormat = "csv" | "xlsx" | "json" | "unknown";

export type CanonicalField =
  | "port_name"
  | "observation_date"
  | "waiting_time"
  | "vessel_count"
  | "free_days"
  | "distance"
  | "currency"
  | "unknown";

export type ValidationStatus =
  | "VALID"
  | "INVALID"
  | "SUSPICIOUS"
  | "DUPLICATE"
  | "REJECTED_BATCH";

export interface RawArtifact {
  readonly artifactId: string;
  readonly fileName: string;
  readonly format: FileFormat;
  readonly contentHash: string;
  readonly capturedAt: string;
  readonly byteLength: number;
  /** Absolute or relative path where immutable raw copy is stored (if persisted). */
  readonly rawStoragePath?: string;
  readonly sourceUrl?: string;
  readonly publisher?: string;
}

export interface TabularDataset {
  readonly columns: readonly string[];
  readonly rows: readonly Record<string, string>[];
}

export interface FieldMapping {
  readonly sourceColumn: string;
  readonly canonicalField: CanonicalField;
  readonly confidence: number;
  readonly reason: string;
}

export interface ProvenanceRecord {
  readonly source_id: string;
  readonly source_name: string;
  readonly source_url: string | null;
  readonly retrieved_at: string;
  readonly published_at: string | null;
  readonly original_dataset: string;
  readonly transformation_version: string;
  readonly validation_status: ValidationStatus;
  readonly content_hash: string;
}

export interface NormalizedValue {
  readonly original: string;
  readonly originalUnit: string | null;
  readonly normalized: number | string | null;
  readonly normalizedUnit: string | null;
}

export interface RecordCandidate {
  readonly recordId: string;
  readonly rowIndex: number;
  readonly raw: Record<string, string>;
  readonly mapped: Record<string, NormalizedValue | string | null>;
  readonly canonicalPortId: string | null;
  readonly portResolutionConfidence: number;
  readonly status: ValidationStatus;
  readonly flags: readonly string[];
  readonly provenance: ProvenanceRecord;
}

export interface IngestionBatchResult {
  readonly batchId: string;
  readonly producedAt: string;
  readonly decision: "APPROVED" | "PARTIALLY_APPROVED" | "REJECTED" | "QUARANTINED";
  readonly artifact: RawArtifact;
  readonly columns: readonly string[];
  readonly mappings: readonly FieldMapping[];
  readonly records: readonly RecordCandidate[];
  readonly stats: {
    readonly inputRows: number;
    readonly accepted: number;
    readonly invalid: number;
    readonly suspicious: number;
    readonly duplicates: number;
  };
  readonly errors: readonly string[];
  readonly reviewNotes: readonly string[];
}

export class IngestionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "IngestionError";
    this.code = code;
  }
}

export const TRANSFORMATION_VERSION = "layer1-ingest-v1.0.0";
