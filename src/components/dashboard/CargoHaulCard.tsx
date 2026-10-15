import { formatINR } from "@/lib/utils";
import type { CargoHaulResult } from "@/lib/land/cargoCost.service";

interface CargoHaulCardProps {
  haul: CargoHaulResult;
  seaKm: number | null;
}

export function CargoHaulCard({ haul, seaKm }: CargoHaulCardProps) {
  return (
    <article className="rounded-card border border-hairline bg-surface-2 px-4 py-4 sm:px-5">
      <p className="text-label font-semibold uppercase tracking-[0.12em] text-brand-orange-soft">
        Inland cargo · road / rail
      </p>
      <h3 className="mt-2 text-title-3 font-semibold text-ink">
        {haul.fromLabel} → {haul.toLabel}
      </h3>
      <p className="mt-1 text-small text-ink-3">
        {haul.km.toLocaleString("en-IN")} km · {haul.tonnes} t
        {seaKm != null ? ` · sea ~${seaKm.toLocaleString("en-IN")} km` : ""}
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {haul.quotes.map((row) => (
          <li key={row.mode} className="rounded-panel border border-hairline bg-surface-0/40 px-3 py-3">
            <p className="text-label uppercase text-ink-4">{row.label}</p>
            <p className="mt-1 text-body font-semibold tabular-nums text-ink">
              {formatINR(row.predictedCostInr)}
            </p>
            <p className="mt-1 text-label text-ink-4">
              Rate table {formatINR(row.baselineCostInr)} · ₹{row.ratePtpk}/t-km
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}
