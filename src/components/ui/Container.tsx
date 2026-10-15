import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ContainerWidth = "narrow" | "prose" | "default" | "wide";

const WIDTHS: Record<ContainerWidth, string> = {
  narrow: "max-w-3xl",
  prose: "max-w-4xl",
  default: "max-w-6xl",
  wide: "max-w-[84rem]",
};

interface ContainerProps {
  children: ReactNode;
  width?: ContainerWidth;
  className?: string;
}

export function Container({ children, width = "wide", className }: ContainerProps) {
  return (
    <div className={cn("mx-auto w-full px-5 sm:px-7 lg:px-10", WIDTHS[width], className)}>
      {children}
    </div>
  );
}
