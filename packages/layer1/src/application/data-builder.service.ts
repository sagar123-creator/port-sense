import { createHash } from "node:crypto";
import type {
  IngestionBatchResult,
  RecordCandidate,
  NormalizedValue,
} from "../domain/types.js";
import { IngestionError, TRANSFORMATION_VERSION } from "../domain/types.js";
import {
  IngestionEngine,
  type IngestOptions,
} from "../engines/ingestion.engine.js";
import { SchemaMappingEngine } from "../engines/schema-mapping.engine.js";
import { EntityResolutionEngine } from "../engines/entity-resolution.engine.js";
import { UnitNormalizationEngine } from "../engines/unit-normalization.engine.js";
import { ValidationEngine } from "../engines/validation.engine.js";
import { ProvenanceEngine } from "../engines/provenance.engine.js";

export interface BuildFromFileOptions extends IngestOptions {
  readonly batchId?: string;
}

/**
 * Data Builder — orchestrates all Layer-1 engines into one batch result.
 */
export class DataBuilderService {
  private readonly ingest = new IngestionEngine();
  private readonly mapper = new SchemaMappingEngine();
  private readonly entities = new EntityResolutionEngine();
  private readonly units = new UnitNormalizationEngine();
  private readonly validator = new ValidationEngine();
  private readonly provenance = new ProvenanceEngine();

  buildFromFile(filePath: string, opts: BuildFromFileOptions = {}): IngestionBatchResult {
    try {
      const { artifact, dataset } = this.ingest.ingestFile(filePath, opts);
      return this.buildFromDataset(artifact, dataset, opts.batchId);
    } catch (e) {
      if (e instanceof IngestionError) {
        return this.rejectedBatch(filePath, e);
      }
      throw e;
    }
  }

  buildFromBytes(
    fileName: string,
    bytes: Buffer,
    opts: BuildFromFileOptions = {},
  ): IngestionBatchResult {
    try {
      const { artifact, dataset } = this.ingest.ingestBytes(fileName, bytes, opts);
      return this.buildFromDataset(artifact, dataset, opts.batchId);
    } catch (e) {
      if (e instanceof IngestionError) {
        return this.rejectedBatch(fileName, e);
      }
      throw e;
    }
  }

  private buildFromDataset(
    artifact: import("../domain/types.js").RawArtifact,
    dataset: import("../domain/types.js").TabularDataset,
    batchId?: string,
  ): IngestionBatchResult {
    const { mappings, rows, missingRequired } = this.mapper.mapDataset(dataset);
    const reviewNotes: string[] = [];
    const errors: string[] = [];

    if (missingRequired.length > 0) {
      errors.push(
        `Missing required canonical columns: ${missingRequired.join(", ")}`,
      );
      return {
        batchId: batchId ?? `batch_${artifact.artifactId}`,
        producedAt: new Date().toISOString(),
        decision: "REJECTED",
        artifact,
        columns: dataset.columns,
        mappings,
        records: [],
        stats: {
          inputRows: dataset.rows.length,
          accepted: 0,
          invalid: dataset.rows.length,
          suspicious: 0,
          duplicates: 0,
        },
        errors,
        reviewNotes: [
          "Schema mapping could not find port_name / observation_date / waiting_time",
        ],
      };
    }

    const seenFingerprints = new Set<string>();
    const records: RecordCandidate[] = [];
    let accepted = 0;
    let invalid = 0;
    let suspicious = 0;
    let duplicates = 0;

    for (const row of rows) {
      const portRaw = row.values.port_name ?? "";
      const resolution = this.entities.resolvePort(portRaw);
      const waiting = row.values.waiting_time
        ? this.units.normalizeWaitingTime(row.values.waiting_time)
        : null;
      const freeDays = row.values.free_days
        ? this.units.normalizeFreeDays(row.values.free_days)
        : null;
      const distance = row.values.distance
        ? this.units.normalizeDistance(row.values.distance)
        : null;

      const mapped: Record<string, NormalizedValue | string | null> = {
        port_name: portRaw,
        observation_date: row.values.observation_date ?? null,
        waiting_time: waiting,
        free_days: freeDays,
        distance,
        vessel_count: row.values.vessel_count ?? null,
        currency: row.values.currency ?? null,
        canonical_port_id: resolution.canonicalPortId,
      };

      const outcome = this.validator.validate({
        waitingTime: waiting,
        freeDays,
        vesselCount: row.values.vessel_count ?? null,
        observationDate: row.values.observation_date ?? null,
        portResolved: resolution.canonicalPortId !== null,
        distance,
      });

      const fp = fingerprint(
        resolution.canonicalPortId,
        row.values.observation_date ?? "",
        waiting?.normalized,
      );
      let status = outcome.status;
      const flags = [...outcome.flags];
      if (status === "VALID" || status === "SUSPICIOUS") {
        if (seenFingerprints.has(fp)) {
          status = "DUPLICATE";
          flags.push("duplicate_record");
          duplicates++;
        } else {
          seenFingerprints.add(fp);
        }
      }

      if (status === "VALID") accepted++;
      else if (status === "SUSPICIOUS") suspicious++;
      else if (status === "INVALID") invalid++;
      else if (status === "DUPLICATE") {
        /* counted above */
      }

      const prov = this.provenance.build(
        artifact,
        status,
        row.values.observation_date ?? null,
      );

      records.push({
        recordId: `rec_${artifact.artifactId}_${row.rowIndex}`,
        rowIndex: row.rowIndex,
        raw: row.raw,
        mapped,
        canonicalPortId: resolution.canonicalPortId,
        portResolutionConfidence: resolution.confidence,
        status,
        flags,
        provenance: prov,
      });
    }

    let decision: IngestionBatchResult["decision"];
    if (accepted === 0 && suspicious === 0) {
      decision = "REJECTED";
    } else if (invalid > 0 || suspicious > 0 || duplicates > 0) {
      decision = "PARTIALLY_APPROVED";
      reviewNotes.push(
        "Some rows invalid/suspicious/duplicate — review before L2 accept",
      );
    } else {
      decision = "APPROVED";
    }

    reviewNotes.push(`transform=${TRANSFORMATION_VERSION}`);

    return {
      batchId: batchId ?? `batch_${artifact.artifactId}`,
      producedAt: new Date().toISOString(),
      decision,
      artifact,
      columns: dataset.columns,
      mappings,
      records,
      stats: {
        inputRows: dataset.rows.length,
        accepted,
        invalid,
        suspicious,
        duplicates,
      },
      errors,
      reviewNotes,
    };
  }

  private rejectedBatch(fileName: string, err: IngestionError): IngestionBatchResult {
    return {
      batchId: `batch_reject_${Date.now()}`,
      producedAt: new Date().toISOString(),
      decision: "REJECTED",
      artifact: {
        artifactId: "none",
        fileName,
        format: "unknown",
        contentHash: "",
        capturedAt: new Date().toISOString(),
        byteLength: 0,
      },
      columns: [],
      mappings: [],
      records: [],
      stats: {
        inputRows: 0,
        accepted: 0,
        invalid: 0,
        suspicious: 0,
        duplicates: 0,
      },
      errors: [`${err.code}: ${err.message}`],
      reviewNotes: ["Batch rejected at ingestion boundary"],
    };
  }
}

function fingerprint(
  portId: string | null,
  date: string,
  waiting: number | string | null | undefined,
): string {
  return createHash("sha256")
    .update(`${portId}|${date}|${String(waiting)}`)
    .digest("hex");
}
