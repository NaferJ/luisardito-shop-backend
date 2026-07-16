import type { RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import config from "../../config";
import { Usuario, Rol } from "../models";
import logger from "../utils/logger";

interface AuthJwtPayload extends JwtPayload {
  userId: number;
}

const authMiddleware: RequestHandler = async (req, res, next) => {
  try {
    // 1. Check COOKIES first
    let token: string | undefined = req.cookies?.auth_token;

    // 2. Fallback to Authorization header
    if (!token && req.headers?.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    // 3. If no token, allow passthrough (not an error)
    if (!token) {
      req.user = null;
      next();
      return;
    }

    // Verify token and get user
    const payload = jwt.verify(token, config.jwtSecret!) as AuthJwtPayload;
    const user = await Usuario.findByPk(payload.userId, { include: Rol });

    if (!user) {
      req.user = null;
      next();
      return;
    }

    // User authenticated successfully
    req.user = user;
    logger.info(
      "[Auth Middleware] User authenticated:",
      user.nickname || user.id
    );
    next();
  } catch (error) {
    // 4. If verification fails, allow passthrough (not an error)
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[Auth Middleware] Error:", msg);
    req.user = null;
    next();
  }
};

export = authMiddleware;
