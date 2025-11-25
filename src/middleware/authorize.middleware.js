/**
 * Middleware de Autorización por Rol
 *
 * Verifica que el usuario autenticado tenga uno de los roles permitidos.
 * DEBE usarse después de authenticate middleware.
 *
 * Uso:
 *   router.get('/admin', authenticate, authorize(['admin']), controller)
 *   router.get('/admin-or-mod', authenticate, authorize(['admin', 'moderador']), controller)
 *
 * @param {string[]} allowedRoles - Array de roles permitidos
 * @returns {Function} Middleware function
 */
const { Rol } = require('../models');
const logger = require('../utils/logger');

const authorize = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            // Validar que el usuario esté autenticado
            if (!req.user) {
                logger.warn('[Authorize] Usuario no autenticado intentando acceder a ruta protegida');
                return res.status(401).json({
                    ok: false,
                    error: 'No autenticado',
                    message: 'Debes iniciar sesión para acceder a este recurso',
                    code: 'UNAUTHORIZED'
                });
            }

            // Obtener información del rol del usuario
            const userRol = await Rol.findByPk(req.user.rol_id);

            if (!userRol) {
                logger.error(`[Authorize] Rol no encontrado para usuario ${req.user.nickname} (rol_id: ${req.user.rol_id})`);
                return res.status(500).json({
                    ok: false,
                    error: 'Error de configuración',
                    message: 'Rol de usuario no válido',
                    code: 'INVALID_ROLE'
                });
            }

            // Verificar si el rol del usuario está en los roles permitidos
            const userRoleName = userRol.nombre.toLowerCase();
            const hasPermission = allowedRoles.some(role => role.toLowerCase() === userRoleName);

            if (hasPermission) {
                logger.info(`[Authorize] ✅ Usuario ${req.user.nickname} (${userRoleName}) autorizado`);
                return next();
            }

            // Usuario no tiene el rol requerido
            logger.warn(`[Authorize] ❌ Usuario ${req.user.nickname} (${userRoleName}) sin permisos. Se requiere: ${allowedRoles.join(', ')}`);
            return res.status(403).json({
                ok: false,
                error: 'Permiso denegado',
                message: `No tienes permisos para acceder a este recurso. Se requiere rol: ${allowedRoles.join(' o ')}`,
                code: 'FORBIDDEN',
                requiredRoles: allowedRoles,
                userRole: userRoleName
            });

        } catch (error) {
            logger.error('[Authorize] Error verificando autorización:', error);
            return res.status(500).json({
                ok: false,
                error: 'Error interno',
                message: 'No se pudo verificar la autorización',
                code: 'AUTHORIZATION_ERROR'
            });
        }
    };
};

module.exports = { authorize };
