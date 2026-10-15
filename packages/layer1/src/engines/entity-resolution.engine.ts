export type ResolvedPortId =
  | "INNSA"
  | "INMUN"
  | "INMAA"
  | "INCOK"
  | "INVTZ"
  | "INCCU"
  | "INDEE"
  | "INPAV";

interface PortAlias {
  readonly id: ResolvedPortId;
  readonly aliases: readonly string[];
}

/** Mirror of Layer-2 registry (+ Pipavav for resolution readiness). */
const PORTS: readonly PortAlias[] = [
  {
    id: "INNSA",
    aliases: [
      "jnpt",
      "jnpa",
      "nhava sheva",
      "nhavasheva",
      "nhava sheva port",
      "jawaharlal nehru port",
      "jawaharlal nehru port (jnpt)",
      "jnpt port",
    ],
  },
  {
    id: "INMUN",
    aliases: ["mundra", "mundra port", "apsez mundra"],
  },
  {
    id: "INMAA",
    aliases: ["chennai", "chennai port", "madras"],
  },
  {
    id: "INCOK",
    aliases: ["cochin", "kochi", "cochin port"],
  },
  {
    id: "INVTZ",
    aliases: ["vizag", "visakhapatnam", "visakhapatnam port", "vishakhapatnam"],
  },
  {
    id: "INCCU",
    aliases: [
      "kolkata",
      "kolkata port",
      "calcutta",
      "syama prasad mookerjee port",
      "syama prasad mookerjee port (kolkata)",
    ],
  },
  {
    id: "INDEE",
    aliases: ["deendayal", "deendayal port", "kandla", "kandla port"],
  },
  {
    id: "INPAV",
    aliases: ["pipavav", "pipavav port", "gppl"],
  },
];

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ");
}

export interface PortResolution {
  readonly canonicalPortId: ResolvedPortId | null;
  readonly confidence: number;
  readonly matchedAlias: string | null;
}

/**
 * Entity Resolution Engine — many surface names → one canonical port id.
 */
export class EntityResolutionEngine {
  resolvePort(name: string): PortResolution {
    if (!name || !name.trim()) {
      return { canonicalPortId: null, confidence: 0, matchedAlias: null };
    }
    const n = norm(name);

    for (const port of PORTS) {
      for (const alias of port.aliases) {
        if (n === alias) {
          return {
            canonicalPortId: port.id,
            confidence: 1,
            matchedAlias: alias,
          };
        }
      }
    }

    for (const port of PORTS) {
      for (const alias of port.aliases) {
        if (n.includes(alias) || alias.includes(n)) {
          return {
            canonicalPortId: port.id,
            confidence: 0.9,
            matchedAlias: alias,
          };
        }
      }
    }

    return { canonicalPortId: null, confidence: 0, matchedAlias: null };
  }

  /** Test helper: all names must resolve to the same id. */
  allResolveToSame(names: readonly string[]): {
    ok: boolean;
    id: ResolvedPortId | null;
  } {
    const ids = names.map((n) => this.resolvePort(n).canonicalPortId);
    const first = ids[0] ?? null;
    const ok = first !== null && ids.every((id) => id === first);
    return { ok, id: first };
  }
}
