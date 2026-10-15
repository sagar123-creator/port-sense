import type { CanonicalField, FieldMapping } from "../domain/types.js";

const ALIASES: Record<CanonicalField, readonly string[]> = {
  port_name: [
    "port",
    "port_name",
    "portname",
    "location",
    "port_location",
    "portlocation",
    "harbour",
    "harbor",
    "terminal_port",
  ],
  observation_date: [
    "date",
    "observation_date",
    "observationdate",
    "obs_date",
    "as_of",
    "asof",
    "period",
    "month",
  ],
  waiting_time: [
    "waiting_time",
    "waitingtime",
    "wait_time",
    "avg_wait",
    "avgwait",
    "dwell",
    "dwell_time",
    "dwelltime",
    "avg_delay",
    "delay",
  ],
  vessel_count: [
    "vessel_count",
    "vesselcount",
    "ships",
    "ship_count",
    "vessels",
  ],
  free_days: ["free_days", "freedays", "free_time", "freetime"],
  distance: ["distance", "dist", "haul", "nm", "kilometers", "km"],
  currency: ["currency", "curr", "ccy"],
  unknown: [],
};

function normalizeCol(name: string): string {
  return name.trim().toLowerCase().replace(/[\s\-]+/g, "_");
}

/**
 * Schema Detection Engine — suggests mappings with confidence; does not assume.
 */
export class SchemaDetectionEngine {
  detect(columns: readonly string[]): FieldMapping[] {
    const usedCanonical = new Set<CanonicalField>();
    const mappings: FieldMapping[] = [];

    for (const col of columns) {
      const norm = normalizeCol(col);
      let best: FieldMapping = {
        sourceColumn: col,
        canonicalField: "unknown",
        confidence: 0,
        reason: "no alias match",
      };

      for (const [field, aliases] of Object.entries(ALIASES) as [
        CanonicalField,
        readonly string[],
      ][]) {
        if (field === "unknown") continue;
        for (const alias of aliases) {
          if (norm === alias) {
            const confidence = 0.98;
            if (confidence > best.confidence) {
              best = {
                sourceColumn: col,
                canonicalField: field,
                confidence,
                reason: `exact alias match "${alias}"`,
              };
            }
          } else if (norm.includes(alias) || alias.includes(norm)) {
            const confidence = 0.82;
            if (confidence > best.confidence) {
              best = {
                sourceColumn: col,
                canonicalField: field,
                confidence,
                reason: `partial alias match "${alias}"`,
              };
            }
          }
        }
      }

      // Prefer unique canonical assignment: if already used with higher conf, demote
      if (
        best.canonicalField !== "unknown" &&
        usedCanonical.has(best.canonicalField)
      ) {
        const rival = mappings.find(
          (m) => m.canonicalField === best.canonicalField,
        );
        if (rival && rival.confidence >= best.confidence) {
          best = {
            sourceColumn: col,
            canonicalField: "unknown",
            confidence: 0.4,
            reason: `canonical ${String(rival.canonicalField)} already mapped to ${rival.sourceColumn}`,
          };
        }
      }

      if (best.canonicalField !== "unknown") {
        usedCanonical.add(best.canonicalField);
      }
      mappings.push(best);
    }

    return mappings;
  }

  /** Columns that look like a port field (for Test 7). */
  possiblePortColumns(columns: readonly string[]): string[] {
    return this.detect(columns)
      .filter((m) => m.canonicalField === "port_name" && m.confidence >= 0.8)
      .map((m) => m.sourceColumn);
  }
}
