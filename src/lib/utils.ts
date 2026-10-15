import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The custom fluid type scale lives in the `--text-*` theme namespace. Without registering it,
 * tailwind-merge resolves `text-body` as a colour and silently drops the paired text colour.
 */
const FONT_SIZES = [
  "hero",
  "display-1",
  "display-2",
  "title-1",
  "title-2",
  "title-3",
  "lead",
  "body",
  "small",
  "label",
  "metric",
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: FONT_SIZES }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Indian grouping (12,34,567) — no Intl, so SSR and the browser always match. */
function groupIndian(intDigits: string): string {
  if (intDigits.length <= 3) return intDigits;
  const last3 = intDigits.slice(-3);
  const rest = intDigits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

export function formatINR(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}₹${groupIndian(String(Math.abs(rounded)))}`;
}

/** Compact Indian-notation currency, e.g. ₹9.8Cr — for aggregate/policy figures. */
export function formatINRCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1e7) {
    const cr = abs / 1e7;
    const n = cr >= 10 ? cr.toFixed(0) : cr.toFixed(1).replace(/\.0$/, "");
    return `${sign}₹${n}Cr`;
  }
  if (abs >= 1e5) {
    const lakh = abs / 1e5;
    const n = lakh >= 10 ? lakh.toFixed(0) : lakh.toFixed(1).replace(/\.0$/, "");
    return `${sign}₹${n}L`;
  }
  return formatINR(amount);
}

export function formatIST(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function formatDays(days: number): string {
  const rounded = Math.round(days * 10) / 10;
  return `${rounded} ${rounded === 1 ? "day" : "days"}`;
}

/** Splits a brand name into a leading word and the remainder, for wordmark treatments. */
export function splitWordmark(name: string): { lead: string; rest: string } {
  const parts = name.trim().split(/\s+/);
  const [lead = name, ...rest] = parts;
  return { lead, rest: rest.join(" ") };
}
