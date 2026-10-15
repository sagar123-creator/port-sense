import { Photo } from "@/components/ui/Photo";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";

const STEPS = [
  {
    step: "01",
    title: "Predict congestion",
    body: "Port traffic, vessel queues and historical dwell times are modelled into a single congestion score per port.",
    image: "/images/hero/gantry.jpg",
    alt: "Container vessel with an orange hull at golden hour",
  },
  {
    step: "02",
    title: "Convert to rupees",
    body: "Predicted delay is priced against published carrier demurrage tiers to give your exposure in ₹.",
    image: "/images/equipment/yard.jpg",
    alt: "Containers stacked in a terminal yard",
  },
  {
    step: "03",
    title: "Act before booking",
    body: "You get a risk band, your start gate vs a better gate on demurrage, and one plain instruction. Inland haul is not priced yet.",
    image: "/images/equipment/trucks.jpg",
    alt: "Cargo moving at an Indian container port",
  },
] as const;

export function HowItWorks() {
  return (
    <Section id="how-it-works" tone="base" width="wide" divider>
      <SectionHeading
        eyebrow="How it works"
        title="Three steps from port noise to a booking decision"
        description="No dashboards to learn and no enterprise onboarding — pick a start city, pick a destination, read the number."
        action={
          <Button href="/dashboard" variant="outline" size="md" withArrow>
            Open the dashboard
          </Button>
        }
      />

      <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-7">
        {STEPS.map(({ step, title, body, image, alt }, index) => (
          <Reveal key={step} delay={index * 110}>
            <article className="group">
              <div className="relative aspect-[4/3] overflow-hidden rounded-card ring-1 ring-white/8">
                <Photo
                  src={image}
                  alt={alt}
                  fill
                  sizes="(max-width: 768px) 92vw, 380px"
                  className="opacity-90 transition-transform duration-700 ease-[var(--ease-out-quint)] group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,11,20,0.15),rgba(5,11,20,0.75))]" />
                <span className="absolute left-5 top-4 font-display text-title-1 font-semibold tabular-nums text-white/85">
                  {step}
                </span>
              </div>
              <div className="mt-6 border-t border-hairline pt-5">
                <h3 className="text-title-2 font-semibold text-ink">{title}</h3>
                <p className="mt-3 text-body text-ink-3">{body}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
