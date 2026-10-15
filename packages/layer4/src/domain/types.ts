import type { PortId } from "@port-sense/layer2-canonical";

export type LaneType = "domestic" | "export";

export const EXPORT_DESTINATION_CODES = [
  "AEJEA",
  "USGEN",
  "SGSIN",
  "NLRTM",
  "LKCMB",
] as const;

export type ExportDestinationCode = (typeof EXPORT_DESTINATION_CODES)[number];

export type DestinationCode = ExportDestinationCode | PortId;

export function isExportDestinationCode(value: string): value is ExportDestinationCode {
  return (EXPORT_DESTINATION_CODES as readonly string[]).includes(value);
}

export interface LaneDefinition {
  readonly laneId: string;
  readonly type: LaneType;
  readonly originPortId: PortId;
  /** Domestic: Indian port. Export: use destinationCode. */
  readonly destinationPortId?: PortId;
  readonly destinationCode?: ExportDestinationCode;
  readonly label: string;
  /** null = insufficient sourced transit — never invent */
  readonly transitDays: number | null;
  readonly transitSource: string | null;
}

export type DecisionPriority =
  | "lowest_cost"
  | "fastest"
  | "lowest_risk"
  | "balanced";

export interface LaneEvaluateRequest {
  readonly carrierId: import("@port-sense/layer2-canonical").CarrierId;
  readonly containerSize?: import("@port-sense/layer3-decision").ContainerSize;
  readonly containerCount?: number;
  /** Applied to every candidate origin for fair what-if compare */
  readonly dwellHoursOverride?: number;
  /** Per-origin dwell (Layer 7 calendar). Wins over dwellHoursOverride for that port. */
  readonly dwellHoursByPort?: Readonly<Partial<Record<import("@port-sense/layer2-canonical").PortId, number>>>;
  readonly asOf?: string;
  readonly direction?: "export" | "import";
  readonly priority?: DecisionPriority;
}

export interface LaneScore {
  readonly lane: LaneDefinition;
  readonly originName: string;
  readonly demurrageInr: number;
  readonly riskLevel: "low" | "medium" | "high";
  readonly riskScore: number;
  readonly transitDays: number | null;
  readonly tariffFactId: string;
  readonly dwellFactId: string | null;
  readonly sourceCitation: string;
  readonly status: "ok" | "insufficient_data";
  readonly insufficientReason?: string;
}

export interface LaneDecisionResult {
  readonly request: LaneEvaluateRequest;
  readonly destinationLabel: string;
  readonly candidates: readonly LaneScore[];
  readonly ranked: readonly LaneScore[];
  readonly winner: LaneScore | null;
  readonly runnerUp: LaneScore | null;
  /** Positive = winner cheaper than runner-up on demurrage */
  readonly saveInrVsRunnerUp: number | null;
  readonly recommendation: string;
  readonly honestyNote: string;
  readonly evaluatedAt: string;
}

export class LaneDecisionError extends Error {
  readonly code = "LANE_DECISION" as const;
  constructor(message: string) {
    super(message);
    this.name = "LaneDecisionError";
  }
}
