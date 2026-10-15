import type {
  AcceptanceOutcome,
  FactCandidate,
  IngestionResult,
} from "../contracts/ingestion-result.js";
import type { CanonicalFact } from "../domain/facts.js";
import { AcceptanceRejectedError } from "../domain/errors.js";
import type { JsonCanonicalStore } from "../infrastructure/json-store.js";

/**
 * Gate: only APPROVED / PARTIALLY_APPROVED L1 batches may mutate the store.
 * Payload → CanonicalFact mapping is intentionally narrow until L1 ships.
 */
export class AcceptanceService {
  constructor(private readonly store: JsonCanonicalStore) {}

  accept(result: IngestionResult): AcceptanceOutcome {
    if (
      result.decision !== "APPROVED" &&
      result.decision !== "PARTIALLY_APPROVED"
    ) {
      throw new AcceptanceRejectedError(
        `Batch ${result.batchId} decision=${result.decision} — not acceptable`,
        result.batchId,
      );
    }

    const acceptedFactIds: string[] = [];
    const skippedCandidateIds: string[] = [];
    const toAppend: CanonicalFact[] = [];

    for (const candidate of result.facts) {
      if (candidate.status === "INVALID") {
        skippedCandidateIds.push(candidate.candidateId);
        continue;
      }
      if (
        result.decision === "PARTIALLY_APPROVED" &&
        candidate.status === "SUSPICIOUS"
      ) {
        skippedCandidateIds.push(candidate.candidateId);
        continue;
      }

      const mapped = tryMapCandidate(candidate, result.batchId);
      if (!mapped) {
        skippedCandidateIds.push(candidate.candidateId);
        continue;
      }
      toAppend.push(mapped);
      acceptedFactIds.push(mapped.factId);
    }

    if (toAppend.length > 0) {
      this.store.appendFacts(toAppend);
    }

    return {
      batchId: result.batchId,
      acceptedFactIds,
      skippedCandidateIds,
    };
  }
}

function tryMapCandidate(
  candidate: FactCandidate,
  batchId: string,
): CanonicalFact | null {
  const p = candidate.payload;
  const provenance = {
    sourcePath: `ingestion/${batchId}/${candidate.candidateId}`,
    publisher: "layer1-ingestion",
    proofFiles: [] as string[],
    fetchedAt: candidate.asOf,
    verificationStatus: "PROVISIONAL" as const,
    note: "Accepted via IngestionResult — pending human verification upgrade",
  };

  if (candidate.factKind === "fx") {
    const rate = Number(p.rate);
    if (!Number.isFinite(rate)) return null;
    return {
      factId: `fx:USDINR:${candidate.asOf}:ingest:${candidate.candidateId}`,
      kind: "fx",
      version: 1,
      asOf: candidate.asOf,
      trustTier: "PROVISIONAL",
      provenance,
      pair: "USDINR",
      rate,
      quoteCurrency: "INR",
      baseCurrency: "USD",
    };
  }

  if (candidate.factKind === "dwell_snapshot") {
    const portId = String(p.portId ?? "");
    const exportPortHours = Number(p.exportPortHours);
    if (!portId || !Number.isFinite(exportPortHours)) return null;
    const importPortHours =
      p.importPortHours === null || p.importPortHours === undefined
        ? null
        : Number(p.importPortHours);
    return {
      factId: `dwell_snapshot:${portId}:${candidate.asOf}:ingest:${candidate.candidateId}`,
      kind: "dwell_snapshot",
      version: 1,
      asOf: candidate.asOf,
      trustTier: "PROVISIONAL",
      provenance,
      portId: portId as import("../domain/ids.js").PortId,
      periodLabel: String(p.periodLabel ?? candidate.asOf),
      importPortHours: Number.isFinite(importPortHours as number)
        ? (importPortHours as number)
        : null,
      exportPortHours,
      metricSource: "OTHER",
    };
  }

  return null;
}
