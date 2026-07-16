import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async Express route handler so that rejected promises
 * are forwarded to Express' error-handling middleware via next(err).
 *
 * @param fn - Async Express handler (req, res, next)
 * @returns Express handler that catches promise rejections
 */
type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<unknown>;

const asyncHandler =
  (fn: AsyncRouteHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export = asyncHandler;
