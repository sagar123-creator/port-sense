import { formatINR, cn } from "@/lib/utils";
import { portShortLabel } from "@/lib/data/portLabels";
import type { LaneRowView } from "@/components/dashboard/LaneCompareTable";

interface LiveLanePreviewProps {
  rows: LaneRowView[];
  loading: boolean;
  asOfDate: string;
  destinationLabel: string;
  selectedLaneId: string | null;
  preferredPortId?: string | null;
  onSelectLane: (row: LaneRowView) => void;
}

export function LiveLanePreview({
  rows,
  loading,
  asOfDate,
  destinationLabel,
  selectedLaneId,
  preferredPortId,
  onSelectLane,
}: LiveLanePreviewProps) {
  const ok = rows.filter((row) => row.status === "ok");

  return (
    <div className="rounded-card border border-hairline bg-surface-2">
      <div className="border-b border-hairline px-4 py-3 sm:px-5">
        <p className="text-label font-semibold uppercase tracking-[0.12em] text-ink-4">
          Port compare · {asOfDate}
        </p>
        <p className="mt-1 text-small text-ink-3">
          Estimated demurrage into {destinationLabel}. Updates when you change the day.
        </p>
      </div>
      {loading && ok.length === 0 ? (
        <p className="px-4 py-8 text-center text-body text-ink-3">Ranking ports for this date…</p>
      ) : ok.length === 0 ? (
        <p className="px-4 py-8 text-center text-body text-ink-3">No ranked origin for this date.</p>
      ) : (
        <ol className="divide-y divide-hairline">
          {ok.map((row, index) => {
            const active = row.laneId === selectedLaneId;
            const preferred = row.originPortId === preferredPortId;
            return (
              <li key={row.laneId}>
                <button
                  type="button"
                  onClick={() => onSelectLane(row)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5",
                    active ? "bg-brand-orange/12" : "hover:bg-white/[0.04]",
                  )}
                >
                  <span className="w-6 text-label font-semibold tabular-nums text-ink-4">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-body font-semibold text-ink">
                      {portShortLabel(row.originPortId, row.label)}
                    </span>
                    {preferred ? (
                      <span className="ml-2 text-label uppercase text-brand-orange-soft">
                        start gate
                      </span>
                    ) : null}
                  </span>
                  <span className="text-body font-semibold tabular-nums text-brand-orange-soft">
                    {formatINR(row.demurrageInr)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
