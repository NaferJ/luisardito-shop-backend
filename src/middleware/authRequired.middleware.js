const jwt = require('jsonwebtoken');
const config = require('../../config');
const { Usuario, Rol } = require('../models');

/**
 * Middleware de autenticación ESTRICTA
 *
 * Requiere que el usuario esté autenticado obligatoriamente.
 * Si no hay token o es inválido, bloquea la petición con 401.
 *
 * Uso:
 *   router.get('/ruta-protegida', authRequired, permiso('ver'), controller)
 *
 * Diferencia con auth.middleware.js:
 *   - auth.middleware: Permite pasar sin autenticación (req.user = null)
 *   - authRequired.middleware: Bloquea si no hay autenticación (401)
 *
 * @returns {Function} Middleware function
 */
module.exports = async (req, res, next) => {
    try {
        // ✅ 1. Buscar token en COOKIES primero
        let token = req.cookies?.auth_token;

        // ✅ 2. Fallback a Authorization header
        if (!token && req.headers?.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        // ❌ Sin token → BLOQUEAR
        if (!token) {
            return res.status(401).json({
                error: 'Token no proporcionado',
                message: 'Debes incluir un token de autenticación',
                code: 'TOKEN_MISSING'
            });
        }

        // Verificar token
        const payload = jwt.verify(token, config.jwtSecret);

        // Obtener usuario de la base de datos
        const user = await Usuario.findByPk(payload.userId, { include: Rol });

        // ❌ Usuario no encontrado → BLOQUEAR
        if (!user) {
            return res.status(401).json({
                error: 'Usuario no encontrado',
                message: 'El token no corresponde a un usuario válido',
                code: 'USER_NOT_FOUND'
            });
        }

        // ✅ Usuario autenticado correctamente
        req.user = user;
        console.log('[Auth Required] ✅ Usuario autenticado:', user.nickname || user.id);
        next();

    } catch (error) {
        // ❌ Token expirado → BLOQUEAR con mensaje específico
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expirado',
                message: 'Tu sesión ha expirado, por favor inicia sesión nuevamente',
                code: 'TOKEN_EXPIRED',
                expiredAt: error.expiredAt
            });
        }

        // ❌ Token inválido → BLOQUEAR
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Token inválido',
                message: 'El token de autenticación no es válido',
                code: 'TOKEN_INVALID'
            });
        }

        // ❌ Error general → BLOQUEAR
        console.error('[Auth Required] Error:', error.message);
        return res.status(401).json({
            error: 'Error de autenticación',
            message: 'No se pudo validar tu autenticación',
            code: 'AUTH_ERROR'
        });
    }
};

