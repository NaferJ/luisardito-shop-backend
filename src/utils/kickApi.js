const axios = require('axios');
const config = require('../../config');

/**
 * Obtiene datos del usuario de Kick usando diferentes métodos
 * @param {string} userIdOrToken - ID del usuario o token de acceso
 * @returns {Promise<Object>} - Datos del usuario de Kick
 */
async function getKickUserData(userIdOrToken) {
    try {
        console.log('[Kick API] Obteniendo datos del usuario:', typeof userIdOrToken);

        // Si es un token (string largo), obtener datos del usuario autenticado
        if (typeof userIdOrToken === 'string' && userIdOrToken.length > 20) {
            console.log('[Kick API] Usando token de acceso para obtener datos');

            const userApiBase = config.kick.apiBaseUrl.replace(/\/$/, '');
            const userUrl = `${userApiBase}/public/v1/users`;

            const response = await axios.get(userUrl, {
                headers: {
                    'Authorization': `Bearer ${userIdOrToken}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });

            // La respuesta puede venir en diferentes formatos
            const userData = Array.isArray(response.data.data) ? response.data.data[0] : response.data;
            console.log('[Kick API] ✅ Datos obtenidos con token:', userData?.name);
            return userData;
        }

        // Si es un ID de usuario, usar endpoint público (si existe)
        console.log('[Kick API] Intentando obtener datos por ID de usuario:', userIdOrToken);

        try {
            const response = await axios.get(`https://kick.com/api/v1/users/${userIdOrToken}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });

            console.log('[Kick API] ✅ Datos obtenidos por ID:', response.data?.name);
            return response.data;

        } catch (publicApiError) {
            console.warn('[Kick API] Endpoint público no disponible:', publicApiError.message);
            throw new Error('No se pudieron obtener datos del usuario de Kick');
        }

    } catch (error) {
        console.error('[Kick API] Error obteniendo datos:', error.message);
        throw error;
    }
}

/**
 * Extrae la URL del avatar desde los datos del usuario de Kick
 * @param {Object} kickUserData - Datos del usuario de Kick
 * @returns {string|null} - URL del avatar o null si no existe
 */
function extractAvatarUrl(kickUserData) {
    // Diferentes posibles ubicaciones del avatar en la respuesta de Kick
    return kickUserData?.profile_picture ||
           kickUserData?.avatar_url ||
           kickUserData?.user?.profile_picture ||
           kickUserData?.user?.avatar_url ||
           null;
}

module.exports = {
    getKickUserData,
    extractAvatarUrl
};
