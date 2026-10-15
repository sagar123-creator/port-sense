"use client";

import { useId } from "react";

/** React ids contain characters that are unsafe inside an SVG `url(#…)` reference. */
export function useGradientId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}
