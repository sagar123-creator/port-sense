import { quoteFreightCost } from "../application/freight.service.js";

export interface InlandRuntime {
  readonly quoteFreightCost: typeof quoteFreightCost;
}

export function createInlandRuntime(): InlandRuntime {
  return { quoteFreightCost };
}
