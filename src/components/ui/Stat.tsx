import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatTone = "dark" | "light" | "accent";
export type StatSize = "sm" | "md" | "lg";

const VALUE_TONES: Record<StatTone, string> = {
  dark: "text-ink",
  light: "text-graphite",
  accent: "text-brand-orange-soft",
};

const LABEL_TONES: Record<StatTone, string> = {
  dark: "text-ink-3",
  light: "text-graphite-3",
  accent: "text-ink-3",
};

const VALUE_SIZES: Record<StatSize, string> = {
  sm: "text-title-2",
  md: "text-metric",
  lg: "text-display-2",
};

interface StatProps {
  value: ReactNode;
  label: string;
  hint?: string;
  tone?: StatTone;
  size?: StatSize;
  className?: string;
}

export function Stat({ value, label, hint, tone = "dark", size = "md", className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p
        className={cn(
          "font-display font-semibold tabular-nums",
          VALUE_SIZES[size],
          VALUE_TONES[tone],
        )}
      >
        {value}
      </p>
      <p className={cn("text-small font-medium", LABEL_TONES[tone])}>{label}</p>
      {hint && (
        <p className={cn("text-small", tone === "light" ? "text-graphite-3" : "text-ink-4")}>
          {hint}
        </p>
      )}
    </div>
  );
}
