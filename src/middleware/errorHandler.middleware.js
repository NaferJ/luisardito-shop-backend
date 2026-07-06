const logger = require("../utils/logger");

/**
 * Responds with a 404 JSON body for any unmatched route.
 * Must be registered after all route mounts.
 */
const notFoundHandler = (req, res, _next) => {
  res.status(404).json({ error: "Not found" });
};

/**
 * Centralized Express error-handling middleware (4-arg signature).
 *
 * Acts as a safety net for errors thrown or next(err)'d that are not
 * already handled by controllers. Does not change any existing
 * controller behavior or response shapes.
 */
const errorHandler = (err, req, res, next) => {
  // Guard against double-send
  if (res.headersSent) {
    return next(err);
  }

  logger.error(err);

  const status = err.statusCode || err.status || 500;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    const body = {
      error: status >= 500 ? "Internal server error" : err.message || "Error",
    };
    if (err.details) {
      body.details = err.details;
    }
    return res.status(status).json(body);
  }

  // Non-production: include stack and details for local debugging
  const body = {
    error: err.message || "Internal server error",
  };
  if (err.stack) {
    body.stack = err.stack;
  }
  if (err.details) {
    body.details = err.details;
  }
  return res.status(status).json(body);
};

module.exports = { notFoundHandler, errorHandler };
