import { ArrowRight } from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import { portShortLabel } from "@/lib/data/portLabels";
import type { LaneRowView } from "@/components/dashboard/LaneCompareTable";

interface BetterGateCardProps {
  rows: LaneRowView[];
  preferredPortId: string;
  startLabel: string;
  destinationLabel: string;
}

export function BetterGateCard({
  rows,
  preferredPortId,
  startLabel,
  destinationLabel,
}: BetterGateCardProps) {
  const okRows = rows.filter((row) => row.status === "ok");
  const winner = okRows[0] ?? null;
  const preferred = okRows.find((row) => row.originPortId === preferredPortId) ?? null;

  if (!winner || !preferred) return null;

  const preferredRank = okRows.findIndex((row) => row.laneId === preferred.laneId) + 1;
  const same = winner.laneId === preferred.laneId;
  const delta = preferred.demurrageInr - winner.demurrageInr;
  const winnerName = portShortLabel(winner.originPortId, winner.label);
  const preferredName = portShortLabel(preferred.originPortId, preferred.label);

  return (
    <article
      className={cn(
        "rounded-card border px-4 py-4 sm:px-5",
        same ? "border-risk-low/35 bg-risk-low/10" : "border-brand-orange/40 bg-brand-orange/10",
      )}
    >
      {same ? (
        <>
          <p className="text-label font-semibold uppercase tracking-[0.12em] text-risk-low">
            Your start gate ranks first
          </p>
          <p className="mt-2 text-body text-ink-2">
            From {startLabel}, nearest modelled gate is {preferredName} — and it is also #1 on
            estimated demurrage into {destinationLabel}.
          </p>
        </>
      ) : (
        <>
          <p className="text-label font-semibold uppercase tracking-[0.12em] text-brand-orange-soft">
            Better gate on wait-fee
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-title-3 font-semibold text-ink">
            <span>{preferredName}</span>
            <ArrowRight className="h-4 w-4 text-ink-4" aria-hidden="true" />
            <span className="text-brand-orange-soft">{winnerName}</span>
          </div>
          <p className="mt-2 text-small text-ink-2 sm:text-body">
            You started near {startLabel} ({preferredName}, #{preferredRank}
            {delta > 0 ? ` · ${formatINR(delta)} more` : ""}). {winnerName} ranks better on
            estimated demurrage into {destinationLabel}.
          </p>
        </>
      )}
    </article>
  );
}
