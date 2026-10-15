import { Photo } from "@/components/ui/Photo";
import { Activity, Radio } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { calculateRisk } from "@/lib/demurrageCalc";
import { getPortById } from "@/lib/data/ports";
import { BRAND } from "@/lib/brand";
import { formatDays, formatINR } from "@/lib/utils";

const PREVIEW_PORT_ID = "jnpt";

/** Fixed so the marketing preview stays deterministic between builds. */
const PREVIEW_SCENARIO = {
  shipDate: "2026-08-20",
  containerType: "40ft",
  carrierId: "msc",
  containerCount: 10,
} as const;

const HERO_STATS = [
  { value: "6", label: "Major Indian ports modelled" },
  { value: "4", label: "Carrier tariffs rate-mapped" },
  { value: "7-day", label: "Rolling congestion outlook" },
  { value: "₹0", label: "Cost for MSME exporters" },
] as const;

export function Hero() {
  const port = getPortById(PREVIEW_PORT_ID);
  const preview = calculateRisk({ portId: PREVIEW_PORT_ID, ...PREVIEW_SCENARIO });

  return (
    <section className="relative isolate overflow-hidden bg-surface-1">
      <Photo
        src="/images/hero/night-port.jpg"
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        grade="night"
        className="scale-105 opacity-[0.32]"
      />
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,rgba(21,34,56,0.55)_0%,rgba(5,11,20,0.9)_65%,var(--surface-1)_100%)]" />
      <div className="grid-lines absolute inset-0" aria-hidden="true" />
      <div
        className="glow-accent absolute left-1/2 top-[42%] h-72 w-[46rem] -translate-x-1/2 opacity-30"
        aria-hidden="true"
      />

      <Container width="wide">
        <div className="relative flex min-h-[100svh] flex-col justify-center pb-16 pt-28 sm:pt-32">
          <div className="flex justify-center">
            <Eyebrow tone="glass" icon={<Radio className="h-3.5 w-3.5" aria-hidden="true" />}>
              SIH 2026 · Demurrage intelligence
            </Eyebrow>
          </div>

          <div className="relative mt-10 sm:mt-12">
            <span
              aria-hidden="true"
              className="hero-wordmark absolute inset-x-0 -top-2 block whitespace-nowrap text-center text-hero sm:-top-4"
            >
              {BRAND.name.toUpperCase()}
            </span>

            <div className="relative mx-auto mt-[14vw] w-full max-w-3xl sm:mt-[9vw] lg:mt-[7vw]">
              <div className="relative aspect-[4/3] overflow-hidden rounded-shell ring-1 ring-white/12 shadow-float sm:aspect-[16/10] lg:aspect-[21/9]">
                <Photo
                  src="/images/hero/night-port.jpg"
                  alt="Night container terminal — vessel alongside gantry cranes under orange floodlight"
                  fill
                  priority
                  sizes="(max-width: 1024px) 92vw, 768px"
                  grade="night"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(5,11,20,0.55)_75%,var(--surface-1)_100%)]" />
              </div>

              {port && (
                <div className="absolute -left-2 top-4 hidden items-center gap-2.5 rounded-full border border-white/12 bg-surface-0/70 px-3 py-2 backdrop-blur-md sm:flex lg:-left-8">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-risk-high/70" />
                    <span className="relative h-2 w-2 rounded-full bg-risk-high" />
                  </span>
                  <span className="text-small font-medium text-ink">
                    {port.code} · {port.congestionScore}/100
                  </span>
                  <RiskBadge level={port.riskLevel} size="sm" />
                </div>
              )}

              {port && (
                <div className="drift absolute -right-2 bottom-8 hidden rounded-panel border border-white/12 bg-surface-0/75 px-4 py-3 backdrop-blur-md lg:block lg:-right-10">
                  <p className="text-label font-semibold uppercase text-ink-4">Extra dwell</p>
                  <p className="mt-1 font-display text-title-2 font-semibold tabular-nums text-ink">
                    +{formatDays(port.extraDwellDays)}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="relative mt-8 grid gap-5 sm:mt-10 lg:-mt-16 lg:grid-cols-[minmax(0,30rem)_1fr_minmax(0,20rem)] lg:items-end">
            <div className="glass-card rounded-card p-6 sm:p-8">
              <h1 className="font-semibold text-title-1 text-ink">
                Know your demurrage risk before you book
              </h1>
              <p className="mt-4 text-body text-ink-2">
                {BRAND.name} predicts congestion at Indian export ports and converts the delay into
                rupees — so small exporters never meet a surprise invoice.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button href="/dashboard" variant="inverse" size="md" withArrow>
                  Check your risk
                </Button>
                <Button href="#how-it-works" variant="ghost" size="md">
                  How it works
                </Button>
              </div>
            </div>

            <div className="hidden lg:block" aria-hidden="true" />

            {port && (
              <div className="glass-card rounded-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-label font-semibold uppercase text-ink-3">Live preview</p>
                  <span className="flex items-center gap-1.5 text-label font-semibold uppercase text-risk-low">
                    <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                    Model online
                  </span>
                </div>
                <dl className="mt-4 flex flex-col">
                  <div className="flex items-baseline justify-between gap-3 border-t border-white/10 py-2.5">
                    <dt className="text-small text-ink-3">Port</dt>
                    <dd className="text-small font-medium text-ink">{port.name}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 border-t border-white/10 py-2.5">
                    <dt className="text-small text-ink-3">Congestion</dt>
                    <dd>
                      <RiskBadge level={port.riskLevel} score={port.congestionScore} size="sm" />
                    </dd>
                  </div>
                  {preview && (
                    <div className="flex items-baseline justify-between gap-3 border-t border-white/10 py-2.5">
                      <dt className="text-small text-ink-3">10 × 40ft exposure</dt>
                      <dd className="text-small font-semibold tabular-nums text-brand-orange-soft">
                        {formatINR(preview.estimatedCostINR)}
                      </dd>
                    </div>
                  )}
                </dl>
                <Button href="/dashboard" variant="primary" size="sm" fullWidth withArrow className="mt-4">
                  Run full check
                </Button>
              </div>
            )}
          </div>

          <dl className="mt-14 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-hairline pt-8 sm:grid-cols-4">
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1.5">
                <dd className="font-display text-title-1 font-semibold tabular-nums text-ink">
                  {stat.value}
                </dd>
                <dt className="text-small text-ink-3">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </section>
  );
}
