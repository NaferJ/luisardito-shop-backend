const axios = require('axios');
const config = require('../../config');
const { KickEventSubscription, KickBroadcasterToken } = require('../models');
const logger = require('../utils/logger');

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
    { name: 'livestream.metadata.updated', version: 1 },
    { name: 'kicks.gifted', version: 1 },
    { name: 'channel.reward.redemption.updated', version: 1 }
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

        logger.info(`[Auto Subscribe] Configurando eventos para broadcaster ${broadcasterUserId}`);

        // Asegurar que tenemos un token válido del proveedor del token
        const validToken = await ensureValidToken(actualTokenProvider);
        if (!validToken) {
            throw new Error(`No se pudo obtener un token válido del usuario ${actualTokenProvider}`);
        }

        const apiUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;

        const payload = {
            broadcaster_user_id: parseInt(broadcasterUserId),
            events: DEFAULT_EVENTS,
            method: 'webhook',
            webhook_url: 'https://api.luisardito.com/api/kick-webhook/events'
        };

        const response = await axios.post(apiUrl, payload, {
            headers: {
                'Authorization': `Bearer ${validToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        // Procesar suscripciones exitosas
        const subscriptionsData = response.data.data || [];
        const createdSubscriptions = [];
        const errors = [];

        logger.info(`[Auto Subscribe] Procesando ${subscriptionsData.length} suscripciones recibidas de Kick`);

        for (const sub of subscriptionsData) {
            if (sub.subscription_id && !sub.error) {
                try {
                    // Primero verificar si ya existe
                    let localSub = await KickEventSubscription.findOne({
                        where: { subscription_id: sub.subscription_id }
                    });

                    if (localSub) {
                        // Si existe, actualizar los datos
                        await localSub.update({
                            broadcaster_user_id: parseInt(broadcasterUserId),
                            event_type: sub.name,
                            event_version: sub.version,
                            method: 'webhook',
                            status: 'active'
                        });
                        logger.info(`[Auto Subscribe] ✅ ${sub.name} actualizado (ID: ${localSub.id})`);
                    } else {
                        // Si no existe, crear nuevo
                        localSub = await KickEventSubscription.create({
                            subscription_id: sub.subscription_id,
                            broadcaster_user_id: parseInt(broadcasterUserId),
                            event_type: sub.name,
                            event_version: sub.version,
                            method: 'webhook',
                            status: 'active'
                        });
                        logger.info(`[Auto Subscribe] ✅ ${sub.name} creado (ID: ${localSub.id})`);
                    }

                    createdSubscriptions.push(localSub);

                } catch (dbError) {
                    logger.error(`[Auto Subscribe] ❌ Error DB ${sub.name}:`, dbError.message);
                    errors.push({ event: sub.name, error: dbError.message });
                }
            } else if (sub.error) {
                errors.push({ event: sub.name, error: sub.error });
                logger.error(`[Auto Subscribe] ❌ ${sub.name}:`, sub.error);
            }
        }

        // Actualizar registro del token provider
        await KickBroadcasterToken.update(
            {
                auto_subscribed: createdSubscriptions.length > 0,
                last_subscription_attempt: new Date(),
                subscription_error: errors.length > 0 ? JSON.stringify(errors) : null
            },
            {
                where: {
                    kick_user_id: actualTokenProvider,
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

        logger.info(`[Auto Subscribe] ✅ Completado: ${result.totalSubscribed} eventos configurados`);

        return result;

    } catch (error) {
        logger.error('[Auto Subscribe] ❌ Error:', error.message);

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
            logger.error('[Auto Subscribe] API Error:', error.response.status, error.response.data);

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
            logger.error('[Token Refresh] No hay refresh token disponible');
            return false;
        }

        logger.info(`[Token Refresh] Renovando token para ${broadcasterToken.kick_username}`);

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

            logger.info(`[Token Refresh] ✅ Token renovado exitosamente`);
            return true;
        }

        return false;

    } catch (error) {
        logger.error('[Token Refresh] ❌ Error renovando token:', error.message);
        if (error.response) {
            logger.error('[Token Refresh] API Error:', error.response.status, error.response.data);
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
            logger.error('[Token Ensure] No se encontró token activo para:', broadcasterUserId);
            return null;
        }

        const now = new Date();
        const bufferTime = 5 * 60 * 1000; // 5 minutos de buffer
        const expiresAt = new Date(broadcasterToken.token_expires_at);

        // Si el token expira en menos de 5 minutos, refrescarlo
        if (expiresAt.getTime() - now.getTime() < bufferTime) {
            logger.info('[Token Ensure] Renovando token próximo a expirar...');
            const refreshed = await refreshAccessToken(broadcasterToken);

            if (!refreshed) {
                logger.error('[Token Ensure] No se pudo refrescar el token');
                return null;
            }

            // Recargar el token actualizado
            await broadcasterToken.reload();
        }

        return broadcasterToken.access_token;

    } catch (error) {
        logger.error('[Token Ensure] Error:', error.message);
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
