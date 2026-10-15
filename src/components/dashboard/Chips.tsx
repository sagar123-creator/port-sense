import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryChipProps {
  label: string;
  value: string;
  icon?: ReactNode;
}

export function SummaryChip({ label, value, icon }: SummaryChipProps) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 rounded-full border border-hairline bg-white/[0.03] px-3 py-1.5">
      {icon}
      <span className="text-label font-semibold uppercase text-ink-4">{label}</span>
      <span className="truncate text-small font-medium text-ink-2">{value}</span>
    </span>
  );
}

interface DeltaChipProps {
  delta: number;
  suffix?: string;
  className?: string;
}

const RISING = "border-risk-high/25 bg-risk-high/10 text-risk-high";
const FALLING = "border-risk-low/25 bg-risk-low/10 text-risk-low";
const FLAT = "border-hairline bg-white/[0.03] text-ink-3";

export function DeltaChip({ delta, suffix = "pts", className }: DeltaChipProps) {
  const rounded = Math.round(delta * 10) / 10;
  const Icon = rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : Minus;
  const tone = rounded > 0 ? RISING : rounded < 0 ? FALLING : FLAT;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-small font-semibold tabular-nums",
        tone,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {rounded > 0 ? `+${rounded}` : rounded}
      <span className="font-medium opacity-70">{suffix}</span>
    </span>
  );
}
