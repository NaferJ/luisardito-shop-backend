/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import AppError from "../utils/AppError";

/**
 * Factory that returns an Express middleware which validates req[source]
 * against the given zod schema.
 *
 * On success the parsed/sanitized value is assigned back to req[source] so
 * downstream controllers receive normalized data. On failure a single
 * human-readable message is forwarded to the centralized error handler via
 * next(new AppError(...)).
 *
 * @param {import("zod").ZodType} schema - zod schema to validate against
 * @param {"body"|"query"|"params"} [source="body"] - request property to validate
 * @returns {import("express").RequestHandler}
 */
function validate(schema: any, source: any = "body") {
  return (req: any, _res: any, next: any) => {
    const result = schema.safeParse(req[source]);

    if (result.success) {
      req[source] = result.data;
      return next();
    }

    const message = result.error.issues.map((i: any) => i.message).join(" ");
    return next(new AppError(message, 400, { issues: result.error.issues }));
  };
}

export = validate;
