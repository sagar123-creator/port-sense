import type { CarrierId, PortId, TrustTier } from "./ids.js";

export interface Provenance {
  readonly sourcePath: string;
  readonly publisher: string;
  readonly sourceUrl?: string;
  readonly proofFiles: readonly string[];
  readonly fetchedAt: string;
  readonly verificationStatus: TrustTier;
  readonly note?: string;
}

export interface PortEntity {
  readonly id: PortId;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly isMajorPort: boolean;
  readonly state?: string;
  readonly trustTier: TrustTier;
}

export interface CarrierEntity {
  readonly id: CarrierId;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly trustTier: TrustTier;
}

export const PORT_REGISTRY: readonly PortEntity[] = [
  {
    id: "INNSA",
    name: "Jawaharlal Nehru Port (JNPT)",
    aliases: ["JNPT", "Nhava Sheva", "JNPA", "Jawaharlal Nehru Port"],
    isMajorPort: true,
    state: "Maharashtra",
    trustTier: "VERIFIED",
  },
  {
    id: "INMUN",
    name: "Mundra Port",
    aliases: ["Mundra", "APSEZ Mundra"],
    isMajorPort: false,
    state: "Gujarat",
    trustTier: "VERIFIED",
  },
  {
    id: "INMAA",
    name: "Chennai Port",
    aliases: ["Chennai"],
    isMajorPort: true,
    state: "Tamil Nadu",
    trustTier: "VERIFIED",
  },
  {
    id: "INCOK",
    name: "Cochin Port",
    aliases: ["Cochin", "Kochi"],
    isMajorPort: true,
    state: "Kerala",
    trustTier: "VERIFIED",
  },
  {
    id: "INVTZ",
    name: "Visakhapatnam Port",
    aliases: ["Vizag", "Visakhapatnam"],
    isMajorPort: true,
    state: "Andhra Pradesh",
    trustTier: "VERIFIED",
  },
  {
    id: "INCCU",
    name: "Syama Prasad Mookerjee Port (Kolkata)",
    aliases: ["Kolkata", "Kolkata Port", "Syama Prasad Mookerjee Port"],
    isMajorPort: true,
    state: "West Bengal",
    trustTier: "VERIFIED",
  },
  {
    id: "INDEE",
    name: "Deendayal Port",
    aliases: ["Deendayal", "Kandla", "Deendayal Port"],
    isMajorPort: true,
    state: "Gujarat",
    trustTier: "VERIFIED",
  },
] as const;

export const CARRIER_REGISTRY: readonly CarrierEntity[] = [
  {
    id: "MAERSK",
    name: "Maersk",
    aliases: ["Maersk Line"],
    trustTier: "VERIFIED",
  },
  {
    id: "HAPAG",
    name: "Hapag-Lloyd",
    aliases: ["Hapag", "Hapag Lloyd"],
    trustTier: "VERIFIED",
  },
  {
    id: "MSC",
    name: "MSC",
    aliases: ["Mediterranean Shipping Company"],
    trustTier: "VERIFIED",
  },
  {
    id: "CMA",
    name: "CMA CGM",
    aliases: ["CMA", "CMA-CGM"],
    trustTier: "VERIFIED",
  },
  {
    id: "ONE",
    name: "Ocean Network Express",
    aliases: ["ONE"],
    trustTier: "SECONDARY",
  },
  {
    id: "ZIM",
    name: "ZIM",
    aliases: ["Zim Integrated Shipping"],
    trustTier: "PROVISIONAL",
  },
] as const;
