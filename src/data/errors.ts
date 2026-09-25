export class AuthError extends Error {}

export class RateLimitError extends Error {
  constructor(public retryAfterMs: number | null) {
    super("rate limited");
  }
}

export class TransientError extends Error {}
