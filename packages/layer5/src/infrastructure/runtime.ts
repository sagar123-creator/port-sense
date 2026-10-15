import { ExplanationService } from "../application/explanation.service.js";

export interface ExplanationRuntime {
  readonly explanation: ExplanationService;
}

export function createExplanationRuntime(): ExplanationRuntime {
  return {
    explanation: new ExplanationService(),
  };
}
