const { Permiso, RolPermiso } = require("../models");
const logger = require("../utils/logger");

/**
 * Permission verification middleware
 *
 * Verifies that the authenticated user has the specific permission.
 * MUST be used after authRequired.middleware.js
 *
 * Usage:
 *   router.get('/route', authRequired, permiso('ver_usuarios'), controller)
 *
 * @param {string} verboPermiso - Name of the required permission
 * @returns {Function} Middleware function
 */
module.exports = function (verboPermiso) {
  return async (req, res, next) => {
    try {
      // Additional defense: Validate that req.user exists
      // This should NOT happen if authRequired is used before, but it is good practice
      if (!req.user) {
        logger.error(
          "[Permisos Middleware] ERROR: req.user is null. Did you forget to use authRequired before permiso()?"
        );
        return res.status(500).json({
          error: "Configuration error",
          message: "The permission middleware requires authRequired beforehand",
          code: "MIDDLEWARE_MISCONFIGURATION",
        });
      }

      // Find permissions for the user's role
      const permisos = await Permiso.findAll({
        include: {
          model: RolPermiso,
          where: { rol_id: req.user.rol_id },
        },
      });

      // Extract permission names
      const nombresPermisos = permisos.map((p) => p.nombre);

      // User has the permission -> Continue
      if (nombresPermisos.includes(verboPermiso)) {
        logger.info(
          `[Permisos] User ${req.user.nickname} has permission: ${verboPermiso}`
        );
        return next();
      }

      // User does NOT have the permission -> Block with 403
      logger.info(
        `[Permisos] User ${req.user.nickname} lacks permission: ${verboPermiso}`
      );
      return res.status(403).json({
        error: "Permission denied",
        message: `You do not have the required permission: ${verboPermiso}`,
        code: "PERMISSION_DENIED",
        requiredPermission: verboPermiso,
        userPermissions: nombresPermisos,
      });
    } catch (error) {
      // Error querying permissions
      logger.error(
        "[Permisos Middleware] Error querying permissions:",
        error.message
      );
      return res.status(500).json({
        error: "Internal error",
        message: "Could not verify permissions",
        code: "PERMISSION_CHECK_ERROR",
      });
    }
  };
};
