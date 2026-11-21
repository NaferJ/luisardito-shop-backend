import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an Express route handler so that rejected promises are forwarded
 * to Express' error-handling middleware via next(err). Synchronous throws
 * are also routed through next(err) so sync handlers keep the same
 * error contract as async ones.
 *
 * @param fn - Express handler (req, res, next), sync or async
 * @returns Express handler that catches throws and promise rejections
 */
type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<unknown>;

const asyncHandler =
  (fn: AsyncRouteHandler): RequestHandler =>
  (req, res, next) => {
    try {
      return Promise.resolve(fn(req, res, next)).catch(next);
    } catch (error) {
      next(error);
    }
  };

export = asyncHandler;
