const axios = require('axios');
const config = require('../../config');
const { KickEventSubscription, KickBroadcasterToken } = require('../models');

/**
 * Lista de eventos a los que auto-suscribirse
 */
const DEFAULT_EVENTS = [
    { name: 'chat.message.sent', version: 1 },
    { name: 'channel.followed', version: 1 },
    { name: 'channel.subscription.new', version: 1 },
    { name: 'channel.subscription.renewal', version: 1 },
    { name: 'channel.subscription.gifts', version: 1 },
    { name: 'livestream.status.updated', version: 1 },
    { name: 'livestream.metadata.updated', version: 1 }
];

/**
 * Auto-suscribe a todos los eventos del broadcaster
 * @param {string} accessToken - Token de acceso para hacer la petición
 * @param {string} broadcasterUserId - ID del broadcaster del cual escuchar eventos
 * @param {string} tokenProviderId - ID del usuario que provee el token (opcional, por defecto igual que broadcaster)
 * @returns {Promise<Object>} Resultado de la suscripción
 */
async function autoSubscribeToEvents(accessToken, broadcasterUserId, tokenProviderId = null) {
    try {
        const actualTokenProvider = tokenProviderId || broadcasterUserId;

        console.log(`[Auto Subscribe] Iniciando suscripción para broadcaster ${broadcasterUserId}`);
        console.log(`[Auto Subscribe] Token proveído por: ${actualTokenProvider}`);

        // Asegurar que tenemos un token válido del proveedor del token
        const validToken = await ensureValidToken(actualTokenProvider);
        if (!validToken) {
            throw new Error(`No se pudo obtener un token válido del usuario ${actualTokenProvider}`);
        }

        const apiUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;

        const payload = {
            broadcaster_user_id: parseInt(broadcasterUserId),
            events: DEFAULT_EVENTS,
            method: 'webhook'
        };

        console.log('[Auto Subscribe] Payload:', JSON.stringify(payload, null, 2));

        const response = await axios.post(apiUrl, payload, {
            headers: {
                'Authorization': `Bearer ${validToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        console.log('[Auto Subscribe] Respuesta de Kick:', response.data);

        // Limpiar suscripciones existentes para este broadcaster antes de crear nuevas
        console.log(`[Auto Subscribe] Limpiando suscripciones existentes para broadcaster ${broadcasterUserId}...`);
        await KickEventSubscription.destroy({
            where: {
                broadcaster_user_id: parseInt(broadcasterUserId)
            }
        });

        // Almacenar las suscripciones exitosas en la base de datos local
        const subscriptionsData = response.data.data || [];
        const createdSubscriptions = [];
        const errors = [];

        for (const sub of subscriptionsData) {
            if (sub.subscription_id && !sub.error) {
                try {
                    const [localSub, created] = await KickEventSubscription.findOrCreate({
                        where: {
                            subscription_id: sub.subscription_id
                        },
                        defaults: {
                            subscription_id: sub.subscription_id,
                            broadcaster_user_id: parseInt(broadcasterUserId),
                            event_type: sub.name,
                            event_version: sub.version,
                            method: 'webhook',
                            status: 'active'
                        }
                    });

                    createdSubscriptions.push(localSub);
                    console.log(`[Auto Subscribe] ✅ Suscrito a ${sub.name} ${created ? '(nuevo)' : '(existente)'}`);
                } catch (dbError) {
                    console.error(`[Auto Subscribe] Error guardando suscripción ${sub.name}:`, dbError.message);
                    console.error(`[Auto Subscribe] Datos intentados:`, {
                        subscription_id: sub.subscription_id,
                        broadcaster_user_id: parseInt(broadcasterUserId),
                        event_type: sub.name,
                        event_version: sub.version,
                        method: 'webhook',
                        status: 'active'
                    });
                    if (dbError.errors) {
                        console.error(`[Auto Subscribe] Errores de validación específicos:`, dbError.errors);
                    }
                }
            } else if (sub.error) {
                errors.push({ event: sub.name, error: sub.error });
                console.error(`[Auto Subscribe] ❌ Error en ${sub.name}:`, sub.error);
            }
        }

        // Actualizar el registro del TOKEN PROVIDER (quien provee el token)
        // No del broadcaster de eventos, ya que pueden ser diferentes
        await KickBroadcasterToken.update(
            {
                auto_subscribed: createdSubscriptions.length > 0,
                last_subscription_attempt: new Date(),
                subscription_error: errors.length > 0 ? JSON.stringify(errors) : null
            },
            {
                where: {
                    kick_user_id: actualTokenProvider, // Usar el proveedor del token, no el broadcaster
                    is_active: true
                }
            }
        );

        const result = {
            success: createdSubscriptions.length > 0,
            totalSubscribed: createdSubscriptions.length,
            totalErrors: errors.length,
            subscriptions: createdSubscriptions,
            errors,
            kickResponse: response.data
        };

        console.log(`[Auto Subscribe] ✅ Completado: ${result.totalSubscribed} eventos suscritos, ${result.totalErrors} errores`);

        return result;

    } catch (error) {
        console.error('[Auto Subscribe] Error general:', error.message);

        // Actualizar el error en la base de datos
        await KickBroadcasterToken.update(
            {
                auto_subscribed: false,
                last_subscription_attempt: new Date(),
                subscription_error: error.message
            },
            {
                where: {
                    kick_user_id: broadcasterUserId,
                    is_active: true
                }
            }
        );

        if (error.response) {
            console.error('[Auto Subscribe] Response data:', error.response.data);
            console.error('[Auto Subscribe] Response status:', error.response.status);

            return {
                success: false,
                error: error.response.data,
                status: error.response.status,
                message: 'Error al comunicarse con la API de Kick'
            };
        }

        return {
            success: false,
            error: error.message,
            message: 'Error de red o timeout'
        };
    }
}

/**
 * Verifica si ya existe una suscripción activa para un broadcaster
 * @param {string} broadcasterUserId - ID del broadcaster
 * @returns {Promise<boolean>}
 */
async function hasActiveSubscriptions(broadcasterUserId) {
    const count = await KickEventSubscription.count({
        where: {
            broadcaster_user_id: parseInt(broadcasterUserId),
            status: 'active'
        }
    });

    return count > 0;
}

/**
 * Refresca el token de acceso usando el refresh token
 * @param {Object} broadcasterToken - Instancia del token del broadcaster
 * @returns {Promise<boolean>} True si se refrescó exitosamente
 */
async function refreshAccessToken(broadcasterToken) {
    try {
        if (!broadcasterToken.refresh_token) {
            console.error('[Token Refresh] No hay refresh token disponible');
            return false;
        }

        console.log(`[Token Refresh] Refrescando token para ${broadcasterToken.kick_username}`);

        const refreshUrl = `${config.kick.apiBaseUrl}/oauth/token`;

        const payload = {
            grant_type: 'refresh_token',
            client_id: config.kick.clientId,
            client_secret: config.kick.clientSecret,
            refresh_token: broadcasterToken.refresh_token
        };

        const response = await axios.post(refreshUrl, payload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        if (response.data.access_token) {
            const newExpiresAt = new Date(Date.now() + (response.data.expires_in * 1000));

            await broadcasterToken.update({
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token || broadcasterToken.refresh_token,
                token_expires_at: newExpiresAt
            });

            console.log(`[Token Refresh] ✅ Token refrescado exitosamente, expira: ${newExpiresAt}`);
            return true;
        }

        return false;

    } catch (error) {
        console.error('[Token Refresh] Error:', error.message);
        if (error.response) {
            console.error('[Token Refresh] Response:', error.response.data);
        }
        return false;
    }
}

/**
 * Verifica y refresca el token si es necesario
 * @param {string} broadcasterUserId - ID del broadcaster
 * @returns {Promise<string|null>} Token de acceso válido o null
 */
async function ensureValidToken(broadcasterUserId) {
    try {
        const broadcasterToken = await KickBroadcasterToken.findOne({
            where: {
                kick_user_id: broadcasterUserId,
                is_active: true
            }
        });

        if (!broadcasterToken) {
            console.error('[Token Ensure] No se encontró token activo');
            return null;
        }

        const now = new Date();
        const bufferTime = 5 * 60 * 1000; // 5 minutos de buffer
        const expiresAt = new Date(broadcasterToken.token_expires_at);

        // Si el token expira en menos de 5 minutos, refrescarlo
        if (expiresAt.getTime() - now.getTime() < bufferTime) {
            console.log('[Token Ensure] Token expira pronto, refrescando...');
            const refreshed = await refreshAccessToken(broadcasterToken);

            if (!refreshed) {
                console.error('[Token Ensure] No se pudo refrescar el token');
                return null;
            }

            // Recargar el token actualizado
            await broadcasterToken.reload();
        }

        return broadcasterToken.access_token;

    } catch (error) {
        console.error('[Token Ensure] Error:', error.message);
        return null;
    }
}

module.exports = {
    autoSubscribeToEvents,
    hasActiveSubscriptions,
    refreshAccessToken,
    ensureValidToken,
    DEFAULT_EVENTS
};
