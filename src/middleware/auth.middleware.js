const jwt = require("jsonwebtoken");
const config = require("../../config");
const { Usuario, Rol } = require("../models");
const logger = require("../utils/logger");

module.exports = async (req, res, next) => {
  try {
    // 1. Check COOKIES first
    let token = req.cookies?.auth_token;

    // 2. Fallback to Authorization header
    if (!token && req.headers?.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    // 3. If no token, allow passthrough (not an error)
    if (!token) {
      req.user = null;
      return next();
    }

    // Verify token and get user
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await Usuario.findByPk(payload.userId, { include: Rol });

    if (!user) {
      req.user = null;
      return next();
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
    logger.error("[Auth Middleware] Error:", error.message);
    req.user = null;
    next();
  }
};
