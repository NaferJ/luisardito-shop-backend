import rateLimit, { type Options } from "express-rate-limit";
import type { RequestHandler } from "express";

/**
 * In-memory rate limiter factory.
 *
 * Keys by authenticated user id when available, otherwise by client IP
 * (requires `app.set("trust proxy", 1)` behind nginx).
 */
function makeRateLimiter(options: {
  windowMs: number;
  limit: number;
}): RequestHandler {
  const config: Partial<Options> = {
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user?.id ?? req.ip ?? "unknown"),
    handler: (_req, res) => {
      res.status(429).json({
        error: "Too many requests",
        message: "You are doing that too fast. Try again in a moment.",
        code: "RATE_LIMITED",
      });
    },
  };
  return rateLimit(config) as unknown as RequestHandler;
}

// Community write endpoints (post/comment creation and likes).
// 30 writes per minute per user is generous for real users and stops scripts.
const communityWriteLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  limit: 30,
});

// Post creation only: 5 posts per 10 minutes per user.
const communityPostLimiter = makeRateLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 5,
});

export { makeRateLimiter, communityWriteLimiter, communityPostLimiter };
