import { PORTS } from "@/lib/data/ports";

const TRACK = [...PORTS, ...PORTS];

export function PortMarquee() {
  return (
    <section className="border-y border-hairline bg-surface-0/60 py-6">
      <div className="flex flex-col items-center gap-5 lg:flex-row lg:gap-10">
        <p className="shrink-0 px-5 text-label font-semibold uppercase text-ink-4 lg:pl-10">
          Live congestion modelling at
        </p>
        <div
          className="relative w-full overflow-hidden"
          style={{
            maskImage: "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)",
            WebkitMaskImage: "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)",
          }}
        >
          <ul className="marquee-track flex w-max items-center">
            {TRACK.map((port, index) => (
              <li
                key={`${port.id}-${index}`}
                className="flex shrink-0 items-center gap-3 px-6"
                aria-hidden={index >= PORTS.length ? "true" : undefined}
              >
                <span className="font-display text-title-3 font-medium text-ink-2">
                  {port.name}
                </span>
                <span className="text-small font-medium tabular-nums text-ink-4">{port.code}</span>
                <span className="h-1 w-1 rounded-full bg-brand-orange/60" aria-hidden="true" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
