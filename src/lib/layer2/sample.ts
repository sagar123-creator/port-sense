import type { RiskInput } from "@/types";

/**
 * Shared demo shipment used on the marketing slides and as the dashboard default.
 * MSC at JNPT is chosen so extra dwell (4.2d) exceeds free time (4d) and the
 * rupee figure is non-zero — a realistic MSME booking, not a zero-cost edge case.
 */
export const SAMPLE_INPUT: RiskInput = {
  portId: "jnpt",
  shipDate: "2026-08-20",
  containerType: "40ft",
  carrierId: "msc",
  containerCount: 8,
};

/** Frozen clock so SSR and the client never disagree on "updated at". */
export const MODEL_AS_OF = "2026-08-15T12:30:00.000Z";

export const SAMPLE_META = {
  label: "Sample booking",
  summary: "JNPT · 8 × 40 ft · MSC",
  story:
    "Eight 40-foot boxes out of Nhava Sheva on MSC. Extra dwell is already outside free time — this is the invoice a small exporter would otherwise discover too late.",
} as const;
