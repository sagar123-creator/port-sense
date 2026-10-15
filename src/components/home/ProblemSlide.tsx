import { Photo } from "@/components/ui/Photo";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { SlideFrame } from "@/components/home/SlideFrame";
import { calculateRisk } from "@/lib/demurrageCalc";
import { SAMPLE_INPUT } from "@/lib/data/sample";
import { getPortById } from "@/lib/data/ports";
import { formatDays, formatINR, cn } from "@/lib/utils";
import { DATA_PROVENANCE } from "@/lib/data/provenance";

const FEATURED = ["jnpt", "chennai", "vizag"] as const;

const LINES = [
  "The invoice arrives after the margin is gone.",
  "Enterprise visibility is priced for giants.",
  "Your nearest gate is not always the cheapest wait.",
] as const;

export function ProblemSlide() {
  const cards = FEATURED.map((portId) => {
    const port = getPortById(portId);
    const result = calculateRisk({ ...SAMPLE_INPUT, portId });
    return port && result ? { port, result } : null;
  }).filter((row) => row !== null);

  return (
    <SlideFrame id="problem" index={2} className="bg-surface-0">
      <Photo
        src="/images/hero/gantry.jpg"
        alt="Container vessel with an orange hull at golden hour"
        fill
        sizes="100vw"
        grade="warm"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,15,0.78)_0%,rgba(4,8,15,0.52)_38%,rgba(4,8,15,0.92)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,8,15,0.5)_0%,transparent_58%)]" />

      <span
        aria-hidden="true"
        className="hero-wordmark pointer-events-none absolute inset-x-0 top-[18%] text-center text-[clamp(4.5rem,18vw,14rem)]"
      >
        19%
      </span>

      <Container width="wide" className="relative flex h-full min-h-0 flex-col justify-center pt-20 pb-8">
        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="max-w-2xl">
            <Eyebrow tone="accent">The cost</Eyebrow>
            <h2 className="mt-4 font-semibold text-title-1 text-ink sm:text-display-2">
              Avoidable demurrage is the quiet tax on every MSME export.
            </h2>
            <p className="mt-3 max-w-xl text-body text-ink-2 sm:text-lead">
              India spends roughly 19% of GDP on logistics. A few idle days at a congested
              terminal can erase the profit on an entire consignment. Port Sense prices that wait
              from published baselines ({DATA_PROVENANCE.chip.toLowerCase()}), not a live AIS feed.
            </p>
            <ul className="mt-6 space-y-3">
              {LINES.map((line) => (
                <li key={line} className="flex items-start gap-3 text-small text-ink-2 sm:text-body">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-label font-semibold uppercase tracking-[0.16em] text-ink-4">
              Same 8 × 40ft · MSC
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {cards.map(({ port, result }) => {
                const billing = result.estimatedCostINR > 0;
                return (
                  <li
                    key={port.id}
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-panel border px-4 py-3 backdrop-blur-md",
                      billing
                        ? "border-brand-orange/35 bg-brand-orange/[0.12]"
                        : "border-white/12 bg-surface-0/55",
                    )}
                  >
                    <div>
                      <p className="text-body font-semibold text-ink">{port.name}</p>
                      <p className="mt-0.5 text-label font-semibold uppercase tracking-[0.14em] text-ink-3">
                        +{formatDays(port.extraDwellDays)} extra dwell
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "font-display text-title-2 font-semibold tabular-nums",
                          billing ? "text-brand-orange-soft" : "text-ink",
                        )}
                      >
                        {formatINR(result.estimatedCostINR)}
                      </p>
                      <div className="mt-1 flex justify-end">
                        <RiskBadge level={result.riskLevel} size="sm" />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Container>
    </SlideFrame>
  );
}
