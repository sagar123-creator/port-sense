export const BRAND = {
  name: process.env.NEXT_PUBLIC_PRODUCT_NAME ?? "Port Sense",
  tagline: "Demurrage intelligence for MSME exporters",
  shortName: process.env.NEXT_PUBLIC_PRODUCT_NAME ?? "Port Sense",
} as const;

export const COLORS = {
  navy: "#07111F",
  navyMid: "#122038",
  orange: "#E44D0E",
  orangeDeep: "#B83609",
  orangeSoft: "#FF7A38",
  offWhite: "#F4F6F9",
  charcoal: "#1A1A1A",
  muted: "#8B9BB4",
  riskLow: "#22C55E",
  riskMed: "#F59E0B",
  riskHigh: "#EF4444",
} as const;
