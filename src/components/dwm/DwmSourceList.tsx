import type { SourceRow } from "@/lib/dwm/queries";
import { Card, CardLabel } from "@/components/ui/Card";

function ModeBadge({ mode }: { mode: string }) {
  const real = mode === "real";
  return (
    <span
      className={
        real
          ? "inline-flex shrink-0 items-center rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-emerald-300"
          : "inline-flex shrink-0 items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-amber-300"
      }
    >
      {real ? "real" : "synthetic"}
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = {
  verified: "verified",
  imported: "imported",
  synthetic_demo: "synthetic demo",
};

/** Provenance list: publisher, period, accessed date and fact-row count per source. */
export function DwmSourceList({ sources }: { sources: readonly SourceRow[] }) {
  return (
    <Card tone="panel" padding="md" className="min-w-0">
      <CardLabel>Source provenance ({sources.length})</CardLabel>
      <ul className="mt-4 space-y-3">
        {sources.map((source) => (
          <li key={source.sourceId} className="border-b border-hairline pb-3 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 text-body font-semibold text-ink">{source.title}</p>
              <ModeBadge mode={source.mode} />
            </div>
            <p className="mt-1 text-small text-ink-3">
              {source.publisher}
              {source.reportingPeriod ? ` · ${source.reportingPeriod}` : ""}
              {source.accessedAt ? ` · accessed ${source.accessedAt}` : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ink-4">
              <span>{STATUS_LABEL[source.validationStatus] ?? source.validationStatus}</span>
              <span>{source.factRows} fact rows</span>
              {source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-orange-soft underline-offset-2 hover:underline"
                >
                  source ↗
                </a>
              )}
            </div>
            {source.notes && <p className="mt-1.5 text-small text-ink-4">{source.notes}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
