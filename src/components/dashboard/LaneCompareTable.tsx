"use client";

import type { KeyboardEvent } from "react";
import { Route } from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import type { RiskLevel } from "@/types";
import { Card } from "@/components/ui/Card";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { PanelHeader } from "@/components/dashboard/PanelHeader";

export interface LaneRowView {
  laneId: string;
  label: string;
  originPortId: string;
  demurrageInr: number;
  riskLevel: RiskLevel;
  riskScore?: number;
  status: "ok" | "insufficient_data";
  transitDays: number | null;
  citation?: string;
}

type Verdict = "best" | "avoid" | "ok" | "insufficient";

const VERDICT_STYLES: Record<Verdict, string> = {
  best: "border-risk-low/30 bg-risk-low/12 text-risk-low",
  avoid: "border-risk-high/30 bg-risk-high/12 text-risk-high",
  ok: "border-hairline bg-white/[0.04] text-ink-3",
  insufficient: "border-hairline bg-white/[0.03] text-ink-4",
};

const CELL =
  "px-3 py-4 align-middle whitespace-nowrap first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6";

interface LaneCompareTableProps {
  rows: LaneRowView[];
  selectedLaneId: string | null;
  onSelectLane: (row: LaneRowView) => void;
  title?: string;
  description?: string;
}

export function LaneCompareTable({
  rows,
  selectedLaneId,
  onSelectLane,
  title = "Ranked lanes",
  description = "Waiting fee at the Indian port. ₹0 means the wait is still covered.",
}: LaneCompareTableProps) {
  const okRows = rows.filter((r) => r.status === "ok");
  const bestId = okRows[0]?.laneId;
  const bestCost = okRows[0]?.demurrageInr ?? 0;

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: LaneRowView) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (row.status === "ok") onSelectLane(row);
  };

  return (
    <Card tone="panel" padding="none">
      <PanelHeader
        className="px-5 pt-5 pb-5 sm:px-7 sm:pt-7"
        label="Lane comparison"
        icon={<Route className="h-3.5 w-3.5" aria-hidden="true" />}
        title={title}
        description={description}
      />
      <div className="overflow-x-auto border-t border-hairline">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <caption className="sr-only">Ranked lanes by demurrage at origin</caption>
          <thead>
            <tr className="border-b border-hairline text-label font-semibold uppercase text-ink-4">
              <th scope="col" className={cn(CELL, "py-3 font-semibold")}>
                Lane
              </th>
              <th scope="col" className={cn(CELL, "py-3 font-semibold")}>
                Risk
              </th>
              <th scope="col" className={cn(CELL, "py-3 font-semibold")}>
                Transit
              </th>
              <th scope="col" className={cn(CELL, "py-3 font-semibold")}>
                Demurrage ₹
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
              const isBest = row.laneId === bestId;
              const isSelected = row.laneId === selectedLaneId;
              const delta = row.demurrageInr - bestCost;
              const verdict: Verdict =
                row.status !== "ok"
                  ? "insufficient"
                  : isBest
                    ? "best"
                    : row.riskLevel === "high"
                      ? "avoid"
                      : "ok";
              const selectable = row.status === "ok";

              return (
                <tr
                  key={row.laneId}
                  role={selectable ? "button" : undefined}
                  tabIndex={selectable ? 0 : undefined}
                  aria-label={selectable ? `Select ${row.label}` : row.label}
                  aria-current={isSelected ? "true" : undefined}
                  onClick={() => selectable && onSelectLane(row)}
                  onKeyDown={(event) => handleKeyDown(event, row)}
                  className={cn(
                    "border-b border-hairline transition-colors duration-300 last:border-b-0",
                    selectable && "cursor-pointer hover:bg-white/[0.04] focus-visible:bg-white/[0.06]",
                    !selectable && "opacity-70",
                    isSelected && "bg-brand-orange/[0.07]",
                  )}
                >
                  <td className={cn(CELL, "relative")}>
                    {isSelected && (
                      <span
                        title="Selected lane"
                        className="absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-brand-orange"
                        aria-hidden="true"
                      />
                    )}
                    <span className="block text-body font-medium text-ink">{row.label}</span>
                    <span className="block text-label font-semibold uppercase text-ink-4">
                      Demurrage at origin · not detention
                    </span>
                  </td>
                  <td className={CELL}>
                    {row.status === "ok" ? (
                      <RiskBadge level={row.riskLevel} score={row.riskScore ?? 0} size="sm" />
                    ) : (
                      <span className="text-small text-ink-4">n/a</span>
                    )}
                  </td>
                  <td className={cn(CELL, "text-body tabular-nums text-ink-2")}>
                    {row.transitDays == null ? (
                      <span className="text-ink-4" title="No verified sailing time in our data">
                        Unknown
                      </span>
                    ) : (
                      `${row.transitDays}d`
                    )}
                  </td>
                  <td
                    className={cn(
                      CELL,
                      "text-body font-semibold tabular-nums",
                      row.status !== "ok"
                        ? "text-ink-4"
                        : isBest
                          ? "text-risk-low"
                          : "text-ink",
                    )}
                  >
                    {row.status !== "ok" ? "—" : formatINR(row.demurrageInr)}
                  </td>
                  <td className={cn(CELL, "text-small tabular-nums text-ink-4")}>
                    {row.status !== "ok"
                      ? "—"
                      : isBest
                        ? "Best"
                        : delta > 0
                          ? `+${formatINR(delta)}`
                          : "Same"}
                  </td>
                  <td className={CELL}>
                    <span
                      className={cn(
                        "inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-label font-semibold uppercase",
                        VERDICT_STYLES[verdict],
                      )}
                    >
                      {verdict === "best"
                        ? "Best"
                        : verdict === "avoid"
                          ? "Higher risk"
                          : verdict === "insufficient"
                            ? "No data"
                            : "OK"}
                    </span>
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
