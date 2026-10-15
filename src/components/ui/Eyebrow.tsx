import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EyebrowTone = "accent" | "neutral" | "light" | "glass";

const TONES: Record<EyebrowTone, string> = {
  accent: "border-brand-orange/30 bg-brand-orange/12 text-brand-orange-soft",
  neutral: "border-hairline-strong bg-white/[0.04] text-ink-2",
  light: "border-brand-orange/25 bg-brand-orange/10 text-brand-orange",
  glass: "border-white/15 bg-white/10 text-white backdrop-blur-md",
};

interface EyebrowProps {
  children: ReactNode;
  tone?: EyebrowTone;
  icon?: ReactNode;
  className?: string;
}

export function Eyebrow({ children, tone = "accent", icon, className }: EyebrowProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-label font-semibold uppercase",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
