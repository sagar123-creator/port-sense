import { Photo } from "@/components/ui/Photo";
import { AlertCircle, Building2, Ship } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";

const PROBLEMS = [
  {
    icon: AlertCircle,
    title: "Surprise demurrage bills",
    body: "Containers sit too long at congested ports — exporters only learn the cost once the invoice arrives.",
  },
  {
    icon: Building2,
    title: "MSMEs lack the tools",
    body: "Enterprise visibility platforms cost lakhs a year. Small exporters rely on forwarders and guesswork.",
  },
  {
    icon: Ship,
    title: "Ports change daily",
    body: "Congestion at JNPT today may be clearer at Cochin or Vizag — timing and routing decide your margin.",
  },
] as const;

export function ProblemStrip() {
  return (
    <Section tone="light" width="wide">
      <div className="grid gap-20 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-20">
        <div>
          <SectionHeading
            tone="light"
            eyebrow="The problem"
            title="Avoidable demurrage quietly erodes every MSME export margin"
            description="India spends roughly 19% of GDP on logistics. For a small exporter, a few idle days at a congested terminal can wipe out the profit on an entire consignment."
          />

          <ul className="mt-12 flex flex-col">
            {PROBLEMS.map(({ icon: Icon, title, body }, index) => (
              <Reveal key={title} delay={index * 90}>
                <li className="flex gap-5 border-t border-hairline-dark py-6">
                  <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-title-3 font-semibold text-graphite">{title}</h3>
                    <p className="mt-1.5 text-body text-graphite-2">{body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ul>

          <Button href="/dashboard" variant="onLight" size="md" withArrow className="mt-10">
            Price your exposure
          </Button>
        </div>

        <Reveal className="relative lg:sticky lg:top-28" delay={120}>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative aspect-[3/4] overflow-hidden rounded-card">
              <Photo
                src="/images/equipment/reachstacker.jpg"
                alt="Orange terminal equipment in a container yard"
                fill
                sizes="(max-width: 1024px) 45vw, 240px"
              />
            </div>
            <div className="flex flex-col gap-3">
              <div className="relative min-h-[8rem] flex-1 overflow-hidden rounded-card">
                <Photo
                  src="/images/equipment/yard.jpg"
                  alt="Aerial of a vessel being worked at a container terminal"
                  fill
                  sizes="(max-width: 1024px) 45vw, 240px"
                />
              </div>
              <div className="relative min-h-[8rem] flex-1 overflow-hidden rounded-card">
                <Photo
                  src="/images/equipment/trucks.jpg"
                  alt="Export trucks on the road in golden hour"
                  fill
                  sizes="(max-width: 1024px) 45vw, 240px"
                />
              </div>
            </div>
          </div>

          <div className="absolute -bottom-7 left-5 max-w-[15rem] rounded-panel border border-hairline-dark bg-surface-light-raised p-4 shadow-soft">
            <p className="font-display text-title-2 font-semibold tabular-nums text-graphite">19%</p>
            <p className="mt-1 text-small text-graphite-2">
              of India&apos;s GDP goes to logistics cost — demurrage is the avoidable slice.
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
