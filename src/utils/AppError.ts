/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

/**
 * Operational application error with an HTTP status code.
 *
 * Use this to signal expected/operational failures so the centralized
 * error handler can format a consistent response without leaking stack
 * traces in production.
 */
class AppError extends Error {
  statusCode: any;
  details: any;
  isOperational: boolean;

  constructor(message: any, statusCode: any = 500, details: any = undefined) {
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
