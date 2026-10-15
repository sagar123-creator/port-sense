import type { CanonicalField, FieldMapping, TabularDataset } from "../domain/types.js";
import { SchemaDetectionEngine } from "./schema-detection.engine.js";

export interface MappedRow {
  readonly rowIndex: number;
  readonly raw: Record<string, string>;
  /** canonical field → raw cell string (pre-normalization) */
  readonly values: Partial<Record<CanonicalField, string>>;
}

/**
 * Schema Mapping Engine — applies detection into canonical field bag per row.
 */
export class SchemaMappingEngine {
  private readonly detector = new SchemaDetectionEngine();

  mapDataset(dataset: TabularDataset): {
    mappings: FieldMapping[];
    rows: MappedRow[];
    missingRequired: CanonicalField[];
  } {
    const mappings = this.detector.detect(dataset.columns);
    const byCanonical = new Map<CanonicalField, string>();
    for (const m of mappings) {
      if (m.canonicalField !== "unknown" && m.confidence >= 0.8) {
        byCanonical.set(m.canonicalField, m.sourceColumn);
      }
    }

    const required: CanonicalField[] = ["port_name", "observation_date", "waiting_time"];
    const missingRequired = required.filter((r) => !byCanonical.has(r));

    const rows: MappedRow[] = dataset.rows.map((raw, rowIndex) => {
      const values: Partial<Record<CanonicalField, string>> = {};
      for (const [field, col] of byCanonical) {
        values[field] = raw[col] ?? "";
      }
      return { rowIndex, raw, values };
    });

    return { mappings, rows, missingRequired };
  }
}
