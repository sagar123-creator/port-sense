/**
 * Bridge: Layer-1 IngestionBatchResult → Layer-2 IngestionResult contract.
 * Only VALID (and optionally SUSPICIOUS) rows become FactCandidates.
 */
import type { IngestionBatchResult, RecordCandidate } from "../domain/types.js";

/** Minimal shape matching @port-sense/layer2-canonical IngestionResult */
export interface Layer2IngestionResult {
  readonly batchId: string;
  readonly producedAt: string;
  readonly decision: "APPROVED" | "PARTIALLY_APPROVED" | "REJECTED" | "QUARANTINED";
  readonly provenance: {
    readonly rawArtifactId: string;
    readonly sourceUri?: string;
    readonly publisher?: string;
    readonly capturedAt: string;
    readonly contentHash?: string;
  };
  readonly entities: readonly {
    readonly candidateId: string;
    readonly entityType: "port" | "carrier";
    readonly proposedId: string;
    readonly displayName: string;
    readonly status: "VALID" | "INVALID" | "SUSPICIOUS";
    readonly confidence: number;
  }[];
  readonly facts: readonly {
    readonly candidateId: string;
    readonly factKind: "dwell_snapshot" | "fx" | "tariff" | "dwell_monthly" | "trt";
    readonly payload: Record<string, unknown>;
    readonly status: "VALID" | "INVALID" | "SUSPICIOUS";
    readonly confidence: number;
    readonly asOf: string;
  }[];
  readonly reviewNotes?: readonly string[];
}

export function toLayer2IngestionResult(
  batch: IngestionBatchResult,
): Layer2IngestionResult {
  const entities = [];
  const facts = [];

  for (const rec of batch.records) {
    if (rec.status === "DUPLICATE" || rec.status === "INVALID") continue;
    if (!rec.canonicalPortId) continue;

    entities.push({
      candidateId: `ent_${rec.recordId}`,
      entityType: "port" as const,
      proposedId: rec.canonicalPortId,
      displayName: String(rec.mapped.port_name ?? rec.canonicalPortId),
      status: rec.status === "SUSPICIOUS" ? ("SUSPICIOUS" as const) : ("VALID" as const),
      confidence: rec.portResolutionConfidence,
    });

    const waiting = rec.mapped.waiting_time as
      | { normalized?: number | null }
      | null
      | undefined;
    const days =
      waiting && typeof waiting.normalized === "number" ? waiting.normalized : null;
    if (days === null) continue;

    const asOf = String(rec.mapped.observation_date ?? batch.producedAt.slice(0, 10));
    facts.push({
      candidateId: `fact_${rec.recordId}`,
      factKind: "dwell_snapshot" as const,
      payload: {
        portId: rec.canonicalPortId,
        exportPortHours: days * 24,
        importPortHours: null,
        periodLabel: asOf,
        originalWaiting: waiting,
      },
      status: rec.status === "SUSPICIOUS" ? ("SUSPICIOUS" as const) : ("VALID" as const),
      confidence: 0.85,
      asOf,
    });
  }

  return {
    batchId: batch.batchId,
    producedAt: batch.producedAt,
    decision: batch.decision,
    provenance: {
      rawArtifactId: batch.artifact.artifactId,
      ...(batch.artifact.sourceUrl !== undefined
        ? { sourceUri: batch.artifact.sourceUrl }
        : {}),
      ...(batch.artifact.publisher !== undefined
        ? { publisher: batch.artifact.publisher }
        : {}),
      capturedAt: batch.artifact.capturedAt,
      contentHash: batch.artifact.contentHash,
    },
    entities,
    facts,
    reviewNotes: batch.reviewNotes,
  };
}

/** Deduplicate entity candidates by proposedId for cleaner L2 batches. */
export function summarizeBridge(batch: IngestionBatchResult): {
  validRows: number;
  factCandidates: number;
} {
  const result = toLayer2IngestionResult(batch);
  return {
    validRows: batch.records.filter((r: RecordCandidate) => r.status === "VALID").length,
    factCandidates: result.facts.length,
  };
}
