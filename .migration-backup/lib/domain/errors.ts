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
      "Wallet balance is too low to accept this lead.",
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

export class PriceNotFoundError extends DomainError {
  constructor() {
    super(
      "PRICE_NOT_FOUND",
      "No price is configured for this contractor type, project type, and tier.",
    );
    this.name = "PriceNotFoundError";
  }
}
