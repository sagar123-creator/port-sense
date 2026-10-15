import { Photo } from "@/components/ui/Photo";
import { BarChart3, Bell, GitCompare, Shield } from "lucide-react";
import { PageStage } from "@/components/layout/PageStage";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { BRAND } from "@/lib/brand";
import { DATA_PROVENANCE } from "@/lib/data/provenance";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Services",
  description: `Risk scoring, rupee estimates, port comparison and alerts — what ${BRAND.name} offers MSME exporters. ${DATA_PROVENANCE.chip}.`,
};

const SERVICES = [
  {
    icon: Shield,
    title: "Risk score",
    body: `Low / Medium / High from congestion, queues and published dwell (${DATA_PROVENANCE.jnptDwellMonth} JNPT · ${DATA_PROVENANCE.otherPortsSnapshot} other gates).`,
    status: "Live",
    image: "/images/hero/night-port.jpg",
    alt: "Night operations at a container terminal",
  },
  {
    icon: BarChart3,
    title: "Rupee estimate",
    body: `Tiered demurrage against verified carrier tariffs (${DATA_PROVENANCE.tariffWindow}), with the source cited.`,
    status: "Live",
    image: "/images/hero/container-yard.jpg",
    alt: "Aerial container stacks in a port yard",
  },
  {
    icon: GitCompare,
    title: "Port compare",
    body: "Five Indian gateways ranked on the same shipment — cheapest wait first. Start city vs better gate.",
    status: "Live",
    image: "/images/sections/crane-horses.jpg",
    alt: "Orange terminal equipment against navy container stacks",
  },
  {
    icon: Bell,
    title: "WhatsApp share",
    body: "Send the rupee number to a forwarder. Threshold alerts are next.",
    status: "Live / next",
    image: "/images/equipment/trucks.jpg",
    alt: "Container trucks moving export cargo",
  },
] as const;

const COMPARISON = [
  { label: "Cost to an MSME", enterprise: "Lakhs / year", ours: "Free" },
  { label: "Onboarding", enterprise: "Weeks", ours: "Open the dashboard" },
  { label: "Carriers", enterprise: "Often one line", ours: "Agnostic" },
  { label: "Output", enterprise: "Delay dashboards", ours: "Rupees + one action" },
] as const;

export default function ServicesPage() {
  return (
    <>
      <PageStage
        index="01"
        eyebrow="Services"
        title="Four capabilities. One question: what will the wait cost?"
        subtitle={`${BRAND.name} stays small on purpose — score, price, compare, share. ${DATA_PROVENANCE.chip}.`}
        image="/images/hero/gantry.jpg"
        alt="Container vessel with an orange hull at golden hour"
        actions={
          <Button href="/dashboard" variant="primary" size="lg" withArrow>
            Run a sample booking
          </Button>
        }
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map(({ icon: Icon, title, body, status, image, alt }) => (
            <li key={title} className="overflow-hidden rounded-card border border-hairline bg-surface-0/55 backdrop-blur-md">
              <div className="relative aspect-[16/9]">
                <Photo src={image} alt={alt} fill sizes="280px" className="opacity-90" />
                <span
                  className={cn(
                    "absolute right-3 top-3 rounded-full border px-2 py-0.5 text-label font-semibold uppercase backdrop-blur-md",
                    status.startsWith("Live")
                      ? "border-risk-low/40 bg-surface-0/70 text-risk-low"
                      : "border-hairline bg-surface-0/70 text-ink-2",
                  )}
                >
                  {status}
                </span>
              </div>
              <div className="p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange-soft">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <h2 className="mt-3 text-title-3 font-semibold text-ink">{title}</h2>
                <p className="mt-1.5 text-small text-ink-3">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </PageStage>

      <section className="relative isolate min-h-svh overflow-hidden bg-surface-1">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-40" aria-hidden="true" />
        <span
          aria-hidden="true"
          className="slide-index pointer-events-none absolute bottom-6 left-6 text-[3.25rem] text-white/18 sm:left-10"
        >
          02
        </span>
        <Container width="wide" className="relative flex min-h-svh flex-col justify-center py-28">
          <Eyebrow tone="accent">Why it fits an MSME</Eyebrow>
          <h2 className="mt-5 max-w-2xl font-semibold text-display-2 text-ink">
            Enterprise platforms solve a different problem, for a different budget.
          </h2>
          <div className="mt-10 overflow-hidden rounded-card border border-hairline">
            <div className="hidden grid-cols-[1.2fr_1fr_1fr] gap-6 border-b border-hairline px-6 py-4 sm:grid">
              <span className="text-label font-semibold uppercase text-ink-4">Dimension</span>
              <span className="text-label font-semibold uppercase text-ink-4">Enterprise</span>
              <span className="text-label font-semibold uppercase text-brand-orange-soft">
                {BRAND.name}
              </span>
            </div>
            {COMPARISON.map((row) => (
              <div
                key={row.label}
                className="grid gap-1 border-b border-hairline px-6 py-5 last:border-0 sm:grid-cols-[1.2fr_1fr_1fr] sm:gap-6"
              >
                <p className="text-body font-medium text-ink">{row.label}</p>
                <p className="text-body text-ink-3">{row.enterprise}</p>
                <p className="text-body font-semibold text-brand-orange-soft">{row.ours}</p>
              </div>
            ))}
          </div>
          <Button href="/contact" variant="outline" size="md" withArrow className="mt-8">
            Request a lane
          </Button>
        </Container>
      </section>
    </>
  );
}
