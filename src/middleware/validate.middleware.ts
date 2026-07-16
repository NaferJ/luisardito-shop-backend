import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ZodType, ZodError } from "zod";
import AppError from "../utils/AppError";

type RequestSource = "body" | "query" | "params";

/**
 * Factory that returns an Express middleware which validates req[source]
 * against the given zod schema.
 *
 * On success the parsed/sanitized value is assigned back to req[source] so
 * downstream controllers receive normalized data. On failure a single
 * human-readable message is forwarded to the centralized error handler via
 * next(new AppError(...)).
 *
 * @param schema - zod schema to validate against
 * @param source - request property to validate
 * @returns Express RequestHandler
 */
function validate(
  schema: ZodType,
  source: RequestSource = "body"
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (result.success) {
      req[source] = result.data as Request[RequestSource];
      next();
      return;
    }

    const message = (result.error as ZodError).issues
      .map((i) => i.message)
      .join(" ");
    next(
      new AppError(message, 400, { issues: (result.error as ZodError).issues })
    );
  };
}

export = validate;
