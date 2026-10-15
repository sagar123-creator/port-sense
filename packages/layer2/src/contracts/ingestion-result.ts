/**
 * Frozen contract: Layer 1 → Layer 2.
 * L2 accepts only APPROVED / PARTIALLY_APPROVED batches.
 * Parsing & schema detection stay in L1; L2 never re-parses raw bytes.
 */

export type IngestionDecision =
  | "APPROVED"
  | "PARTIALLY_APPROVED"
  | "REJECTED"
  | "QUARANTINED";

export type CandidateStatus = "VALID" | "INVALID" | "SUSPICIOUS";

export interface IngestionProvenance {
  readonly rawArtifactId: string;
  readonly sourceUri?: string;
  readonly publisher?: string;
  readonly capturedAt: string;
  readonly contentHash?: string;
}

export interface EntityCandidate {
  readonly candidateId: string;
  readonly entityType: "port" | "carrier";
  readonly proposedId: string;
  readonly displayName: string;
  readonly aliases?: readonly string[];
  readonly status: CandidateStatus;
  readonly confidence: number;
}

export interface FactCandidate {
  readonly candidateId: string;
  readonly factKind:
    | "tariff"
    | "dwell_monthly"
    | "dwell_snapshot"
    | "trt"
    | "fx";
  /** Opaque payload already unit-normalized by L1. */
  readonly payload: Record<string, unknown>;
  readonly status: CandidateStatus;
  readonly confidence: number;
  readonly asOf: string;
  readonly effectiveFrom?: string;
}

export interface IngestionResult {
  readonly batchId: string;
  readonly producedAt: string;
  readonly decision: IngestionDecision;
  readonly provenance: IngestionProvenance;
  readonly entities: readonly EntityCandidate[];
  readonly facts: readonly FactCandidate[];
  readonly reviewNotes?: readonly string[];
}

export interface AcceptanceOutcome {
  readonly batchId: string;
  readonly acceptedFactIds: readonly string[];
  readonly skippedCandidateIds: readonly string[];
  readonly rejectedReason?: string;
}
