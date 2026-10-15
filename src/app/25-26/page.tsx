import { Year2526Charts } from "@/components/year2526/Year2526Charts";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { formatTonnesCompact } from "@/lib/layer2/monthlyCargo";
import {
  YEAR_2526_SOURCE,
  cargoMonthSeries,
  cargoPortTotals,
  extraWaitForTypicalBooking,
  transitStats,
} from "@/lib/layer2/year2526";
import { formatDays, formatINR, formatINRCompact } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: "2025 / 2026",
  description: `Cargo tonnes and wait-fee money left on the table — ${BRAND.name}.`,
};

export default function Year2526Page() {
  const series = cargoMonthSeries();
  const ports = cargoPortTotals();
  const extraWait = extraWaitForTypicalBooking();
  const stats = transitStats(series, extraWait);
  const cheapest = [...extraWait].sort((a, b) => a.extraCostInr - b.extraCostInr)[0];

  return (
    <div className="relative isolate overflow-x-hidden bg-surface-1 pt-20 pb-16 sm:pt-28 sm:pb-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(60%_80%_at_20%_0%,rgba(228,77,14,0.14),transparent_70%)]" />
      <Container width="wide" className="relative min-w-0 px-4 sm:px-6">
        <header className="max-w-2xl">
          <p className="text-label font-semibold uppercase tracking-[0.16em] text-brand-orange-soft">
            2025 / 2026
          </p>
          <h1 className="mt-3 font-display text-title-1 font-semibold tracking-[-0.04em] text-ink sm:text-display-2">
            Transit moved. Wait money lost.
          </h1>
          <p className="mt-3 text-small text-ink-2 sm:text-body">
            Ten months of cargo at five ports, split by calendar year. <strong className="font-semibold text-ink">Tonnes</strong> means
            cargo handled — not boxes. Rupees are extra wait vs {cheapest?.label ?? "the cheapest gate"},
            not an audited carrier invoice.
          </p>
        </header>

        <dl className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          {([stats.y2025, stats.y2026, stats.combined] as const).map((slice) => {
            const isTotal = slice.year === "combined";
            return (
              <div
                key={slice.heading}
                className={
                  isTotal
                    ? "min-w-0 rounded-card border border-brand-orange/30 bg-brand-orange/10 px-4 py-4"
                    : "min-w-0 rounded-card border border-hairline bg-surface-2 px-4 py-4"
                }
              >
                <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-ink-4 sm:text-label">
                  {slice.heading}
                  <span className="mt-0.5 block font-medium normal-case tracking-normal text-ink-4">
                    {slice.rangeLabel} · {slice.months} mo
                  </span>
                </dt>
                <dd
                  className={
                    isTotal
                      ? "mt-2 break-words font-display text-title-2 font-semibold tabular-nums text-brand-orange-soft"
                      : "mt-2 break-words font-display text-title-2 font-semibold tabular-nums text-ink"
                  }
                >
                  {formatINRCompact(slice.totalLost)}
                </dd>
                <dd className="mt-1 text-small text-ink-3">
                  lost · {formatTonnesCompact(slice.totalTransit)} moved
                </dd>
              </div>
            );
          })}
        </dl>

        <dl className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
          <div className="min-w-0 rounded-card border border-hairline bg-surface-2 px-3 py-3 sm:px-4 sm:py-4">
            <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-ink-4 sm:text-label">
              <span className="sm:hidden">Avg / month</span>
              <span className="hidden sm:inline">Avg monthly transit</span>
            </dt>
            <dd className="mt-1.5 break-words font-display text-title-3 font-semibold tabular-nums text-ink sm:text-title-2">
              {formatTonnesCompact(stats.avgMonthlyTransit)}
            </dd>
          </div>
          <div className="min-w-0 rounded-card border border-hairline bg-surface-2 px-3 py-3 sm:px-4 sm:py-4">
            <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-ink-4 sm:text-label">
              Avg extra wait
            </dt>
            <dd className="mt-1.5 break-words font-display text-title-3 font-semibold tabular-nums text-ink sm:text-title-2">
              {formatDays(stats.avgExtraDays)}
            </dd>
          </div>
        </dl>

        <div className="mt-6 min-w-0">
          <Year2526Charts
            series={series}
            portTotals={ports}
            lost2025={stats.y2025.lostRows}
            lost2026={stats.y2026.lostRows}
          />
        </div>

        <section className="mt-6 grid min-w-0 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-card border border-hairline bg-surface-2 px-4 py-5 sm:px-5 sm:py-6">
            <p className="text-label font-semibold uppercase tracking-[0.12em] text-brand-orange-soft">
              Why this product
            </p>
            <h2 className="mt-2 text-title-3 font-semibold text-ink sm:text-title-2">
              Same boxes. Wrong gate. That gap is the extra invoice.
            </h2>
            <p className="mt-3 text-small text-ink-2 sm:text-body">
              Combined lost is {formatINR(stats.combined.totalLost)}: {formatINR(stats.y2025.totalLost)}{" "}
              in 2025 (Oct–Dec) plus {formatINR(stats.y2026.totalLost)} in 2026 (Jan–Jul). Extra wait vs{" "}
              {cheapest?.label ?? "the cheapest gate"}, counted as one 8 × 40ft lot per 1 lakh tonnes
              handled. Most cargo is not a delayed box — this is a slice, not every tonne.{" "}
              {BRAND.name} prices the gate before you book.
            </p>
            <div className="mt-5">
              <Button href="/dashboard" variant="primary" size="lg" withArrow>
                Compare ports
              </Button>
            </div>
          </article>
          <aside className="rounded-card border border-hairline bg-surface-0/40 px-4 py-5 sm:px-5">
            <p className="text-label font-semibold uppercase text-ink-4">Reference</p>
            <ul className="mt-3 space-y-2 text-small text-ink-3">
              <li>{YEAR_2526_SOURCE.grain}</li>
              <li>{YEAR_2526_SOURCE.tonnesNote}</li>
              <li>{YEAR_2526_SOURCE.file}</li>
              <li>
              Combined lost is extra dwell × tariff on that modelled lot, split by calendar year of the
              cargo month. Not a 2025–26 daily wait CSV.
              </li>
              <li>
                <a
                  href={YEAR_2526_SOURCE.jnpaLdb}
                  className="text-brand-orange-soft underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  JNPA LDB monthly reports
                </a>
              </li>
            </ul>
          </aside>
        </section>
      </Container>
    </div>
  );
}
