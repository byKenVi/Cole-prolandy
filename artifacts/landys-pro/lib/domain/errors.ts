/**
 * Domain errors. Pure — no framework imports.
 * Route handlers map these to HTTP responses.
 */
export class DomainError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export class InsufficientBalanceError extends DomainError {
  shortfallCents: number;
  constructor(shortfallCents: number) {
    super(
      "INSUFFICIENT_BALANCE",
      "This opportunity can't be accepted right now. Please try again or contact Landy's.",
    );
    this.name = "InsufficientBalanceError";
    this.shortfallCents = shortfallCents;
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string) {
    super("NOT_FOUND", `${what} not found.`);
    this.name = "NotFoundError";
  }
}

export class InvalidStateError extends DomainError {
  constructor(message: string) {
    super("INVALID_STATE", message);
    this.name = "InvalidStateError";
  }
}

export class LeadExpiredError extends DomainError {
  constructor() {
    super("LEAD_EXPIRED", "This lead has expired and can no longer be accepted.");
    this.name = "LeadExpiredError";
  }
}

export class LeadSoldOutError extends DomainError {
  constructor() {
    super(
      "LEAD_SOLD_OUT",
      "This opportunity has reached its acceptance cap and is no longer available.",
    );
    this.name = "LeadSoldOutError";
  }
}

export class PriceNotFoundError extends DomainError {
  constructor() {
    super(
      "PRICE_NOT_FOUND",
      "No price is configured for this contractor type, project type, and tier.",
    );
    this.name = "PriceNotFoundError";
  }
}

export class DestructiveBurstError extends DomainError {
  constructor(action: string, recentCount: number) {
    super(
      "DESTRUCTIVE_BURST_DETECTED",
      `Too many "${action}" actions in a short time (${recentCount} in the last few minutes). ` +
        `This safeguard blocks rapid repeated destructive admin actions, which is what an automated ` +
        `script or test run looks like (a real admin doing this one row at a time won't hit it). ` +
        `If this really is intentional bulk work, wait a few minutes and continue in smaller batches.`,
    );
    this.name = "DestructiveBurstError";
  }
}
