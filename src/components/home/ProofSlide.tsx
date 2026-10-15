import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SlideFrame } from "@/components/home/SlideFrame";
import { SAMPLE_INPUT } from "@/lib/data/sample";
import { compareAllPorts } from "@/lib/demurrageCalc";
import { cn, formatDays, formatINR } from "@/lib/utils";

export function ProofSlide() {
  const rows = compareAllPorts({
    shipDate: SAMPLE_INPUT.shipDate,
    containerType: SAMPLE_INPUT.containerType,
    carrierId: SAMPLE_INPUT.carrierId,
    containerCount: SAMPLE_INPUT.containerCount,
  }).sort((a, b) => b.port.extraDwellDays - a.port.extraDwellDays);

  const maxDwell = Math.max(...rows.map((row) => row.port.extraDwellDays), 1);

  return (
    <SlideFrame id="proof" index={4} className="bg-surface-1">
      <Container
        width="wide"
        className="relative flex h-full min-h-0 flex-col justify-center pt-24 pb-10"
      >
        <h2 className="max-w-xl font-semibold text-title-1 text-ink sm:text-display-2">
          Extra dwell, five gates.
        </h2>
        <p className="mt-3 max-w-xl text-body text-ink-3">
          Illustrative home sample. Dashboard uses published extra dwell priced in rupees.
        </p>

        <ul className="mt-10 flex flex-col">
          {rows.map(({ port, result }) => {
            const selected = port.id === SAMPLE_INPUT.portId;
            const billing = (result?.estimatedCostINR ?? 0) > 0;
            const width = Math.max(6, (port.extraDwellDays / maxDwell) * 100);

            return (
              <li
                key={port.id}
                className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-5 border-t border-white/8 py-4 last:border-b sm:grid-cols-[11rem_1fr_8rem] sm:gap-8"
              >
                <p className={cn("text-body font-medium", selected ? "text-ink" : "text-ink-2")}>
                  {port.name}
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div
                    className={cn("h-full rounded-full", billing ? "bg-brand-orange" : "bg-white/30")}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <p
                  className={cn(
                    "text-right text-small tabular-nums sm:text-body",
                    billing ? "font-semibold text-brand-orange-soft" : "text-ink-3",
                  )}
                >
                  +{formatDays(port.extraDwellDays)}
                  <span className="ml-4 hidden sm:inline">
                    {result ? formatINR(result.estimatedCostINR) : "—"}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>

        <div className="mt-10">
          <Button href="/dashboard" variant="primary" size="lg" withArrow>
            Change the inputs
          </Button>
        </div>
      </Container>
    </SlideFrame>
  );
}
