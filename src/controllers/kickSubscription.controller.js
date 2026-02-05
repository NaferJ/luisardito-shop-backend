const axios = require('axios');
const config = require('../../config');
const { KickEventSubscription } = require('../models');
const logger = require('../utils/logger');

/**
 * Obtiene todas las suscripciones a eventos de Kick
 */
exports.getSubscriptions = async (req, res) => {
    try {
        const { authorization } = req.headers;

        if (!authorization) {
            return res.status(401).json({ error: 'Token de autorización requerido' });
        }

        const apiUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;

        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': authorization
            },
            timeout: 10000
        });

        // También traemos las suscripciones almacenadas localmente
        const localSubscriptions = await KickEventSubscription.findAll({
            where: { status: 'active' },
            order: [['created_at', 'DESC']]
        });

        return res.json({
            kick_subscriptions: response.data.data || [],
            local_subscriptions: localSubscriptions,
            message: response.data.message
        });

    } catch (error) {
        logger.error('[Kick Subscription] Error obteniendo suscripciones:', error.message);

        if (error.response) {
            return res.status(error.response.status).json({
                error: 'Error al obtener suscripciones de Kick',
                message: error.response.data?.message || 'Error desconocido'
            });
        }

        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Crea nuevas suscripciones a eventos de Kick
 */
exports.createSubscriptions = async (req, res) => {
    try {
        const { authorization } = req.headers;
        const { broadcaster_user_id, events, method = 'webhook' } = req.body;

        if (!authorization) {
            return res.status(401).json({ error: 'Token de autorización requerido' });
        }

        if (!broadcaster_user_id || !events || !Array.isArray(events)) {
            return res.status(400).json({
                error: 'broadcaster_user_id y events (array) son requeridos'
            });
        }

        const apiUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;

        const payload = {
            broadcaster_user_id,
            events,
            method
        };

        const response = await axios.post(apiUrl, payload, {
            headers: {
                'Authorization': authorization,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        // Almacenar las suscripciones exitosas en la base de datos local
        const subscriptionsData = response.data.data || [];
        const createdSubscriptions = [];

        for (const sub of subscriptionsData) {
            if (sub.subscription_id && !sub.error) {
                try {
                    const localSub = await KickEventSubscription.create({
                        subscription_id: sub.subscription_id,
                        broadcaster_user_id,
                        event_type: sub.name,
                        event_version: sub.version,
                        method,
                        status: 'active'
                    });
                    createdSubscriptions.push(localSub);
                } catch (dbError) {
                    logger.error('[Kick Subscription] Error guardando suscripción localmente:', dbError.message);
                }
            }
        }

        return res.status(200).json({
            kick_response: response.data,
            local_subscriptions: createdSubscriptions,
            message: 'Suscripciones creadas exitosamente'
        });

    } catch (error) {
        logger.error('[Kick Subscription] Error creando suscripciones:', error.message);

        if (error.response) {
            return res.status(error.response.status).json({
                error: 'Error al crear suscripciones en Kick',
                message: error.response.data?.message || 'Error desconocido'
            });
        }

        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Elimina suscripciones a eventos de Kick
 */
exports.deleteSubscriptions = async (req, res) => {
    try {
        const { authorization } = req.headers;
        const { id } = req.query; // Puede ser un array o un string

        if (!authorization) {
            return res.status(401).json({ error: 'Token de autorización requerido' });
        }

        if (!id) {
            return res.status(400).json({ error: 'ID(s) de suscripción requerido(s)' });
        }

        const ids = Array.isArray(id) ? id : [id];
        const apiUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;

        // Crear query string con múltiples IDs
        const queryParams = ids.map(subId => `id=${encodeURIComponent(subId)}`).join('&');

        const response = await axios.delete(`${apiUrl}?${queryParams}`, {
            headers: {
                'Authorization': authorization
            },
            timeout: 10000
        });

        // Eliminar o marcar como inactivas las suscripciones locales
        await KickEventSubscription.update(
            { status: 'inactive' },
            { where: { subscription_id: ids } }
        );

        return res.status(204).json({
            message: 'Suscripciones eliminadas exitosamente',
            data: response.data
        });

    } catch (error) {
        logger.error('[Kick Subscription] Error eliminando suscripciones:', error.message);

        if (error.response) {
            return res.status(error.response.status).json({
                error: 'Error al eliminar suscripciones de Kick',
                message: error.response.data?.message || 'Error desconocido'
            });
        }

        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Obtiene todas las suscripciones almacenadas localmente
 */
exports.getLocalSubscriptions = async (req, res) => {
    try {
        const { status, event_type } = req.query;

        const whereClause = {};
        if (status) whereClause.status = status;
        if (event_type) whereClause.event_type = event_type;

        const subscriptions = await KickEventSubscription.findAll({
            where: whereClause,
            order: [['created_at', 'DESC']]
        });

        return res.json({
            subscriptions,
            total: subscriptions.length
        });

    } catch (error) {
        logger.error('[Kick Subscription] Error obteniendo suscripciones locales:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};
