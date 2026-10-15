/** Stable IDs for Layer 2 — never reuse after deprecation. */

export type PortId =
  | "INNSA" // JNPT / Nhava Sheva
  | "INMUN" // Mundra (private)
  | "INMAA" // Chennai
  | "INCOK" // Cochin
  | "INVTZ" // Visakhapatnam
  | "INCCU" // Kolkata / Syama Prasad Mookerjee
  | "INDEE"; // Deendayal (Kandla) — major port, NOT Mundra

export type CarrierId =
  | "MAERSK"
  | "HAPAG"
  | "MSC"
  | "CMA"
  | "ONE"
  | "ZIM";

export type Direction = "export" | "import";
export type EquipmentClass = "dry" | "reefer" | "special_haz";
export type FxPair = "USDINR";

export type FactKind =
  | "tariff"
  | "dwell_monthly"
  | "dwell_snapshot"
  | "trt"
  | "fx";

export type TrustTier = "VERIFIED" | "SECONDARY" | "PROVISIONAL";
