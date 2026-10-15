"use client";

import { useId, useState } from "react";
import { ChevronDown, ReceiptIndianRupee } from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import type { RiskResult } from "@/types";
import { Card, CardLabel } from "@/components/ui/Card";

interface RowProps {
  label: string;
  value: string;
  muted?: boolean;
}

function BreakdownRow({ label, value, muted = false }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-2.5 last:border-b-0">
      <span className={cn("text-small", muted ? "text-ink-4" : "text-ink-3")}>{label}</span>
      <span
        className={cn(
          "text-body tabular-nums",
          muted ? "text-ink-3" : "font-medium text-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function RateBreakdown({
  result,
  defaultOpen = false,
}: {
  result: RiskResult;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <Card tone="panel" padding="none">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors duration-300 hover:bg-white/[0.03] sm:px-7 sm:py-6"
      >
        <span className="flex flex-col gap-2">
          <CardLabel icon={<ReceiptIndianRupee className="h-3.5 w-3.5" aria-hidden="true" />}>
            Rate breakdown
          </CardLabel>
          <span className="text-title-3 font-semibold text-ink">How this ₹ figure is built</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-ink-3 transition-transform duration-500 ease-[var(--ease-out-quint)]",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      <div
        id={panelId}
        aria-hidden={!open}
        className={cn(
          "grid transition-all duration-500 ease-[var(--ease-out-quint)]",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-hairline px-5 py-5 sm:px-7 sm:py-6">
            <BreakdownRow
              label="Free days included"
              value={`${result.rateBreakdown.freeDays} days`}
            />
            {result.rateBreakdown.tiers.map((tier, index) => (
              <BreakdownRow
                key={`day-${index + 1}`}
                label={`Day ${index + 1} after free time`}
                value={formatINR(tier.subtotal)}
              />
            ))}
            {result.chargeableDays > 5 && (
              <BreakdownRow label="Additional tiered days" value="…" muted />
            )}

            <div className="mt-4 flex items-baseline justify-between gap-4 rounded-panel border border-brand-orange/25 bg-brand-orange/10 px-4 py-3">
              <span className="text-label font-semibold uppercase text-ink-3">
                Total estimate
              </span>
              <span className="font-display text-title-2 font-semibold tabular-nums text-brand-orange-soft">
                {formatINR(result.rateBreakdown.total)}
              </span>
            </div>

            <p className="mt-4 text-small text-ink-4">Source: {result.sourceCitation}</p>
            <p className="text-small text-ink-4">{result.explanation}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
