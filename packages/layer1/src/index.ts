export type {
  FileFormat,
  CanonicalField,
  ValidationStatus,
  RawArtifact,
  TabularDataset,
  FieldMapping,
  ProvenanceRecord,
  NormalizedValue,
  RecordCandidate,
  IngestionBatchResult,
} from "./domain/types.js";

export { IngestionError, TRANSFORMATION_VERSION } from "./domain/types.js";

export {
  IngestionEngine,
  datasetsEquivalent,
} from "./engines/ingestion.engine.js";
export { SchemaDetectionEngine } from "./engines/schema-detection.engine.js";
export { SchemaMappingEngine } from "./engines/schema-mapping.engine.js";
export { EntityResolutionEngine } from "./engines/entity-resolution.engine.js";
export { UnitNormalizationEngine } from "./engines/unit-normalization.engine.js";
export { ValidationEngine } from "./engines/validation.engine.js";
export { ProvenanceEngine } from "./engines/provenance.engine.js";
export { DataBuilderService } from "./application/data-builder.service.js";
export {
  toLayer2IngestionResult,
  summarizeBridge,
  type Layer2IngestionResult,
} from "./application/bridge-to-layer2.js";
export {
  getLayer1Root,
  getLayer1Status,
  type Layer1StatusSummary,
} from "./infrastructure/status.js";
