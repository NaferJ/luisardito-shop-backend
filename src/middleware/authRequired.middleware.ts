import type { RequestHandler } from "express";
import jwt, {
  type JwtPayload,
  type TokenExpiredError,
  type JsonWebTokenError,
} from "jsonwebtoken";
import config from "../../config";
import { Usuario, Rol } from "../models";
import logger from "../utils/logger";

interface AuthJwtPayload extends JwtPayload {
  userId: number;
}

/**
 * Strict authentication middleware
 *
 * Requires the user to be authenticated mandatorily.
 * If there is no token or it is invalid, blocks the request with 401.
 *
 * Usage:
 *   router.get('/protected-route', authRequired, permiso('ver'), controller)
 *
 * Difference with auth.middleware:
 *   - auth.middleware: Allows passthrough without authentication (req.user = null)
 *   - authRequired.middleware: Blocks if not authenticated (401)
 */
const authRequired: RequestHandler = async (req, res, next) => {
  try {
    // 1. Check token in COOKIES first
    let token: string | undefined = req.cookies?.auth_token;

    // 2. Fallback to Authorization header
    if (!token && req.headers?.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    // No token -> BLOCK
    if (!token) {
      res.status(401).json({
        error: "Token not provided",
        message: "You must include an authentication token",
        code: "TOKEN_MISSING",
      });
      return;
    }

    // Verify token
    const payload = jwt.verify(token, config.jwtSecret!) as AuthJwtPayload;

    // Get user from the database
    const user = await Usuario.findByPk(payload.userId, { include: Rol });

    // User not found -> BLOCK
    if (!user) {
      res.status(401).json({
        error: "User not found",
        message: "The token does not correspond to a valid user",
        code: "USER_NOT_FOUND",
      });
      return;
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
    if ((error as TokenExpiredError).name === "TokenExpiredError") {
      res.status(401).json({
        error: "Token expired",
        message: "Your session has expired, please log in again",
        code: "TOKEN_EXPIRED",
        expiredAt: (error as TokenExpiredError).expiredAt,
      });
      return;
    }

    // Token invalid -> BLOCK
    if ((error as JsonWebTokenError).name === "JsonWebTokenError") {
      res.status(401).json({
        error: "Token invalid",
        message: "The authentication token is not valid",
        code: "TOKEN_INVALID",
      });
      return;
    }

    // General error -> BLOCK
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[Auth Required] Error:", msg);
    res.status(401).json({
      error: "Authentication error",
      message: "Could not validate your authentication",
      code: "AUTH_ERROR",
    });
  }
};

export = authRequired;
