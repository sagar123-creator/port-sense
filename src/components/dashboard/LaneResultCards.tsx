"use client";

import { ArrowRight, MapPin } from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import { portShortLabel } from "@/lib/data/portLabels";
import type { LaneRowView } from "@/components/dashboard/LaneCompareTable";
import { BetterGateCard } from "@/components/dashboard/BetterGateCard";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { Button } from "@/components/ui/Button";

interface LaneResultCardsProps {
  rows: LaneRowView[];
  selectedLaneId: string | null;
  destinationLabel: string;
  recommendation: string | null;
  saveInr: number | null;
  preferredPortId?: string | null;
  startLabel?: string | null;
  onSelectLane: (row: LaneRowView) => void;
  onOpenMap: () => void;
}

export function LaneResultCards({
  rows,
  selectedLaneId,
  destinationLabel,
  recommendation,
  saveInr,
  preferredPortId,
  startLabel,
  onSelectLane,
  onOpenMap,
}: LaneResultCardsProps) {
  const okRows = rows.filter((r) => r.status === "ok");
  const best = okRows[0] ?? null;
  const rest = best ? rows.filter((r) => r.laneId !== best.laneId) : rows;
  const bestCost = best?.demurrageInr ?? 0;

  return (
    <div className="space-y-4">
      {preferredPortId && startLabel ? (
        <BetterGateCard
          rows={rows}
          preferredPortId={preferredPortId}
          startLabel={startLabel}
          destinationLabel={destinationLabel}
        />
      ) : null}
      {best ? (
        <article className="overflow-hidden rounded-card border border-brand-orange/40 bg-gradient-to-b from-brand-orange/15 to-surface-2 shadow-lift">
          <div className="flex items-center justify-between gap-3 border-b border-brand-orange/20 px-4 py-3 sm:px-5">
            <p className="text-label font-semibold uppercase tracking-[0.12em] text-brand-orange-soft">
              Best for demurrage
            </p>
            <span className="rounded-full border border-risk-low/40 bg-risk-low/15 px-2.5 py-0.5 text-label font-semibold uppercase text-risk-low">
              #1 pick
            </span>
          </div>
          <div className="space-y-4 px-4 py-5 sm:px-5">
            <div>
              <h3 className="text-title-2 font-semibold tracking-[-0.02em] text-ink sm:text-title-1">
                {best.label}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 text-small text-ink-3">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {portShortLabel(best.originPortId)} → {destinationLabel}
              </p>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-label font-semibold uppercase text-ink-4">
                  Est. demurrage
                </p>
                <p className="mt-1 font-display text-[2rem] font-semibold leading-none tabular-nums tracking-[-0.04em] text-brand-orange-soft sm:text-[2.4rem]">
                  {formatINR(best.demurrageInr)}
                </p>
                {saveInr != null && saveInr > 0 ? (
                  <p className="mt-2 text-small text-risk-low">Saves {formatINR(saveInr)} vs next</p>
                ) : (
                  <p className="mt-2 text-small text-ink-4">₹0 OK if still inside free time</p>
                )}
              </div>
              <RiskBadge level={best.riskLevel} score={best.riskScore ?? 0} size="md" />
            </div>
            {recommendation ? (
              <p className="rounded-panel border border-hairline bg-surface-0/40 px-3 py-2.5 text-small text-ink-2 sm:text-body">
                {recommendation}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="primary"
                size="md"
                fullWidth
                withArrow
                onClick={() => onSelectLane(best)}
              >
                See why this port
              </Button>
              <Button variant="outline" size="md" fullWidth onClick={onOpenMap}>
                View route
              </Button>
            </div>
          </div>
        </article>
      ) : (
        <p className="rounded-card border border-hairline bg-surface-2 px-4 py-8 text-center text-body text-ink-3">
          No ranked origin for this destination yet.
        </p>
      )}

      {rest.length > 0 ? (
        <div className="space-y-2">
          <p className="px-1 text-label font-semibold uppercase text-ink-4">Other options</p>
          <ul className="flex flex-col gap-2">
            {rest.map((row, index) => {
              const selectable = row.status === "ok";
              const selected = row.laneId === selectedLaneId;
              const delta = row.demurrageInr - bestCost;
              return (
                <li key={row.laneId}>
                  <button
                    type="button"
                    disabled={!selectable}
                    onClick={() => selectable && onSelectLane(row)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-panel border px-3.5 py-3.5 text-left transition-colors",
                      selected && "border-brand-orange/40 bg-brand-orange/[0.08]",
                      !selected && selectable && "border-hairline bg-surface-2/80 hover:bg-white/[0.05]",
                      !selectable && "cursor-not-allowed border-hairline bg-surface-2/40 opacity-60",
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-small font-semibold text-ink-3">
                      {index + 2}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">{row.label}</span>
                      <span className="mt-0.5 block text-label uppercase text-ink-4">
                        {row.status !== "ok"
                          ? "Insufficient data"
                          : delta > 0
                            ? `+${formatINR(delta)} vs best`
                            : "Same cost"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-body font-semibold tabular-nums text-ink">
                        {row.status !== "ok" ? "—" : formatINR(row.demurrageInr)}
                      </span>
                      {selectable ? (
                        <span className="mt-1 inline-flex items-center gap-0.5 text-label text-ink-4">
                          Detail <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
