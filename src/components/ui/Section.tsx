import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Container, type ContainerWidth } from "@/components/ui/Container";

export type SectionTone = "deep" | "base" | "raised" | "light";
export type SectionSpace = "tight" | "default" | "loose";

const TONES: Record<SectionTone, string> = {
  deep: "bg-surface-0 text-ink",
  base: "bg-surface-1 text-ink",
  raised: "bg-surface-2 text-ink",
  light: "bg-surface-light text-graphite",
};

const SPACES: Record<SectionSpace, string> = {
  tight: "py-[clamp(3rem,5vw,4.5rem)]",
  default: "py-[clamp(4.5rem,8vw,8rem)]",
  loose: "py-[clamp(6rem,11vw,11rem)]",
};

interface SectionProps {
  children: ReactNode;
  id?: string;
  tone?: SectionTone;
  space?: SectionSpace;
  width?: ContainerWidth;
  divider?: boolean;
  className?: string;
  innerClassName?: string;
}

export function Section({
  children,
  id,
  tone = "base",
  space = "default",
  width = "wide",
  divider = false,
  className,
  innerClassName,
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative",
        TONES[tone],
        SPACES[space],
        divider && (tone === "light" ? "border-t border-hairline-dark" : "border-t border-hairline"),
        className,
      )}
    >
      <Container width={width} className={innerClassName}>
        {children}
      </Container>
    </section>
  );
}
