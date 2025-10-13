const axios = require('axios');
const config = require('../../config');
const { KickEventSubscription } = require('../models');

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
 * @param {string} accessToken - Token de acceso del broadcaster
 * @param {string} broadcasterUserId - ID del broadcaster en Kick
 * @returns {Promise<Object>} Resultado de la suscripción
 */
async function autoSubscribeToEvents(accessToken, broadcasterUserId) {
    try {
        console.log(`[Auto Subscribe] Iniciando suscripción para broadcaster ${broadcasterUserId}`);

        const apiUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;

        const payload = {
            broadcaster_user_id: parseInt(broadcasterUserId),
            events: DEFAULT_EVENTS,
            method: 'webhook'
        };

        console.log('[Auto Subscribe] Payload:', JSON.stringify(payload, null, 2));

        const response = await axios.post(apiUrl, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        console.log('[Auto Subscribe] Respuesta de Kick:', response.data);

        // Almacenar las suscripciones exitosas en la base de datos local
        const subscriptionsData = response.data.data || [];
        const createdSubscriptions = [];
        const errors = [];

        for (const sub of subscriptionsData) {
            if (sub.subscription_id && !sub.error) {
                try {
                    const localSub = await KickEventSubscription.create({
                        subscription_id: sub.subscription_id,
                        broadcaster_user_id: parseInt(broadcasterUserId),
                        event_type: sub.name,
                        event_version: sub.version,
                        method: 'webhook',
                        status: 'active'
                    });
                    createdSubscriptions.push(localSub);
                    console.log(`[Auto Subscribe] ✅ Suscrito a ${sub.name}`);
                } catch (dbError) {
                    console.error(`[Auto Subscribe] Error guardando suscripción ${sub.name}:`, dbError.message);
                }
            } else if (sub.error) {
                errors.push({ event: sub.name, error: sub.error });
                console.error(`[Auto Subscribe] ❌ Error en ${sub.name}:`, sub.error);
            }
        }

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

module.exports = {
    autoSubscribeToEvents,
    hasActiveSubscriptions,
    DEFAULT_EVENTS
};
