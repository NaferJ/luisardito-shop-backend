/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

/**
 * Role-based authorization middleware
 *
 * Verifies that the authenticated user has one of the allowed roles.
 * MUST be used after the authenticate middleware.
 *
 * Usage:
 *   router.get('/admin', authenticate, authorize(['admin']), controller)
 *   router.get('/admin-or-mod', authenticate, authorize(['admin', 'moderador']), controller)
 *
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {Function} Middleware function
 */
import { Rol } from "../models";
import logger from "../utils/logger";

const authorize = (allowedRoles: any) => {
  return async (req: any, res: any, next: any) => {
    try {
      // Validate that the user is authenticated
      if (!req.user) {
        logger.warn(
          "[Authorize] Unauthenticated user attempting to access a protected route"
        );
        return res.status(401).json({
          ok: false,
          error: "Not authenticated",
          message: "You must log in to access this resource",
          code: "UNAUTHORIZED",
        });
      }

      // Get the user's role information
      const userRol: any = await Rol.findByPk(req.user.rol_id);

      if (!userRol) {
        logger.error(
          `[Authorize] Role not found for user ${req.user.nickname} (rol_id: ${req.user.rol_id})`
        );
        return res.status(500).json({
          ok: false,
          error: "Configuration error",
          message: "Invalid user role",
          code: "INVALID_ROLE",
        });
      }

      // Check if the user's role is in the allowed roles
      const userRoleName = userRol.nombre.toLowerCase();
      const hasPermission = allowedRoles.some(
        (role: any) => role.toLowerCase() === userRoleName
      );

      if (hasPermission) {
        logger.info(
          `[Authorize] User ${req.user.nickname} (${userRoleName}) authorized`
        );
        return next();
      }

      // User does not have the required role
      logger.warn(
        `[Authorize] User ${req.user.nickname} (${userRoleName}) lacks permissions. Required: ${allowedRoles.join(", ")}`
      );
      return res.status(403).json({
        ok: false,
        error: "Permission denied",
        message: `You do not have permissions to access this resource. Required role: ${allowedRoles.join(" or ")}`,
        code: "FORBIDDEN",
        requiredRoles: allowedRoles,
        userRole: userRoleName,
      });
    } catch (error) {
      logger.error("[Authorize] Error verifying authorization:", error);
      return res.status(500).json({
        ok: false,
        error: "Internal error",
        message: "Could not verify the authorization",
        code: "AUTHORIZATION_ERROR",
      });
    }
  };
};

export { authorize };
