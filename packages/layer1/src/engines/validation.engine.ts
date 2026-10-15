import type { ValidationStatus } from "../domain/types.js";
import type { NormalizedValue } from "../domain/types.js";

export interface ValidationInput {
  readonly waitingTime: NormalizedValue | null;
  readonly freeDays: NormalizedValue | null;
  readonly vesselCount: string | null;
  readonly observationDate: string | null;
  readonly portResolved: boolean;
  readonly distance: NormalizedValue | null;
}

export interface ValidationOutcome {
  readonly status: ValidationStatus;
  readonly flags: string[];
}

/**
 * Data Validation Engine — reject/flag bad values before canonical promotion.
 */
export class ValidationEngine {
  validate(input: ValidationInput): ValidationOutcome {
    const flags: string[] = [];

    if (!input.portResolved) {
      flags.push("unresolved_port");
    }
    if (!input.observationDate || !String(input.observationDate).trim()) {
      flags.push("missing_observation_date");
    } else if (!isPlausibleDate(String(input.observationDate))) {
      flags.push("invalid_observation_date");
    }

    if (!input.waitingTime || input.waitingTime.normalized === null) {
      flags.push("missing_waiting_time");
    } else if (typeof input.waitingTime.normalized === "number") {
      if (input.waitingTime.normalized < 0) {
        flags.push("negative_waiting_time");
      }
      if (input.waitingTime.normalized > 60) {
        flags.push("suspicious_waiting_time_gt_60_days");
      }
    }

    if (input.freeDays?.normalized !== null && input.freeDays?.normalized !== undefined) {
      if (typeof input.freeDays.normalized === "number") {
        if (input.freeDays.normalized < 0) {
          flags.push("negative_free_days");
        }
        if (input.freeDays.normalized > 90) {
          flags.push("suspicious_free_days_gt_90");
        }
        // architecture example: free_days = 500
        if (input.freeDays.normalized >= 500) {
          flags.push("suspicious_free_days_extreme");
        }
      }
    }

    if (input.vesselCount !== null && input.vesselCount.trim() !== "") {
      const n = Number(input.vesselCount);
      if (!Number.isFinite(n)) flags.push("invalid_vessel_count");
      else if (n < 0) flags.push("negative_vessel_count");
    }

    if (
      input.distance?.normalized !== null &&
      typeof input.distance?.normalized === "number" &&
      input.distance.normalized < 0
    ) {
      flags.push("negative_distance");
    }

    const hardReject = flags.some((f) =>
      [
        "negative_waiting_time",
        "negative_free_days",
        "negative_vessel_count",
        "negative_distance",
        "unresolved_port",
        "missing_waiting_time",
        "missing_observation_date",
        "invalid_observation_date",
      ].includes(f),
    );

    const suspicious = flags.some((f) => f.startsWith("suspicious_"));

    if (hardReject) {
      return { status: "INVALID", flags };
    }
    if (suspicious) {
      return { status: "SUSPICIOUS", flags };
    }
    return { status: "VALID", flags };
  }
}

function isPlausibleDate(s: string): boolean {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const d = new Date(t);
    return !Number.isNaN(d.getTime());
  }
  if (/^\d{4}-\d{2}$/.test(t)) return true; // month key
  if (/^[A-Za-z]{3}\s+\d{4}$/.test(t)) return true; // Mon YYYY
  const d = new Date(t);
  return !Number.isNaN(d.getTime());
}
