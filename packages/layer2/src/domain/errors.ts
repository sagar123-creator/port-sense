export class CanonicalNotFoundError extends Error {
  readonly code = "CANONICAL_NOT_FOUND" as const;

  constructor(
    readonly resource: string,
    readonly id: string,
  ) {
    super(`${resource} not found: ${id}`);
    this.name = "CanonicalNotFoundError";
  }
}

export class AcceptanceRejectedError extends Error {
  readonly code = "ACCEPTANCE_REJECTED" as const;

  constructor(
    readonly reason: string,
    readonly batchId?: string,
  ) {
    super(reason);
    this.name = "AcceptanceRejectedError";
  }
}

export class StoreNotLoadedError extends Error {
  readonly code = "STORE_NOT_LOADED" as const;

  constructor(message = "Canonical store is empty — run npm run seed") {
    super(message);
    this.name = "StoreNotLoadedError";
  }
}
