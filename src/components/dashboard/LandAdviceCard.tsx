import { Train, Truck } from "lucide-react";
import { formatINR } from "@/lib/utils";
import type { LandAdvice } from "@/lib/land/types";

interface LandAdviceCardProps {
  advice: LandAdvice;
}

function money(value: number | null): string {
  return value == null ? "pending" : formatINR(value);
}

export function LandAdviceCard({ advice }: LandAdviceCardProps) {
  if (advice.kind === "insufficient") return null;

  return (
    <article className="rounded-card border border-hairline bg-surface-2 px-4 py-4 sm:px-5">
      <p className="text-label font-semibold uppercase tracking-[0.12em] text-brand-orange-soft">
        Land AI · haul then export
      </p>
      <h3 className="mt-2 text-title-3 font-semibold text-ink">{advice.headline}</h3>
      <p className="mt-2 text-small text-ink-2 sm:text-body">{advice.body}</p>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-panel border border-hairline bg-surface-0/40 px-2 py-3">
          <dt className="text-label uppercase text-ink-4">Wait-fee</dt>
          <dd className="mt-1 text-small font-semibold tabular-nums text-ink">
            {money(advice.waitFeeInr)}
          </dd>
        </div>
        <div className="rounded-panel border border-hairline bg-surface-0/40 px-2 py-3">
          <dt className="text-label uppercase text-ink-4">Inland haul</dt>
          <dd className="mt-1 text-small font-semibold tabular-nums text-ink">
            {money(advice.inlandInr)}
          </dd>
        </div>
        <div className="rounded-panel border border-brand-orange/30 bg-brand-orange/10 px-2 py-3">
          <dt className="text-label uppercase text-ink-4">Total</dt>
          <dd className="mt-1 text-small font-semibold tabular-nums text-brand-orange-soft">
            {advice.totalStatus === "complete" ? money(advice.totalInr) : "wait-fee only"}
          </dd>
        </div>
      </dl>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {advice.inland.map((leg) => (
          <li
            key={leg.mode}
            className="flex items-start gap-3 rounded-panel border border-hairline bg-surface-0/40 px-3 py-3"
          >
            {leg.mode === "rail" ? (
              <Train className="mt-0.5 h-4 w-4 shrink-0 text-ink-4" aria-hidden="true" />
            ) : (
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-ink-4" aria-hidden="true" />
            )}
            <div>
              <p className="text-body font-semibold capitalize text-ink">{leg.mode}</p>
              <p className="text-small text-ink-3">
                {leg.fromCityLabel} → {leg.toPortLabel}
              </p>
              <p className="mt-1 text-label uppercase text-ink-4">
                {leg.costInr == null ? "₹ pending data" : formatINR(leg.costInr)}
                {leg.km != null ? ` · ${leg.km} km` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-label text-ink-4">{advice.honestyNote}</p>
    </article>
  );
}
