/**
 * Operational application error with an HTTP status code.
 *
 * Use this to signal expected/operational failures so the centralized
 * error handler can format a consistent response without leaking stack
 * traces in production.
 */
class AppError extends Error {
  statusCode: number;
  details: unknown;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, details?: unknown) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export = AppError;
