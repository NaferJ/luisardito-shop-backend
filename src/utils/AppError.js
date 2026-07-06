/**
 * Operational application error with an HTTP status code.
 *
 * Use this to signal expected/operational failures so the centralized
 * error handler can format a consistent response without leaking stack
 * traces in production.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = undefined) {
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

module.exports = AppError;
