import { ArrowRight, Coins, Gauge, Timer } from "lucide-react";
import { Card, CardLabel } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { Sparkline } from "@/components/ui/Sparkline";
import { calculateRisk } from "@/lib/demurrageCalc";
import { getPortById } from "@/lib/data/ports";
import { formatDays, formatINR } from "@/lib/utils";

const SCENARIO = {
  portId: "jnpt",
  shipDate: "2026-08-20",
  containerType: "40ft",
  carrierId: "msc",
  containerCount: 10,
} as const;

export function CostBridge() {
  const port = getPortById(SCENARIO.portId);
  const result = calculateRisk(SCENARIO);
  if (!port || !result) return null;

  return (
    <Section tone="raised" width="wide" divider>
      <SectionHeading
        eyebrow="Worked example"
        title="Congestion is a signal. Rupees are a decision."
        description={`A live scenario for ${port.name} — ${SCENARIO.containerCount} × 40ft containers priced against published carrier tiers.`}
      />

      <div className="mt-14 grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <Reveal className="h-full">
          <Card tone="outline" padding="md" className="flex h-full flex-col justify-between gap-6">
            <CardLabel icon={<Gauge className="h-3.5 w-3.5" aria-hidden="true" />}>
              Congestion signal
            </CardLabel>
            <div>
              <p className="font-display text-metric font-semibold tabular-nums text-ink">
                {port.congestionScore}
                <span className="text-title-2 text-ink-4">/100</span>
              </p>
              <div className="mt-3 flex items-center gap-3">
                <RiskBadge level={port.riskLevel} size="sm" />
                <span className="text-small text-ink-3">{port.vesselsQueued} vessels queued</span>
              </div>
            </div>
            <Sparkline values={port.trend} />
          </Card>
        </Reveal>

        <div className="hidden items-center justify-center lg:flex" aria-hidden="true">
          <ArrowRight className="h-5 w-5 text-ink-4" />
        </div>

        <Reveal className="h-full" delay={100}>
          <Card tone="outline" padding="md" className="flex h-full flex-col justify-between gap-6">
            <CardLabel icon={<Timer className="h-3.5 w-3.5" aria-hidden="true" />}>
              Predicted extra dwell
            </CardLabel>
            <div>
              <p className="font-display text-metric font-semibold tabular-nums text-ink">
                +{formatDays(result.extraDwellDays)}
              </p>
              <p className="mt-3 text-small text-ink-3">
                {result.chargeableDays > 0
                  ? `${formatDays(result.chargeableDays)} chargeable after free time`
                  : "Still inside carrier free time"}
              </p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-brand-orange/70"
                style={{ width: `${Math.min(100, result.extraDwellDays * 18)}%` }}
              />
            </div>
          </Card>
        </Reveal>

        <div className="hidden items-center justify-center lg:flex" aria-hidden="true">
          <ArrowRight className="h-5 w-5 text-ink-4" />
        </div>

        <Reveal className="h-full" delay={200}>
          <Card tone="accent" padding="md" className="flex h-full flex-col justify-between gap-6">
            <CardLabel icon={<Coins className="h-3.5 w-3.5" aria-hidden="true" />}>
              Rupee exposure
            </CardLabel>
            <div>
              <p className="font-display text-metric font-semibold tabular-nums text-brand-orange-soft">
                {formatINR(result.estimatedCostINR)}
              </p>
              <p className="mt-3 text-small text-ink-3">
                Range {formatINR(result.costRange.min)} – {formatINR(result.costRange.max)}
              </p>
            </div>
            <p className="text-small text-ink-4">Source: {result.sourceCitation}</p>
          </Card>
        </Reveal>
      </div>
    </Section>
  );
}
