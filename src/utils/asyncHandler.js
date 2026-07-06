/**
 * Wraps an async Express route handler so that rejected promises
 * are forwarded to Express' error-handling middleware via next(err).
 *
 * This is an additive utility. No existing controller is modified yet.
 *
 * @param {Function} fn - Async Express handler (req, res, next)
 * @returns {Function} Express handler that catches promise rejections
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
