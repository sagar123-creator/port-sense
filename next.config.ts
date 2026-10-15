import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Layer packages live under ./packages — keep tracing within the app root for Vercel
  outputFileTracingRoot: dir,
  outputFileTracingIncludes: {
    "/api/*": [
      "./data/**/*",
      "./packages/layer1/data/**/*",
      "./packages/layer2/data/**/*",
      "./packages/layer7/data/**/*",
      "./src/lib/layer2/monthlyCargo.json",
    ],
  },
  // Prebuilt layer packages (NodeNext ESM) — do not bundle through Turbopack
  serverExternalPackages: [
    "@port-sense/layer1-ingestion",
    "@port-sense/layer2-canonical",
    "@port-sense/layer3-decision",
    "@port-sense/layer4-decision",
    "@port-sense/layer5-explanation",
    "@port-sense/layer6-inland",
    "@port-sense/layer7-time",
    "@port-sense/dwm-warehouse",
    "better-sqlite3",
    "xlsx",
  ],
};

export default nextConfig;
