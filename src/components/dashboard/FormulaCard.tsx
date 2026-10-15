import type { RiskMath } from "@/lib/demurrageCalc";
import { formatINR } from "@/lib/utils";
import type { RiskInput } from "@/types";
import { Card, CardLabel } from "@/components/ui/Card";

const BOX_LABEL: Record<string, string> = {
  "20ft": "20 ft",
  "40ft": "40 ft",
  "40hc": "40 ft HC",
};

export function FormulaCard({
  input,
  math: mathProp,
}: {
  input: RiskInput;
  math?: RiskMath | null;
}) {
  if (!mathProp) {
    return (
      <Card tone="outline" padding="md">
        <CardLabel>How the rupees are built</CardLabel>
        <p className="mt-3 text-small text-ink-3">Waiting for Layer-3 math from the API.</p>
      </Card>
    );
  }

  const math = mathProp;
  const insideFreeTime = math.billedDays === 0;

  return (
    <Card tone="outline" padding="md">
      <CardLabel>How the rupees are built</CardLabel>
      <ol className="mt-4 flex flex-col gap-3">
        <li className="flex items-baseline justify-between gap-4 border-b border-hairline pb-3">
          <span className="text-small text-ink-3">Extra dwell vs free time</span>
          <span className="text-small font-medium tabular-nums text-ink">
            +{math.extraDwellDays}d over {math.freeDays}d free
          </span>
        </li>
        <li className="flex items-baseline justify-between gap-4 border-b border-hairline pb-3">
          <span className="text-small text-ink-3">Billed days (ceiled)</span>
          <span className="text-small font-medium tabular-nums text-ink">{math.billedDays}</span>
        </li>
        <li className="flex items-baseline justify-between gap-4 border-b border-hairline pb-3">
          <span className="text-small text-ink-3">
            {BOX_LABEL[input.containerType] ?? input.containerType} day-1 rate
          </span>
          <span className="text-small font-medium tabular-nums text-ink">
            {formatINR(math.dayOneRateINR)}
          </span>
        </li>
        <li className="flex items-baseline justify-between gap-4">
          <span className="text-small text-ink-3">× {math.containerCount} containers</span>
          <span className="font-display text-title-3 font-semibold tabular-nums text-brand-orange-soft">
            {formatINR(math.estimatedCostINR)}
          </span>
        </li>
      </ol>
      <p className="mt-4 text-small text-ink-4">
        {insideFreeTime
          ? "Still inside carrier free time — estimated demurrage is zero on this forecast."
          : `Layer 3 slab math on Layer 2 verified tariffs × ${math.containerCount} containers.`}
      </p>
    </Card>
  );
}
