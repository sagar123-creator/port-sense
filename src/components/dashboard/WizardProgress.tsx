"use client";

import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "From / to" },
  { id: 2, label: "Cargo" },
  { id: 3, label: "Best ports" },
] as const;

interface WizardProgressProps {
  step: 1 | 2 | 3;
  onJump?: (step: 1 | 2 | 3) => void;
  allowJumpTo?: number;
}

export function WizardProgress({ step, onJump, allowJumpTo = 1 }: WizardProgressProps) {
  return (
    <nav aria-label="Shipment steps" className="w-full">
      <ol className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {STEPS.map((item) => {
          const active = item.id === step;
          const done = item.id < step;
          const canJump = item.id <= allowJumpTo && onJump;
          return (
            <li key={item.id}>
              <button
                type="button"
                disabled={!canJump}
                onClick={() => canJump && onJump(item.id as 1 | 2 | 3)}
                className={cn(
                  "flex w-full flex-col items-center gap-1.5 rounded-panel border px-2 py-2.5 text-center transition-colors sm:py-3",
                  active && "border-brand-orange/50 bg-brand-orange/10",
                  done && !active && "border-hairline bg-white/[0.04]",
                  !active && !done && "border-hairline bg-surface-2/60 opacity-70",
                  canJump && "cursor-pointer hover:border-white/25",
                  !canJump && "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-small font-semibold",
                    active && "bg-brand-orange text-white",
                    done && !active && "bg-risk-low/20 text-risk-low",
                    !active && !done && "bg-white/10 text-ink-4",
                  )}
                >
                  {item.id}
                </span>
                <span
                  className={cn(
                    "text-[0.65rem] font-semibold uppercase tracking-[0.08em] sm:text-label",
                    active ? "text-ink" : "text-ink-4",
                  )}
                >
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
