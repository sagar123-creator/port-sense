"use client";

export interface ChartTooltipEntry {
  name?: string | number;
  value?: string | number;
  color?: string;
  dataKey?: string | number;
}

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: readonly ChartTooltipEntry[];
  labelSuffix?: string;
  formatValue?: (value: number) => string;
}

export function ChartTooltip({
  active,
  label,
  payload,
  labelSuffix,
  formatValue,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-xl border border-hairline-strong bg-surface-0/95 px-3.5 py-2.5 shadow-float backdrop-blur-md">
      {label !== undefined && (
        <p className="text-label font-semibold uppercase text-ink-4">
          {label}
          {labelSuffix ? ` ${labelSuffix}` : ""}
        </p>
      )}
      <div className="mt-1.5 flex flex-col gap-1">
        {payload.map((entry, index) => {
          const numeric = typeof entry.value === "number" ? entry.value : Number(entry.value);
          const display =
            formatValue && Number.isFinite(numeric) ? formatValue(numeric) : String(entry.value ?? "—");
          return (
            <p
              key={`${entry.dataKey ?? index}`}
              className="flex items-center gap-2 text-body font-semibold tabular-nums text-ink"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: entry.color ?? "var(--brand-orange)" }}
                aria-hidden="true"
              />
              {display}
            </p>
          );
        })}
      </div>
    </div>
  );
}
