"use client";

import { cn } from "@/lib/utils";

export interface SegmentedItem<T extends string> {
  id: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  items: readonly SegmentedItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex w-full max-w-full items-center gap-1 rounded-full border border-hairline bg-surface-2/80 p-1 backdrop-blur-sm sm:w-auto",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "min-w-0 flex-1 rounded-full px-2 py-2 text-center text-[0.72rem] font-semibold transition-all duration-300 ease-[var(--ease-out-quint)] sm:flex-none sm:px-4 sm:text-small",
              active
                ? "bg-white text-surface-1 shadow-[0_6px_18px_-8px_rgba(0,0,0,0.8)]"
                : "text-ink-3 hover:bg-white/[0.06] hover:text-ink",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
