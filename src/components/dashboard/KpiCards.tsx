import { AlertTriangle, CalendarClock, IndianRupee, Lightbulb } from "lucide-react";
import { cn, formatDays, formatINR } from "@/lib/utils";
import type { RiskResult } from "@/types";
import { Card, CardLabel } from "@/components/ui/Card";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { Reveal } from "@/components/ui/Reveal";
import { Sparkline } from "@/components/ui/Sparkline";
import { MeterBar } from "@/components/dashboard/MeterBar";

const METRIC = "font-display text-metric font-semibold tabular-nums text-ink";
const UNIT = "ml-1.5 text-title-3 font-medium text-ink-4";
const ICON = "h-3.5 w-3.5";

export function KpiCards({ result }: { result: RiskResult }) {
  const noExposure = result.estimatedCostINR === 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Reveal className="h-full">
        <Card tone="panel" padding="md" className="h-full">
          <div className="flex h-full flex-col gap-5">
            <CardLabel icon={<AlertTriangle className={ICON} aria-hidden="true" />}>
              Risk score
            </CardLabel>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className={METRIC}>
                {result.congestionScore}
                <span className={UNIT}>/100</span>
              </p>
              <RiskBadge level={result.riskLevel} size="sm" />
            </div>
            <MeterBar value={result.congestionScore} tone={result.riskLevel} className="mt-auto" />
          </div>
        </Card>
      </Reveal>

      <Reveal className="h-full" delay={70}>
        <Card tone="panel" padding="md" className="h-full">
          <div className="flex h-full flex-col gap-5">
            <CardLabel icon={<CalendarClock className={ICON} aria-hidden="true" />}>
              Extra dwell
            </CardLabel>
            <div>
              <p className={METRIC}>
                +{result.extraDwellDays}
                <span className={UNIT}>days</span>
              </p>
              <p className="mt-2 text-small text-ink-4">
                {formatDays(result.chargeableDays)} chargeable after{" "}
                {result.rateBreakdown.freeDays} free
              </p>
            </div>
            <Sparkline values={result.port.trend} className="mt-auto h-8" />
          </div>
        </Card>
      </Reveal>

      <Reveal className="h-full" delay={140}>
        <Card tone={noExposure ? "panel" : "accent"} padding="md" className="h-full">
          <div className="flex h-full flex-col gap-5">
            <CardLabel
              icon={<IndianRupee className={ICON} aria-hidden="true" />}
              className={noExposure ? undefined : "text-brand-orange-soft"}
            >
              Est. demurrage
            </CardLabel>
            <p
              className={cn(
                "font-display text-metric font-semibold tabular-nums",
                noExposure ? "text-risk-low" : "text-brand-orange-soft",
              )}
            >
              {formatINR(result.estimatedCostINR)}
            </p>
            <p className="mt-auto text-small text-ink-3">
              {noExposure
                ? `Inside ${result.rateBreakdown.freeDays} free days — no exposure at this forecast`
                : `Range ${formatINR(result.costRange.min)} – ${formatINR(result.costRange.max)}`}
            </p>
          </div>
        </Card>
      </Reveal>

      <Reveal className="h-full sm:col-span-2 xl:col-span-1" delay={210}>
        <Card tone="outline" padding="md" className="h-full">
          <div className="flex h-full flex-col gap-5">
            <CardLabel icon={<Lightbulb className={ICON} aria-hidden="true" />}>
              Recommendation
            </CardLabel>
            <p className="text-body leading-relaxed text-ink-2">{result.recommendation}</p>
            <p className="mt-auto text-label font-semibold uppercase text-ink-4">
              {result.port.code} · confidence {result.confidence}
            </p>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
