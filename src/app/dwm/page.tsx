import { getOverview, getTrtRows } from "@/lib/dwm/queries";
import { Card, CardLabel } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { DwmSourceList } from "@/components/dwm/DwmSourceList";
import { DwmCoverageTable } from "@/components/dwm/DwmCoverageTable";
import { formatTonnesCompact } from "@/lib/layer2/monthlyCargo";
import { formatDays } from "@/lib/utils";

export const dynamic = "force-dynamic";

function StatGrid({ overview }: { overview: ReturnType<typeof getOverview> }) {
  const k = overview.kpis;
  const trtRows = getTrtRows();
  const trtMean = trtRows.length > 0 ? trtRows.reduce((a, r) => a + r.trtHours, 0) / trtRows.length : null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <Card tone="panel" padding="md" className="min-w-0">
        <Stat label="Fact rows" value={String(k.totalFactRows)} hint={`${k.realRows} real · ${k.syntheticRows} synthetic`} />
      </Card>
      <Card tone="panel" padding="md" className="min-w-0">
        <Stat label="Ports tracked" value={String(k.ports)} hint={`${k.sources} registered sources`} />
      </Card>
      <Card tone="panel" padding="md" className="min-w-0">
        <Stat
          label="Cargo loaded (real)"
          value={formatTonnesCompact(k.trafficTonnesTotal)}
          hint={`${k.trafficMonths} months · 5 major ports`}
        />
      </Card>
      <Card tone="panel" padding="md" className="min-w-0">
        <Stat
          label="Avg turnaround (FY23-24)"
          value={trtMean !== null ? formatDays(trtMean / 24) : "—"}
          hint={trtMean !== null ? `${trtRows.length} major ports · PIB/MoPSW` : "no TRT rows"}
        />
      </Card>
      <Card tone="panel" padding="md" className="min-w-0">
        <Stat label="Dwell series" value={String(k.dwellSeries)} hint="ports with published dwell months" />
      </Card>
      <Card tone="panel" padding="md" className="min-w-0">
        <Stat label="Vessel-queue days" value={String(k.queueDays)} hint="IPA published snapshot days" />
      </Card>
      <Card tone="panel" padding="md" className="min-w-0">
        <Stat label="ETL batches" value={String(k.importBatches)} hint={`${k.rejectedRows} rejected rows on record`} />
      </Card>
      <Card tone="panel" padding="md" className="min-w-0">
        <Stat
          label="Storage"
          value={overview.storage === "file" ? "SQLite file" : "In-memory"}
          hint={overview.storage === "file" ? "data/warehouse.sqlite" : "process-local fallback"}
        />
      </Card>
    </div>
  );
}

export default function DwmOverviewPage() {
  const overview = getOverview();

  return (
    <div className="grid min-w-0 gap-4">
      <Card tone="accent" padding="md">
        <CardLabel>Coverage & mode</CardLabel>
        <p className="mt-3 text-body text-ink-2">
          Every figure on this tab is <strong className="text-ink">real</strong> — loaded from the
          five published datasets that ship inside this repository. Reporting periods differ by
          source (cargo Oct 2025–Jul 2026, dwell Oct 2024–Jun 2026, turnaround FY 2023-24, vessel
          queue Jul–Aug 2026); they are labelled per table, not averaged across each other.
          Synthetic demo rows exist only for the OLAP/mining demos and are excluded from every query
          on this page.
        </p>
        {overview.skippedSources.length > 0 && (
          <p className="mt-3 rounded-card border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-small text-amber-200">
            Sources skipped during seed: {overview.skippedSources.join(" · ")}
          </p>
        )}
      </Card>

      <StatGrid overview={overview} />

      <DwmCoverageTable coverage={overview.coverage} />

      <div className="grid min-w-0 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <DwmSourceList sources={overview.sources} />
        <Card tone="panel" padding="md">
          <CardLabel>How this warehouse is fed</CardLabel>
          <ol className="mt-3 space-y-3 text-small text-ink-3">
            <li>
              <strong className="text-ink-2">Extract</strong> — repo datasets read directly
              (canonical snapshot, monthly cargo JSON, IPA vessel-queue CSV) or CSV imported through
              /dwm/etl.
            </li>
            <li>
              <strong className="text-ink-2">Transform</strong> — type checks, port-name
              normalisation, period/unit normalisation, duplicate detection; rejects keep row number
              + reason.
            </li>
            <li>
              <strong className="text-ink-2">Load</strong> — idempotent upsert into star-schema
              facts under one transaction per batch; re-imports report <code>unchanged</code>, never
              double-count.
            </li>
            <li>
              <strong className="text-ink-2">Query</strong> — OLAP roll-up/drill/slice/dice/pivot run
              parameterised SQL over dim_date × dim_port × dim_source joins.
            </li>
          </ol>
          <p className="mt-4 border-t border-hairline pt-3 text-small text-ink-4">
            Warehouse seeded {new Date(overview.seededAt).toLocaleString("en-IN")}. Warehouse rows
            are historical published statistics — not live congestion, not AIS, not demurrage
            invoices.
          </p>
        </Card>
      </div>
    </div>
  );
}
