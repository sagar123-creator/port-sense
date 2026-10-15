import { Photo } from "@/components/ui/Photo";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SlideFrame } from "@/components/home/SlideFrame";
import { RouteStrip } from "@/components/dashboard/RouteStrip";
import { calculateRisk } from "@/lib/demurrageCalc";
import { SAMPLE_INPUT } from "@/lib/data/sample";
import { getPortById } from "@/lib/data/ports";
import { BRAND } from "@/lib/brand";
import { formatINR } from "@/lib/utils";

export function HeroSlide() {
  const port = getPortById(SAMPLE_INPUT.portId);
  const preview = calculateRisk(SAMPLE_INPUT);
  if (!port || !preview) return null;

  return (
    <SlideFrame id="hero" index={1} className="bg-surface-0">
      <Photo
        src="/images/hero/gantry.jpg"
        alt="Container vessel on the water under terminal cranes"
        fill
        priority
        sizes="100vw"
        grade="night"
        className="object-[center_40%]"
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,8,15,0.82)_0%,rgba(4,8,15,0.45)_48%,rgba(4,8,15,0.28)_100%)]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,15,0.55)_0%,transparent_28%,rgba(4,8,15,0.55)_78%,rgba(4,8,15,0.92)_100%)]"
        aria-hidden="true"
      />

      <Container
        width="wide"
        className="relative flex h-full min-h-0 flex-col justify-center pt-[5.75rem] pb-6 sm:pt-28 sm:pb-8"
      >
        <div className="max-w-xl">
          <p className="text-label font-semibold uppercase tracking-[0.16em] text-brand-orange-soft">
            SIH 2026
          </p>
          <h1 className="mt-4 font-display text-display-2 font-semibold tracking-[-0.04em] text-ink sm:text-display-1">
            {BRAND.name}
          </h1>
          <p className="mt-4 max-w-md text-body text-ink-2 sm:text-lead">
            Your nearest port is not always the cheapest. See the extra wait — and the inland haul —
            in rupees, then pick a better Indian gate before you book.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button href="/dashboard" variant="primary" size="lg" withArrow>
              Compare ports
            </Button>
            <Button href="/25-26" variant="outline" size="lg">
              25/26 cargo
            </Button>
          </div>
        </div>

        <div className="mt-10 grid max-w-3xl gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.7fr)] lg:items-end">
          <RouteStrip
            fromCode="STV"
            fromLabel="Surat"
            toCode="AE JEA"
            toLabel="Jebel Ali"
            fromHint="Start city"
            toHint="Destination"
          />
          <a
            href="/dashboard"
            className="group flex items-end justify-between gap-4 rounded-panel border border-white/14 bg-surface-0/55 px-5 py-4 backdrop-blur-xl transition-colors hover:border-brand-orange/50"
          >
            <div>
              <p className="text-label font-semibold uppercase tracking-[0.14em] text-ink-4">
                Sample · {port.code} · 8 × 40ft
              </p>
              <p className="mt-1 font-display text-[1.85rem] font-semibold leading-none tabular-nums tracking-[-0.04em] text-brand-orange-soft">
                {formatINR(preview.estimatedCostINR)}
              </p>
            </div>
            <p className="text-label font-semibold uppercase tracking-[0.1em] text-ink-3 group-hover:text-ink">
              Run it →
            </p>
          </a>
        </div>
      </Container>
    </SlideFrame>
  );
}
