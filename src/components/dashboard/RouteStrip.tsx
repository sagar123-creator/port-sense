import { Ship } from "lucide-react";
import { cn } from "@/lib/utils";

interface RouteStripProps {
  fromCode: string;
  fromLabel: string;
  toCode: string;
  toLabel: string;
  fromHint?: string;
  toHint?: string;
  /** Visual only — not a live sailing progress. */
  progress?: number;
  className?: string;
}

export function RouteStrip({
  fromCode,
  fromLabel,
  toCode,
  toLabel,
  fromHint = "Start",
  toHint = "Destination",
  progress = 0.42,
  className,
}: RouteStripProps) {
  const clamped = Math.min(0.86, Math.max(0.14, progress));

  return (
    <div
      className={cn(
        "rounded-panel border border-white/14 bg-surface-0/55 px-4 py-4 backdrop-blur-xl sm:px-5",
        className,
      )}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="min-w-0 shrink-0">
          <p className="text-label font-semibold uppercase tracking-[0.12em] text-ink-4">{fromHint}</p>
          <p className="mt-1 font-display text-title-3 font-semibold tracking-[-0.03em] text-ink sm:text-title-2">
            {fromCode}
          </p>
          <p className="mt-0.5 max-w-[6.5rem] truncate text-[0.7rem] text-ink-3 sm:max-w-[9rem] sm:text-small">
            {fromLabel}
          </p>
        </div>

        <div className="relative min-h-8 min-w-0 flex-1">
          <div
            className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-white/15 via-brand-orange to-white/15"
            aria-hidden="true"
          />
          <span
            className="absolute top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand-orange text-white shadow-[0_8px_20px_-8px_rgba(228,77,14,0.9)]"
            style={{ left: `${clamped * 100}%` }}
            aria-hidden="true"
          >
            <Ship className="h-3.5 w-3.5" />
          </span>
        </div>

        <div className="min-w-0 shrink-0 text-right">
          <p className="text-label font-semibold uppercase tracking-[0.12em] text-ink-4">{toHint}</p>
          <p className="mt-1 font-display text-title-3 font-semibold tracking-[-0.03em] text-ink sm:text-title-2">
            {toCode}
          </p>
          <p className="mt-0.5 max-w-[6.5rem] truncate text-[0.7rem] text-ink-3 sm:max-w-[9rem] sm:text-small">
            {toLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
