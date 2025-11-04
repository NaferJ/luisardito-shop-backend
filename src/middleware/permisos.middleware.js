const { Permiso, RolPermiso } = require('../models');

/**
 * Middleware de verificación de permisos
 *
 * Verifica que el usuario autenticado tenga el permiso específico.
 * DEBE usarse después de authRequired.middleware.js
 *
 * Uso:
 *   router.get('/ruta', authRequired, permiso('ver_usuarios'), controller)
 *
 * @param {string} verboPermiso - Nombre del permiso requerido
 * @returns {Function} Middleware function
 */
module.exports = function(verboPermiso) {
    return async (req, res, next) => {
        try {
            // ✅ Defensa adicional: Validar que req.user exista
            // Esto NO debería pasar si se usa authRequired antes, pero es buena práctica
            if (!req.user) {
                console.error('[Permisos Middleware] ERROR: req.user es null. ¿Olvidaste usar authRequired antes de permiso()?');
                return res.status(500).json({
                    error: 'Error de configuración',
                    message: 'El middleware de permisos requiere authRequired previo',
                    code: 'MIDDLEWARE_MISCONFIGURATION'
                });
            }

            // Buscar permisos del rol del usuario
            const permisos = await Permiso.findAll({
                include: {
                    model: RolPermiso,
                    where: { rol_id: req.user.rol_id }
                }
            });

            // Extraer nombres de permisos
            const nombresPermisos = permisos.map(p => p.nombre);

            // ✅ Usuario tiene el permiso → Continuar
            if (nombresPermisos.includes(verboPermiso)) {
                console.log(`[Permisos] ✅ Usuario ${req.user.nickname} tiene permiso: ${verboPermiso}`);
                return next();
            }

            // ❌ Usuario NO tiene el permiso → Bloquear con 403
            console.log(`[Permisos] ❌ Usuario ${req.user.nickname} sin permiso: ${verboPermiso}`);
            return res.status(403).json({
                error: 'Permiso denegado',
                message: `No tienes el permiso necesario: ${verboPermiso}`,
                code: 'PERMISSION_DENIED',
                requiredPermission: verboPermiso,
                userPermissions: nombresPermisos
            });

        } catch (error) {
            // Error al consultar permisos
            console.error('[Permisos Middleware] Error consultando permisos:', error.message);
            return res.status(500).json({
                error: 'Error interno',
                message: 'No se pudieron verificar los permisos',
                code: 'PERMISSION_CHECK_ERROR'
            });
        }
    };
};
