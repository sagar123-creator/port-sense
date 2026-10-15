"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  values: readonly number[];
  color?: string;
  className?: string;
  filled?: boolean;
}

const VIEW_WIDTH = 120;
const VIEW_HEIGHT = 34;

function buildPoints(values: readonly number[]): { x: number; y: number }[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? VIEW_WIDTH / (values.length - 1) : 0;

  return values.map((value, index) => ({
    x: index * step,
    y: VIEW_HEIGHT - ((value - min) / span) * (VIEW_HEIGHT - 6) - 3,
  }));
}

export function Sparkline({
  values,
  color = "var(--brand-orange)",
  className,
  filled = true,
}: SparklineProps) {
  const gradientId = useId();
  const points = buildPoints(values);

  if (points.length < 2) return null;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  const area = `${line} L${VIEW_WIDTH} ${VIEW_HEIGHT} L0 ${VIEW_HEIGHT} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      className={cn("h-9 w-full", className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {filled && <path d={area} fill={`url(#${gradientId})`} />}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {last && <circle cx={last.x} cy={last.y} r="2.2" fill={color} />}
    </svg>
  );
}
