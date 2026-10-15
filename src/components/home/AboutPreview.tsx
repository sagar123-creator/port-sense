import { Photo } from "@/components/ui/Photo";
import { Check } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TextLink } from "@/components/ui/Button";
import { BRAND } from "@/lib/brand";
import { DATA_PROVENANCE } from "@/lib/data/provenance";

const POINTS = [
  "Free for small exporters — no enterprise contract needed",
  "Carrier-agnostic — not locked to a single shipping line",
  "Outputs rupees at risk, not delay jargon",
  `${DATA_PROVENANCE.chip} — JNPT JNPA LDB; other ports ${DATA_PROVENANCE.otherPortsSnapshot}`,
] as const;

export function AboutPreview() {
  return (
    <Section tone="base" width="wide" divider>
      <div className="grid gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
        <div>
          <SectionHeading
            eyebrow="Why we built it"
            title="Enterprise-grade port intelligence, sized for an MSME exporter"
            description={`${BRAND.name} translates "the port is congested" into "here is the money you are about to lose" — before you commit to a booking. ${DATA_PROVENANCE.summary}`}
          />

          <ul className="mt-10 flex flex-col gap-4">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-orange/15 text-brand-orange">
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
                <span className="text-body text-ink-2">{point}</span>
              </li>
            ))}
          </ul>

          <TextLink href="/about" label="Read more about us" className="mt-10">
            More about us
          </TextLink>
        </div>

        <Reveal delay={100}>
          <div className="grid grid-cols-2 gap-3">
            <figure className="relative col-span-2 aspect-[16/9] overflow-hidden rounded-card ring-1 ring-white/8">
              <Photo
                src="/images/hero/jnpt.jpg"
                alt="Container vessel under orange ship-to-shore cranes"
                fill
                sizes="(max-width: 1024px) 92vw, 560px"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(5,11,20,0.8))]" />
              <figcaption className="absolute bottom-4 left-5 text-small font-medium text-white/90">
                JNPT, Navi Mumbai · dwell {DATA_PROVENANCE.jnptDwellMonth}
              </figcaption>
            </figure>
            <div className="relative aspect-[4/3] overflow-hidden rounded-card ring-1 ring-white/8">
              <Photo
                src="/images/sections/crane-horses.jpg"
                alt="Orange terminal equipment against navy container stacks"
                fill
                sizes="(max-width: 1024px) 45vw, 275px"
              />
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-card ring-1 ring-white/8">
              <Photo
                src="/images/sections/big-ship.jpg"
                alt="Container vessel with an orange hull at golden hour"
                fill
                sizes="(max-width: 1024px) 45vw, 275px"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
