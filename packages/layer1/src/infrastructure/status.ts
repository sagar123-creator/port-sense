import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function getLayer1Root(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..");
}

export interface Layer1StatusSummary {
  readonly layer: "layer1";
  readonly ready: boolean;
  readonly lastValidateAt: string | null;
  readonly decision: string | null;
  readonly validationCounts: {
    passed: number;
    failed: number;
    errors: number;
    total: number;
  } | null;
  readonly rawArtifactCount: number;
  readonly reportPath: string;
}

interface ValidateReportJson {
  generatedAt?: string;
  decision?: string;
  counts?: {
    passed: number;
    failed: number;
    errors: number;
    total: number;
  };
}

/** Read last `npm run validate` report — no re-ingest. */
export function getLayer1Status(root: string = getLayer1Root()): Layer1StatusSummary {
  const reportPath = join(root, "data", "LAYER1_VALIDATION_REPORT.json");
  const rawDir = join(root, "data", "raw");

  let report: ValidateReportJson | null = null;
  if (existsSync(reportPath)) {
    report = JSON.parse(readFileSync(reportPath, "utf8")) as ValidateReportJson;
  }

  const rawArtifactCount = existsSync(rawDir)
    ? readdirSync(rawDir).filter((f) => !f.startsWith(".")).length
    : 0;

  const counts = report?.counts ?? null;
  const ready = Boolean(
    counts && counts.failed === 0 && counts.errors === 0 && counts.passed > 0,
  );

  return {
    layer: "layer1",
    ready,
    lastValidateAt: report?.generatedAt ?? null,
    decision: report?.decision ?? null,
    validationCounts: counts,
    rawArtifactCount,
    reportPath,
  };
}
