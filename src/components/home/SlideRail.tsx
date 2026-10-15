"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const SLIDES = [
  { id: "hero", label: "Open" },
  { id: "problem", label: "The cost" },
  { id: "method", label: "Method" },
  { id: "proof", label: "Proof" },
] as const;

export function SlideRail() {
  const [active, setActive] = useState("hero");

  useEffect(() => {
    const nodes = SLIDES.map((slide) => document.getElementById(slide.id)).filter(
      (node): node is HTMLElement => node !== null,
    );
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { threshold: [0.45, 0.6, 0.75] },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="Page sections"
      className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 lg:block"
    >
      <ul className="flex flex-col items-center gap-3">
        {SLIDES.map((slide, index) => {
          const isActive = active === slide.id;
          return (
            <li key={slide.id}>
              <a
                href={`#${slide.id}`}
                aria-label={slide.label}
                aria-current={isActive ? "true" : undefined}
                className="group flex items-center gap-3"
              >
                <span
                  className={cn(
                    "text-label font-semibold uppercase tracking-[0.18em] transition-opacity duration-300",
                    isActive ? "text-brand-orange-soft opacity-100" : "opacity-0 group-hover:opacity-70",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "block rounded-full transition-all duration-500 ease-[var(--ease-out-quint)]",
                    isActive
                      ? "h-8 w-1.5 bg-brand-orange"
                      : "h-2.5 w-1.5 bg-white/25 group-hover:bg-white/55",
                  )}
                />
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
