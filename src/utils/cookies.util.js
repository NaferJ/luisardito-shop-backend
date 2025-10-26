/**
 * Utilidades para manejo de cookies cross-domain
 */

/**
 * Obtiene las opciones de cookie configuradas correctamente para cross-domain
 * @param {string} env - Entorno ('development' o 'production')
 * @returns {Object} Opciones de cookie
 */
function getCookieOptions(env = process.env.NODE_ENV) {
    const isProduction = env === 'production';

    return {
        httpOnly: false,        // Permitir acceso desde JavaScript en el frontend
        secure: isProduction,   // HTTPS en producción, HTTP en desarrollo
        sameSite: 'lax',       // Permitir cross-site para subdominios
        domain: isProduction ? '.luisardito.com' : undefined, // Dominio compartido en producción
        path: '/',             // Disponible en todo el sitio
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 días por defecto
    };
}

/**
 * Obtiene las opciones específicas para el refresh token (más duradero)
 * @param {string} env - Entorno
 * @returns {Object} Opciones de cookie para refresh token
 */
function getRefreshCookieOptions(env = process.env.NODE_ENV) {
    return {
        ...getCookieOptions(env),
        maxAge: 90 * 24 * 60 * 60 * 1000 // 90 días para refresh token
    };
}

/**
 * Obtiene las opciones para limpiar cookies
 * @param {string} env - Entorno
 * @returns {Object} Opciones para clearCookie
 */
function getClearCookieOptions(env = process.env.NODE_ENV) {
    const isProduction = env === 'production';

    return {
        domain: isProduction ? '.luisardito.com' : undefined,
        path: '/',
        sameSite: 'lax'
    };
}

/**
 * Configura las cookies de autenticación en la respuesta
 * @param {Object} res - Objeto response de Express
 * @param {string} accessToken - Token de acceso
 * @param {string} refreshToken - Token de refresh
 * @param {string} env - Entorno
 */
function setAuthCookies(res, accessToken, refreshToken, env = process.env.NODE_ENV) {
    const cookieOptions = getCookieOptions(env);
    const refreshOptions = getRefreshCookieOptions(env);

    res.cookie('auth_token', accessToken, cookieOptions);
    res.cookie('refresh_token', refreshToken, refreshOptions);
}

/**
 * Limpia las cookies de autenticación
 * @param {Object} res - Objeto response de Express
 * @param {string} env - Entorno
 */
function clearAuthCookies(res, env = process.env.NODE_ENV) {
    const clearOptions = getClearCookieOptions(env);

    res.clearCookie('auth_token', clearOptions);
    res.clearCookie('refresh_token', clearOptions);
}

module.exports = {
    getCookieOptions,
    getRefreshCookieOptions,
    getClearCookieOptions,
    setAuthCookies,
    clearAuthCookies
};
