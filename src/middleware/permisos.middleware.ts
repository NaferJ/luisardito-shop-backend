import type { Request, Response, NextFunction, RequestHandler } from "express";
import { Permiso, RolPermiso } from "../models";
import logger from "../utils/logger";

/**
 * Permission verification middleware
 *
 * Verifies that the authenticated user has the specific permission.
 * MUST be used after authRequired.middleware
 *
 * Usage:
 *   router.get('/route', authRequired, permiso('ver_usuarios'), controller)
 *
 * @param verboPermiso - Name of the required permission
 * @returns Express middleware function
 */
const permisoMiddleware = function (verboPermiso: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Additional defense: Validate that req.user exists
      // This should NOT happen if authRequired is used before, but it is good practice
      if (!req.user) {
        logger.error(
          "[Permisos Middleware] ERROR: req.user is null. Did you forget to use authRequired before permiso()?"
        );
        res.status(500).json({
          error: "Configuration error",
          message: "The permission middleware requires authRequired beforehand",
          code: "MIDDLEWARE_MISCONFIGURATION",
        });
        return;
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
        next();
        return;
      }

      // User does NOT have the permission -> Block with 403
      logger.info(
        `[Permisos] User ${req.user.nickname} lacks permission: ${verboPermiso}`
      );
      res.status(403).json({
        error: "Permission denied",
        message: `You do not have the required permission: ${verboPermiso}`,
        code: "PERMISSION_DENIED",
        requiredPermission: verboPermiso,
        userPermissions: nombresPermisos,
      });
    } catch (error) {
      // Error querying permissions
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[Permisos Middleware] Error querying permissions:", msg);
      res.status(500).json({
        error: "Internal error",
        message: "Could not verify permissions",
        code: "PERMISSION_CHECK_ERROR",
      });
    }
  };
};

export = permisoMiddleware;
