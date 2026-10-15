import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SlideFrameProps {
  id: string;
  index: number;
  children: ReactNode;
  className?: string;
}

export function SlideFrame({ id, index, children, className }: SlideFrameProps) {
  return (
    <section id={id} className={cn("slide relative isolate", className)}>
      <span
        aria-hidden="true"
        className="slide-index pointer-events-none absolute bottom-5 left-5 z-20 text-[3.25rem] text-white/18 sm:bottom-8 sm:left-10 sm:text-[4.5rem]"
      >
        {String(index).padStart(2, "0")}
      </span>
      {children}
    </section>
  );
}
