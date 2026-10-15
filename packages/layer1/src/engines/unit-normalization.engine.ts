import type { NormalizedValue } from "../domain/types.js";

const NM_TO_KM = 1.852;

/**
 * Unit Normalization Engine — convert to internal standards; keep originals.
 * waiting_time → days
 * distance → km
 */
export class UnitNormalizationEngine {
  normalizeWaitingTime(raw: string): NormalizedValue {
    const text = raw.trim().toLowerCase();
    if (!text) {
      return {
        original: raw,
        originalUnit: null,
        normalized: null,
        normalizedUnit: "days",
      };
    }

    const numMatch = /(-?\d+(?:\.\d+)?)/.exec(text);
    if (!numMatch?.[1]) {
      return {
        original: raw,
        originalUnit: null,
        normalized: null,
        normalizedUnit: "days",
      };
    }
    const value = Number(numMatch[1]);

    if (/hour|hr|hrs|h\b/.test(text)) {
      return {
        original: raw,
        originalUnit: "hours",
        normalized: value / 24,
        normalizedUnit: "days",
      };
    }
    if (/day|d\b/.test(text)) {
      return {
        original: raw,
        originalUnit: "days",
        normalized: value,
        normalizedUnit: "days",
      };
    }
    // bare number → assume days (documented convention)
    return {
      original: raw,
      originalUnit: "days_assumed",
      normalized: value,
      normalizedUnit: "days",
    };
  }

  normalizeDistance(raw: string): NormalizedValue {
    const text = raw.trim().toLowerCase();
    if (!text) {
      return {
        original: raw,
        originalUnit: null,
        normalized: null,
        normalizedUnit: "km",
      };
    }
    const numMatch = /(-?\d+(?:\.\d+)?)/.exec(text);
    if (!numMatch?.[1]) {
      return {
        original: raw,
        originalUnit: null,
        normalized: null,
        normalizedUnit: "km",
      };
    }
    const value = Number(numMatch[1]);

    if (/nautical|nmi|\bnm\b/.test(text)) {
      return {
        original: raw,
        originalUnit: "nautical_miles",
        normalized: Math.round(value * NM_TO_KM * 1000) / 1000,
        normalizedUnit: "km",
      };
    }
    if (/km|kilomet/.test(text)) {
      return {
        original: raw,
        originalUnit: "km",
        normalized: value,
        normalizedUnit: "km",
      };
    }
    return {
      original: raw,
      originalUnit: "km_assumed",
      normalized: value,
      normalizedUnit: "km",
    };
  }

  normalizeFreeDays(raw: string): NormalizedValue {
    const text = raw.trim();
    const numMatch = /(-?\d+(?:\.\d+)?)/.exec(text);
    if (!numMatch?.[1]) {
      return {
        original: raw,
        originalUnit: "days",
        normalized: null,
        normalizedUnit: "days",
      };
    }
    return {
      original: raw,
      originalUnit: "days",
      normalized: Number(numMatch[1]),
      normalizedUnit: "days",
    };
  }
}
