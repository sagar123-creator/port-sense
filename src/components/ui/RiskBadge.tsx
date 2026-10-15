import type { RiskLevel } from "@/types";
import { cn } from "@/lib/utils";

export type RiskBadgeSize = "sm" | "md";

const STYLES: Record<RiskLevel, string> = {
  low: "border-risk-low/30 bg-risk-low/12 text-risk-low",
  medium: "border-risk-med/30 bg-risk-med/12 text-risk-med",
  high: "border-risk-high/30 bg-risk-high/12 text-risk-high",
};

const DOTS: Record<RiskLevel, string> = {
  low: "bg-risk-low",
  medium: "bg-risk-med",
  high: "bg-risk-high",
};

const LABELS: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const SIZES: Record<RiskBadgeSize, string> = {
  sm: "gap-1.5 px-2 py-0.5 text-[0.6875rem]",
  md: "gap-2 px-2.5 py-1 text-small",
};

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  size?: RiskBadgeSize;
  className?: string;
}

export function RiskBadge({ level, score, size = "md", className }: RiskBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold tracking-[-0.005em]",
        STYLES[level],
        SIZES[size],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[level])} aria-hidden="true" />
      {LABELS[level]}
      {score !== undefined && (
        <span className="font-medium tabular-nums opacity-70">{score}</span>
      )}
    </span>
  );
}
