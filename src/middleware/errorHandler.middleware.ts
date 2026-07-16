import type { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

interface AppErrorLike extends Error {
  statusCode?: number;
  status?: number;
  details?: unknown;
}

/**
 * Responds with a 404 JSON body for any unmatched route.
 * Must be registered after all route mounts.
 */
const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({ error: "Not found" });
};

interface HandledError extends Error {
  statusCode?: number;
  status?: number;
  details?: unknown;
}

/**
 * Centralized Express error-handling middleware (4-arg signature).
 *
 * Acts as a safety net for errors thrown or next(err)'d that are not
 * already handled by controllers. Does not change any existing
 * controller behavior or response shapes.
 */
const errorHandler = (
  err: HandledError | AppErrorLike,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Guard against double-send
  if (res.headersSent) {
    next(err);
    return;
  }

  logger.error(err);

  const status = err.statusCode || err.status || 500;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    const body: { error: string; details?: unknown } = {
      error: status >= 500 ? "Internal server error" : err.message || "Error",
    };
    if (err.details) {
      body.details = err.details;
    }
    res.status(status).json(body);
    return;
  }

  // Non-production: include stack and details for local debugging
  const body: { error: string; stack?: string; details?: unknown } = {
    error: err.message || "Internal server error",
  };
  if (err.stack) {
    body.stack = err.stack;
  }
  if (err.details) {
    body.details = err.details;
  }
  res.status(status).json(body);
};

export { notFoundHandler, errorHandler };
