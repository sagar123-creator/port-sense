import { OlapExplorer } from "@/components/dwm/OlapExplorer";
import { Card, CardLabel } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default function DwmOlapPage() {
  return (
    <div className="grid min-w-0 gap-4">
      <Card tone="accent" padding="md">
        <CardLabel>Five OLAP operations, five real query shapes</CardLabel>
        <p className="mt-3 text-body text-ink-2">
          Roll-up, drill-down, slice, dice and pivot are implemented as whitelisted SQL over the
          star schema (dim_date × dim_port × dim_cargo × dim_source → four fact tables). Each run
          reports its grain, row count, sources and unit notes; the validation suite (29 checks)
          reconciles every operation against direct row-level SQL sums.
        </p>
      </Card>
      <OlapExplorer />
      <Card tone="panel" padding="md">
        <CardLabel>Hierarchy reference</CardLabel>
        <div className="mt-3 grid gap-4 text-small text-ink-3 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-ink-2">date hierarchy</p>
            <p className="mt-1">day → month → quarter → fiscal_year → year</p>
          </div>
          <div>
            <p className="font-semibold text-ink-2">port hierarchy</p>
            <p className="mt-1">port → coast → national</p>
          </div>
          <div>
            <p className="font-semibold text-ink-2">measures</p>
            <p className="mt-1">
              traffic: tonnes; dwell: export/import hours; turnaround: trt_hours; vessel queue:
              at_berth / at_anchorage / waiting_ratio
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink-2">guards</p>
            <p className="mt-1">
              identifiers whitelisted, values bound, limit ≤ 2000 rows, one mode per query, empty
              results render as “0 rows” (never fabricated zeros)
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
