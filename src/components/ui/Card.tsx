import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CardTone = "glass" | "panel" | "outline" | "light" | "accent";
export type CardPadding = "none" | "sm" | "md" | "lg";
export type CardRadius = "panel" | "card" | "shell";

const TONES: Record<CardTone, string> = {
  glass: "glass-card",
  panel: "panel-sheen border border-hairline",
  outline: "border border-hairline bg-white/[0.02]",
  light: "border border-hairline-dark bg-surface-light-raised shadow-soft",
  accent:
    "border border-brand-orange/25 bg-[linear-gradient(160deg,rgba(232,98,26,0.16),rgba(232,98,26,0.03)_58%,transparent)]",
};

const PADDINGS: Record<CardPadding, string> = {
  none: "",
  sm: "p-4 sm:p-5",
  md: "p-5 sm:p-7",
  lg: "p-6 sm:p-9",
};

const RADII: Record<CardRadius, string> = {
  panel: "rounded-panel",
  card: "rounded-card",
  shell: "rounded-shell",
};

interface CardProps {
  children: ReactNode;
  tone?: CardTone;
  padding?: CardPadding;
  radius?: CardRadius;
  interactive?: boolean;
  className?: string;
}

export function Card({
  children,
  tone = "panel",
  padding = "md",
  radius = "card",
  interactive = false,
  className,
}: CardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        RADII[radius],
        TONES[tone],
        PADDINGS[padding],
        interactive &&
          "transition-all duration-500 ease-[var(--ease-out-quint)] hover:-translate-y-1 hover:shadow-float",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface CardLabelProps {
  children: ReactNode;
  icon?: ReactNode;
  tone?: "dark" | "light";
  className?: string;
}

export function CardLabel({ children, icon, tone = "dark", className }: CardLabelProps) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 text-label font-semibold uppercase",
        tone === "dark" ? "text-ink-3" : "text-graphite-3",
        className,
      )}
    >
      {icon}
      {children}
    </p>
  );
}
