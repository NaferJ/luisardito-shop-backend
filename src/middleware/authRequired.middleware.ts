/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import jwt from "jsonwebtoken";
import config from "../../config";
import { Usuario, Rol } from "../models";
import logger from "../utils/logger";

/**
 * Strict authentication middleware
 *
 * Requires the user to be authenticated mandatorily.
 * If there is no token or it is invalid, blocks the request with 401.
 *
 * Usage:
 *   router.get('/protected-route', authRequired, permiso('ver'), controller)
 *
 * Difference with auth.middleware.js:
 *   - auth.middleware: Allows passthrough without authentication (req.user = null)
 *   - authRequired.middleware: Blocks if not authenticated (401)
 *
 * @returns {Function} Middleware function
 */
export = async (req: any, res: any, next: any) => {
  try {
    // 1. Check token in COOKIES first
    let token = req.cookies?.auth_token;

    // 2. Fallback to Authorization header
    if (!token && req.headers?.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    // No token -> BLOCK
    if (!token) {
      return res.status(401).json({
        error: "Token not provided",
        message: "You must include an authentication token",
        code: "TOKEN_MISSING",
      });
    }

    // Verify token
    const payload: any = jwt.verify(token, config.jwtSecret);

    // Get user from the database
    const user: any = await Usuario.findByPk(payload.userId, { include: Rol });

    // User not found -> BLOCK
    if (!user) {
      return res.status(401).json({
        error: "User not found",
        message: "The token does not correspond to a valid user",
        code: "USER_NOT_FOUND",
      });
    }

    // User authenticated successfully
    req.user = user;
    logger.info(
      "[Auth Required] User authenticated:",
      user.nickname || user.id
    );
    next();
  } catch (error) {
    // Token expired -> BLOCK with specific message
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expired",
        message: "Your session has expired, please log in again",
        code: "TOKEN_EXPIRED",
        expiredAt: error.expiredAt,
      });
    }

    // Token invalid -> BLOCK
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Token invalid",
        message: "The authentication token is not valid",
        code: "TOKEN_INVALID",
      });
    }

    // General error -> BLOCK
    logger.error("[Auth Required] Error:", error.message);
    return res.status(401).json({
      error: "Authentication error",
      message: "Could not validate your authentication",
      code: "AUTH_ERROR",
    });
  }
};
