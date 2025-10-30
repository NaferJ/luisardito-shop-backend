const axios = require('axios');
const config = require('../../config');

/**
 * Valida un token de acceso de Kick usando el endpoint de introspección
 * @param {string} accessToken - Token de acceso a validar
 * @returns {Promise<Object>} - Información del token
 */
async function validateKickToken(accessToken) {
    try {
        const introspectUrl = `${config.kick.apiBaseUrl}/public/v1/token/introspect`;
        console.log('[Kick API] Validando token con introspección...');
        
        const response = await axios.post(introspectUrl, {}, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        console.log('[Kick API] ✅ Validación del token exitosa:', {
            active: response.data?.data?.active,
            scopes: response.data?.data?.scope,
            expiresIn: response.data?.data?.expires_in
        });

        if (!response.data?.data?.active) {
            throw new Error('Token inactivo o expirado');
        }

        return response.data.data;
    } catch (error) {
        console.error('[Kick API] ❌ Error validando token:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        throw error;
    }
}

/**
 * Obtiene datos del usuario de Kick usando diferentes métodos
 * @param {string} userIdOrToken - ID del usuario o token de acceso
 * @returns {Promise<Object>} - Datos del usuario de Kick
 */
async function getKickUserData(userIdOrToken) {
    try {
        console.log('[Kick API] Obteniendo datos del usuario. Tipo:', typeof userIdOrToken);
        console.log('[Kick API] Token/ID recibido (primeros 10 caracteres):', 
            typeof userIdOrToken === 'string' ? 
            `${userIdOrToken.substring(0, 10)}... (longitud: ${userIdOrToken.length})` : 'No es string');

        // Si es un token (string largo), obtener datos del usuario autenticado
        if (typeof userIdOrToken === 'string' && userIdOrToken.length > 20) {
            console.log('[Kick API] Detectado token de acceso. Validando...');

            // Primero validamos el token
            const tokenInfo = await validateKickToken(userIdOrToken);
            
            // Si llegamos aquí, el token es válido
            console.log('[Kick API] Token válido. Obteniendo datos del usuario...');
            console.log('[Kick API] Scopes disponibles:', tokenInfo.scope);

            const userApiBase = config.kick.apiBaseUrl.replace(/\/$/, '');
            const userUrl = `${userApiBase}/public/v1/users`;
            
            console.log('[Kick API] URL de la API de usuarios:', userUrl);

            try {
                const response = await axios.get(userUrl, {
                    headers: {
                        'Authorization': `Bearer ${userIdOrToken}`,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json'
                    },
                    timeout: 10000
                });

                console.log('[Kick API] ✅ Respuesta de la API de usuarios:', {
                    status: response.status,
                    statusText: response.statusText,
                    data: response.data ? `Recibidos ${response.data.data?.length || 0} usuarios` : 'Sin datos'
                });
                
                // DEBUG: Ver la estructura completa de la respuesta
                console.log('[Kick API] DEBUG - Estructura completa de response.data:', JSON.stringify(response.data, null, 2));

                const userData = response.data?.data?.[0]; // Tomar el primer usuario del array
                if (!userData) {
                    console.error('[Kick API] ERROR - No se encontró userData en response.data.data[0]');
                    console.error('[Kick API] ERROR - response.data:', response.data);
                    throw new Error('No se encontraron datos de usuario en la respuesta');
                }

                // Normalizar la estructura de datos (la API devuelve user_id y name)
                const normalizedData = {
                    id: userData.user_id || userData.id,
                    username: userData.name || userData.username,
                    email: userData.email,
                    profile_picture: userData.profile_picture,
                    // Mantener campos originales por compatibilidad
                    user_id: userData.user_id,
                    name: userData.name
                };

                console.log('[Kick API] ✅ Datos del usuario obtenidos:', {
                    id: normalizedData.id,
                    username: normalizedData.username,
                    email: normalizedData.email
                });
                
                return normalizedData;
            } catch (error) {
                console.error('[Kick API] Error en la petición con token:', {
                    message: error.message,
                    response: {
                        status: error.response?.status,
                        data: error.response?.data,
                        headers: error.response?.headers
                    }
                });
                throw error;
            }
        }

        // Si es un ID de usuario, usar endpoint público (si existe)
        console.log('[Kick API] Intentando obtener datos por ID de usuario:', userIdOrToken);

        try {
            const response = await axios.get(`https://kick.com/api/v1/users/${userIdOrToken}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            console.log('[Kick API] ✅ Datos obtenidos por ID:', response.data?.name);
            return response.data;

        } catch (publicApiError) {
            console.warn('[Kick API] Endpoint público no disponible:', {
                message: publicApiError.message,
                status: publicApiError.response?.status,
                data: publicApiError.response?.data
            });
            throw new Error('No se pudieron obtener datos del usuario de Kick');
        }

    } catch (error) {
        console.error('[Kick API] Error obteniendo datos:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data
        });
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
