"use client";

import { useMemo, type KeyboardEvent } from "react";
import { ArrowLeftRight } from "lucide-react";
import { getPortById } from "@/lib/data/ports";
import { cn, formatINR } from "@/lib/utils";
import type { RiskLevel } from "@/types";
import { Card } from "@/components/ui/Card";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { PanelHeader } from "@/components/dashboard/PanelHeader";

type Verdict = "best" | "avoid" | "ok";

export interface CompareRowView {
  portId: string;
  portName: string;
  code: string;
  estimatedCostINR: number;
  riskLevel: RiskLevel;
  chargeableDays: number;
}

const VERDICT_STYLES: Record<Verdict, string> = {
  best: "border-risk-low/30 bg-risk-low/12 text-risk-low",
  avoid: "border-risk-high/30 bg-risk-high/12 text-risk-high",
  ok: "border-hairline bg-white/[0.04] text-ink-3",
};

const VERDICT_LABELS: Record<Verdict, string> = {
  best: "Recommended",
  avoid: "Avoid",
  ok: "OK",
};

function VerdictChip({ verdict }: { verdict: Verdict }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-label font-semibold uppercase",
        VERDICT_STYLES[verdict],
      )}
    >
      {VERDICT_LABELS[verdict]}
    </span>
  );
}

const CELL =
  "px-3 py-4 align-middle whitespace-nowrap first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6";

interface PortCompareTableProps {
  rows: CompareRowView[];
  selectedPortId: string;
  onSelectPort: (portId: string) => void;
}

/** Port table fed only by Layer API rows (no client sample fallback). */
export function PortCompareTable({
  rows: rowsProp,
  selectedPortId,
  onSelectPort,
}: PortCompareTableProps) {
  const rows = useMemo(() => {
    return rowsProp.map((r) => {
      const port = getPortById(r.portId);
      return {
        portId: r.portId,
        name: r.portName,
        code: r.code,
        state: port?.state ?? "",
        chargeableDays: r.chargeableDays,
        estimatedCostINR: r.estimatedCostINR,
        riskLevel: r.riskLevel,
        congestionScore: port?.congestionScore ?? (r.riskLevel === "high" ? 70 : 40),
      };
    });
  }, [rowsProp]);

  const bestId = rows[0]?.portId;
  const bestCost = rows[0]?.estimatedCostINR ?? 0;

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, portId: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelectPort(portId);
  };

  if (rows.length === 0) {
    return (
      <Card tone="panel" padding="md">
        <p className="text-body text-ink-3">No Layer-3 port compare rows for this selection.</p>
      </Card>
    );
  }

  return (
    <Card tone="panel" padding="none">
      <PanelHeader
        className="px-5 pt-5 pb-5 sm:px-7 sm:pt-7"
        label="Port comparison"
        icon={<ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />}
        title="Origins ranked by demurrage"
        description="Costs from Layer 3 on Layer-2 published dwell and tariffs."
      />
      <div className="overflow-x-auto border-t border-hairline">
        <table className="w-full min-w-[700px] border-collapse text-left">
          <caption className="sr-only">Estimated demurrage by origin port</caption>
          <thead>
            <tr className="border-b border-hairline text-label font-semibold uppercase text-ink-4">
              <th scope="col" className={cn(CELL, "py-3 font-semibold")}>
                Port
              </th>
              <th scope="col" className={cn(CELL, "py-3 font-semibold")}>
                Risk
              </th>
              <th scope="col" className={cn(CELL, "py-3 font-semibold")}>
                Chargeable days
              </th>
              <th scope="col" className={cn(CELL, "py-3 font-semibold")}>
                Est. cost
              </th>
              <th scope="col" className={cn(CELL, "py-3 font-semibold")}>
                vs best
              </th>
              <th scope="col" className={cn(CELL, "py-3 font-semibold")}>
                Verdict
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isBest = row.portId === bestId;
              const isSelected = row.portId === selectedPortId;
              const delta = row.estimatedCostINR - bestCost;
              const verdict: Verdict = isBest ? "best" : row.riskLevel === "high" ? "avoid" : "ok";

              return (
                <tr
                  key={row.portId}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${row.name}`}
                  aria-current={isSelected ? "true" : undefined}
                  onClick={() => onSelectPort(row.portId)}
                  onKeyDown={(event) => handleKeyDown(event, row.portId)}
                  className={cn(
                    "cursor-pointer border-b border-hairline transition-colors duration-300 last:border-b-0 hover:bg-white/[0.04]",
                    "focus-visible:bg-white/[0.06]",
                    isSelected && "bg-brand-orange/[0.07]",
                  )}
                >
                  <td className={cn(CELL, "relative")}>
                    {isSelected && (
                      <span
                        className="absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-brand-orange"
                        aria-hidden="true"
                      />
                    )}
                    <span className="block text-body font-medium text-ink">{row.name}</span>
                    <span className="block text-label font-semibold uppercase text-ink-4">
                      {row.code} · {row.state}
                    </span>
                  </td>
                  <td className={CELL}>
                    <RiskBadge level={row.riskLevel} score={row.congestionScore} size="sm" />
                  </td>
                  <td className={cn(CELL, "text-body tabular-nums text-ink-2")}>
                    {row.chargeableDays.toFixed(1)}
                  </td>
                  <td
                    className={cn(
                      CELL,
                      "text-body font-semibold tabular-nums",
                      isBest ? "text-risk-low" : "text-ink",
                    )}
                  >
                    {formatINR(row.estimatedCostINR)}
                  </td>
                  <td
                    className={cn(
                      CELL,
                      "text-small tabular-nums",
                      delta > 0 ? "text-brand-orange-soft" : "text-ink-4",
                    )}
                  >
                    {isBest ? "Best" : delta > 0 ? `+${formatINR(delta)}` : "Same"}
                  </td>
                  <td className={CELL}>
                    <VerdictChip verdict={verdict} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
