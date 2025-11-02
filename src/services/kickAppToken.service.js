const axios = require('axios');
const config = require('../../config');
const { KickEventSubscription } = require('../models');

/**
 * Servicio para manejar App Access Tokens de Kick (tokens permanentes)
 * Los App Tokens no expiran y permiten webhooks permanentes sin re-autenticación del usuario
 */

/**
 * Obtener App Access Token usando Client Credentials Grant
 * @returns {Promise<string|null>} Access token o null si falla
 */
async function getAppAccessToken() {
    try {
        logger.info('🔑 [App Token] Obteniendo App Access Token con Client Credentials...');

        const tokenUrl = `${config.kick.apiBaseUrl}/oauth/token`;

        const payload = {
            grant_type: 'client_credentials',
            client_id: config.kick.clientId,
            client_secret: config.kick.clientSecret
        };

        logger.info('🔑 [App Token] Enviando request a:', tokenUrl);
        logger.info('🔑 [App Token] Client ID:', config.kick.clientId);

        const response = await axios.post(tokenUrl, payload, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            timeout: 15000
        });

        if (response.data.access_token) {
            logger.info('🔑 [App Token] ✅ App Access Token obtenido exitosamente');
            logger.info('🔑 [App Token] Token type:', response.data.token_type);
            logger.info('🔑 [App Token] Expires in:', response.data.expires_in || 'No especificado (permanente)');

            return response.data.access_token;
        } else {
            logger.error('🔑 [App Token] ❌ No se recibió access_token en la respuesta');
            return null;
        }

    } catch (error) {
        logger.error('🔑 [App Token] ❌ Error obteniendo App Access Token:', error.message);

        if (error.response) {
            logger.error('🔑 [App Token] Status:', error.response.status);
            logger.error('🔑 [App Token] Response:', error.response.data);
        }

        return null;
    }
}

/**
 * Suscribirse a todos los eventos usando App Access Token
 * @param {string} broadcasterUserId - ID del broadcaster
 * @returns {Promise<Object>} Resultado de la suscripción
 */
async function subscribeToEventsWithAppToken(broadcasterUserId) {
    try {
        logger.info('🎯 [App Webhook] Iniciando suscripción con App Token para broadcaster:', broadcasterUserId);

        // 1. Obtener App Access Token
        const appToken = await getAppAccessToken();
        if (!appToken) {
            throw new Error('No se pudo obtener App Access Token');
        }

        // 2. Lista de eventos a suscribir
        const events = [
            { name: 'chat.message.sent', version: 1 },
            { name: 'channel.followed', version: 1 },
            { name: 'channel.subscription.new', version: 1 },
            { name: 'channel.subscription.renewal', version: 1 },
            { name: 'channel.subscription.gifts', version: 1 },
            { name: 'livestream.status.updated', version: 1 },
            { name: 'livestream.metadata.updated', version: 1 }
        ];

        // 3. Suscribirse a eventos
        const subscribeUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;

        const payload = {
            broadcaster_user_id: parseInt(broadcasterUserId),
            events: events,
            method: 'webhook',
            webhook_url: 'https://api.luisardito.com/api/kick-webhook/events'
        };

        logger.info('🎯 [App Webhook] Payload:', JSON.stringify(payload, null, 2));

        const response = await axios.post(subscribeUrl, payload, {
            headers: {
                'Authorization': `Bearer ${appToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        logger.info('🎯 [App Webhook] Respuesta de Kick:', JSON.stringify(response.data, null, 2));

        // 4. Procesar respuesta y guardar suscripciones
        const subscriptionsData = response.data.data || [];
        const createdSubscriptions = [];
        const errors = [];

        for (const sub of subscriptionsData) {
            if (sub.subscription_id && !sub.error) {
                try {
                    // Verificar si ya existe
                    let localSub = await KickEventSubscription.findOne({
                        where: { subscription_id: sub.subscription_id }
                    });

                    if (localSub) {
                        // Actualizar existente
                        await localSub.update({
                            broadcaster_user_id: parseInt(broadcasterUserId),
                            event_type: sub.name,
                            event_version: sub.version,
                            method: 'webhook',
                            status: 'active',
                            app_id: 'APP_TOKEN' // Marcar como App Token
                        });
                        logger.info(`🎯 [App Webhook] ✅ ${sub.name} actualizado (App Token)`);
                    } else {
                        // Crear nuevo
                        localSub = await KickEventSubscription.create({
                            subscription_id: sub.subscription_id,
                            broadcaster_user_id: parseInt(broadcasterUserId),
                            event_type: sub.name,
                            event_version: sub.version,
                            method: 'webhook',
                            status: 'active',
                            app_id: 'APP_TOKEN' // Marcar como App Token
                        });
                        logger.info(`🎯 [App Webhook] ✅ ${sub.name} creado (App Token)`);
                    }

                    createdSubscriptions.push(localSub);

                } catch (dbError) {
                    logger.error(`🎯 [App Webhook] ❌ Error DB ${sub.name}:`, dbError.message);
                    errors.push({ event: sub.name, error: dbError.message });
                }
            } else if (sub.error) {
                errors.push({ event: sub.name, error: sub.error });
                logger.error(`🎯 [App Webhook] ❌ ${sub.name}:`, sub.error);
            }
        }

        const result = {
            success: createdSubscriptions.length > 0,
            totalSubscribed: createdSubscriptions.length,
            totalErrors: errors.length,
            subscriptions: createdSubscriptions,
            errors,
            kickResponse: response.data,
            tokenType: 'APP_TOKEN',
            permanent: true
        };

        logger.info(`🎯 [App Webhook] ✅ Completado: ${result.totalSubscribed} eventos configurados con App Token`);
        logger.info('🎯 [App Webhook] 🚀 ¡Webhooks permanentes activados! No requieren re-autenticación.');

        return result;

    } catch (error) {
        logger.error('🎯 [App Webhook] ❌ Error:', error.message);

        if (error.response) {
            logger.error('🎯 [App Webhook] API Error:', error.response.status, error.response.data);
        }

        return {
            success: false,
            error: error.message,
            tokenType: 'APP_TOKEN',
            permanent: false
        };
    }
}

/**
 * Verificar si los webhooks con App Token están funcionando
 * @param {string} broadcasterUserId - ID del broadcaster
 * @returns {Promise<Object>} Estado de los webhooks
 */
async function checkAppTokenWebhooksStatus(broadcasterUserId) {
    try {
        // Contar suscripciones de App Token
        const appTokenSubs = await KickEventSubscription.count({
            where: {
                broadcaster_user_id: parseInt(broadcasterUserId),
                app_id: 'APP_TOKEN',
                status: 'active'
            }
        });

        // Contar suscripciones de User Token
        const userTokenSubs = await KickEventSubscription.count({
            where: {
                broadcaster_user_id: parseInt(broadcasterUserId),
                app_id: { [require('sequelize').Op.ne]: 'APP_TOKEN' },
const logger = require('../utils/logger');
                status: 'active'
            }
        });

        return {
            app_token_subscriptions: appTokenSubs,
            user_token_subscriptions: userTokenSubs,
            total_subscriptions: appTokenSubs + userTokenSubs,
            is_permanent: appTokenSubs > 0,
            requires_user_auth: appTokenSubs === 0 && userTokenSubs > 0
        };

    } catch (error) {
        logger.error('🎯 [App Webhook Status] Error:', error.message);
        return {
            error: error.message,
            app_token_subscriptions: 0,
            user_token_subscriptions: 0,
            total_subscriptions: 0,
            is_permanent: false,
            requires_user_auth: true
        };
    }
}

module.exports = {
    getAppAccessToken,
    subscribeToEventsWithAppToken,
    checkAppTokenWebhooksStatus
};
