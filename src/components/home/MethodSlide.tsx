import { Photo } from "@/components/ui/Photo";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { SlideFrame } from "@/components/home/SlideFrame";
import { DATA_PROVENANCE } from "@/lib/data/provenance";

const STEPS = [
  {
    step: "01",
    title: "Sense congestion",
    body: `Start from your city. Queues and published dwell (JNPT ${DATA_PROVENANCE.jnptDwellMonth}; other ports ${DATA_PROVENANCE.otherPortsSnapshot}) collapse into one score per Indian export gate.`,
    image: "/images/hero/gantry.jpg",
    alt: "Container vessel with an orange hull at golden hour",
  },
  {
    step: "02",
    title: "Price it in rupees",
    body: `Predicted delay runs against verified carrier tiers (${DATA_PROVENANCE.tariffWindow}), free days and your box count.`,
    image: "/images/hero/jnpt.jpg",
    alt: "Low-angle vessel under orange ship-to-shore cranes",
  },
  {
    step: "03",
    title: "Act before booking",
    body: "If the nearest gate is costly, we show a cheaper Indian origin plus the inland haul in rupees.",
    image: "/images/hero/container-yard.jpg",
    alt: "Aerial of a vessel being worked at a geometric container terminal",
  },
] as const;

export function MethodSlide() {
  return (
    <SlideFrame id="method" index={3} className="bg-surface-1">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" aria-hidden="true" />
      <div className="glow-accent pointer-events-none absolute left-1/2 top-1/3 h-72 w-[36rem] -translate-x-1/2 opacity-25" />

      <Container
        width="wide"
        className="relative flex h-full min-h-0 flex-col pt-20 pb-8 sm:pt-24"
      >
        <div className="flex shrink-0 flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <Eyebrow tone="accent">Method</Eyebrow>
            <h2 className="mt-4 font-semibold text-title-1 text-ink sm:text-display-2">
              Sense it. Price it. Book with the number.
            </h2>
          </div>
          <p className="max-w-sm text-body text-ink-3">
            No onboarding. No lakhs-a-year platform. Pick a port, pick a box, read the rupees.
            Data period: {DATA_PROVENANCE.chip}.
          </p>
        </div>

        <ol className="relative mt-6 grid min-h-0 flex-1 gap-3 md:grid-cols-3">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-[16%] right-[16%] top-[22%] hidden h-px bg-gradient-to-r from-transparent via-brand-orange/55 to-transparent md:block"
          />
          {STEPS.map(({ step, title, body, image, alt }) => (
            <li
              key={step}
              className="group relative flex min-h-[16rem] overflow-hidden rounded-shell ring-1 ring-white/12"
            >
              <Photo
                src={image}
                alt={alt}
                fill
                sizes="(max-width: 768px) 92vw, 420px"
                className="transition-transform duration-700 ease-[var(--ease-out-quint)] group-hover:scale-[1.05]"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,15,0.15)_0%,rgba(4,8,15,0.35)_40%,rgba(4,8,15,0.92)_100%)]" />
              <div className="relative z-10 flex w-full flex-col justify-between p-5 sm:p-6">
                <span className="slide-index text-[2.75rem] leading-none text-brand-orange-soft">
                  {step}
                </span>
                <div>
                  <h3 className="text-title-2 font-semibold text-ink">{title}</h3>
                  <p className="mt-2 max-w-xs text-small text-ink-2 sm:text-body">{body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </SlideFrame>
  );
}
