import type { RiskLevel } from "@/types";
import { cn } from "@/lib/utils";

export type MeterTone = RiskLevel | "accent";

const FILLS: Record<MeterTone, string> = {
  low: "bg-risk-low",
  medium: "bg-risk-med",
  high: "bg-risk-high",
  accent: "bg-brand-orange",
};

interface MeterBarProps {
  value: number;
  max?: number;
  tone?: MeterTone;
  className?: string;
}

export function MeterBar({ value, max = 100, tone = "accent", className }: MeterBarProps) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <span
      className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-white/8", className)}
      aria-hidden="true"
    >
      <span
        className={cn(
          "block h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-quint)]",
          FILLS[tone],
        )}
        style={{ width: `${percent}%` }}
      />
    </span>
  );
}
