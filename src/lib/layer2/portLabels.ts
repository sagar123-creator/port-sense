/** Short UI names for modelled Indian gates. Mundra is not listed. */

const SHORT: Record<string, string> = {
  jnpt: "JNPT",
  chennai: "Chennai",
  cochin: "Cochin",
  vizag: "Vizag",
  kolkata: "Kolkata",
};

const CHIP: Record<string, string> = {
  jnpt: "IN NSA",
  chennai: "IN MAA",
  cochin: "IN COK",
  vizag: "IN VTZ",
  kolkata: "IN CCU",
};

export function portShortLabel(id: string, fallback = id): string {
  return SHORT[id] ?? fallback;
}

/** Compact chip for the origin→dest strip (UN/LOCODE family, not a sailing track). */
export function portChipCode(id: string): string {
  return CHIP[id] ?? id.toUpperCase();
}
