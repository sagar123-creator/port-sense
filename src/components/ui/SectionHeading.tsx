import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Eyebrow, type EyebrowTone } from "@/components/ui/Eyebrow";

export type HeadingTone = "dark" | "light";
export type HeadingAlign = "start" | "center";
export type HeadingSize = "lg" | "xl";

interface SectionHeadingProps {
  title: ReactNode;
  eyebrow?: string;
  description?: ReactNode;
  tone?: HeadingTone;
  align?: HeadingAlign;
  size?: HeadingSize;
  action?: ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
}

const EYEBROW_TONE: Record<HeadingTone, EyebrowTone> = {
  dark: "accent",
  light: "light",
};

export function SectionHeading({
  title,
  eyebrow,
  description,
  tone = "dark",
  align = "start",
  size = "lg",
  action,
  as: Heading = "h2",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        align === "center" ? "items-center text-center" : "items-start",
        action && "lg:flex-row lg:items-end lg:justify-between lg:gap-10",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-5",
          align === "center" ? "items-center" : "items-start",
          action && "lg:max-w-2xl",
        )}
      >
        {eyebrow && <Eyebrow tone={EYEBROW_TONE[tone]}>{eyebrow}</Eyebrow>}
        <Heading
          className={cn(
            "font-semibold",
            size === "xl" ? "text-display-2" : "text-title-1",
            tone === "dark" ? "text-ink" : "text-graphite",
          )}
        >
          {title}
        </Heading>
        {description && (
          <p
            className={cn(
              "max-w-2xl text-lead",
              tone === "dark" ? "text-ink-2" : "text-graphite-2",
            )}
          >
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
