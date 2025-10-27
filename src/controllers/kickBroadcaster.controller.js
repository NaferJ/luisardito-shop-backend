const { KickBroadcasterToken, KickEventSubscription } = require('../models');
const { hasActiveSubscriptions } = require('../services/kickAutoSubscribe.service');
const tokenRefreshService = require('../services/tokenRefresh.service');
const config = require('../../config');

/**
 * Verifica el estado de conexión del broadcaster
 */
exports.getConnectionStatus = async (req, res) => {
    try {
        // Obtener el broadcaster principal de la configuración
        const mainBroadcasterId = config.kick.broadcasterId;

        if (!mainBroadcasterId) {
            return res.json({
                connected: false,
                message: 'No hay broadcaster principal configurado'
            });
        }

        // Buscar cualquier token activo (puede ser de cualquier admin)
        const broadcasterToken = await KickBroadcasterToken.findOne({
            where: { is_active: true },
            order: [['created_at', 'DESC']]
        });

        if (!broadcasterToken) {
            return res.json({
                connected: false,
                message: 'No hay tokens activos disponibles'
            });
        }

        // Verificar suscripciones activas del BROADCASTER PRINCIPAL
        console.log(`[Broadcaster Status] Buscando suscripciones para broadcaster ${mainBroadcasterId}`);

        const subscriptions = await KickEventSubscription.findAll({
            where: {
                broadcaster_user_id: parseInt(mainBroadcasterId), // Siempre del broadcaster principal
                status: 'active'
            }
        });

        console.log(`[Broadcaster Status] Suscripciones encontradas: ${subscriptions.length}`);
        if (subscriptions.length > 0) {
            console.log(`[Broadcaster Status] Eventos:`, subscriptions.map(s => s.event_type));
        }

        // Verificar si el token expiró
        const now = new Date();
        const isTokenExpired = broadcasterToken.token_expires_at && broadcasterToken.token_expires_at < now;

        return res.json({
            connected: true,
            broadcaster: {
                kick_user_id: mainBroadcasterId, // Siempre mostrar el broadcaster principal
                kick_username: "Luisardito", // Nombre del broadcaster principal
                connected_at: broadcasterToken.created_at,
                last_updated: broadcasterToken.updated_at
            },
            token: {
                expires_at: broadcasterToken.token_expires_at,
                is_expired: isTokenExpired,
                has_refresh_token: !!broadcasterToken.refresh_token,
                provided_by: broadcasterToken.kick_username // Quién provee el token
            },
            subscriptions: {
                auto_subscribed: broadcasterToken.auto_subscribed,
                total_active: subscriptions.length,
                last_attempt: broadcasterToken.last_subscription_attempt,
                error: broadcasterToken.subscription_error,
                events: subscriptions.map(s => ({
                    event_type: s.event_type,
                    event_version: s.event_version,
                    subscription_id: s.subscription_id,
                    created_at: s.created_at
                }))
            }
        });

    } catch (error) {
        console.error('[Kick Broadcaster] Error obteniendo estado:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Desconecta el broadcaster (desactiva el token)
 */
exports.disconnect = async (req, res) => {
    try {
        const mainBroadcasterId = config.kick.broadcasterId;

        const broadcasterToken = await KickBroadcasterToken.findOne({
            where: { is_active: true },
            order: [['created_at', 'DESC']]
        });

        if (!broadcasterToken) {
            return res.status(404).json({ error: 'No hay broadcaster conectado' });
        }

        await broadcasterToken.update({
            is_active: false
        });

        // Desactivar las suscripciones del broadcaster principal
        if (mainBroadcasterId) {
            await KickEventSubscription.update(
                { status: 'inactive' },
                {
                    where: {
                        broadcaster_user_id: parseInt(mainBroadcasterId),
                        status: 'active'
                    }
                }
            );
        }

        return res.json({
            message: 'Broadcaster desconectado exitosamente',
            broadcaster: 'Luisardito',
            token_provider: broadcasterToken.kick_username
        });

    } catch (error) {
        console.error('[Kick Broadcaster] Error desconectando:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Obtiene el token activo del broadcaster (solo para uso interno/admin)
 */
exports.getActiveToken = async (req, res) => {
    try {
        // TODO: Agregar verificación de permisos de admin

        const broadcasterToken = await KickBroadcasterToken.findOne({
            where: { is_active: true },
            order: [['created_at', 'DESC']]
        });

        if (!broadcasterToken) {
            return res.status(404).json({ error: 'No hay broadcaster conectado' });
        }

        // No exponer el token completo por seguridad
        return res.json({
            kick_user_id: broadcasterToken.kick_user_id,
            kick_username: broadcasterToken.kick_username,
            token_preview: broadcasterToken.access_token ?
                `${broadcasterToken.access_token.substring(0, 10)}...` : null,
            token_expires_at: broadcasterToken.token_expires_at,
            has_refresh_token: !!broadcasterToken.refresh_token,
            auto_subscribed: broadcasterToken.auto_subscribed
        });

    } catch (error) {
        console.error('[Kick Broadcaster] Error obteniendo token:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Refresca manualmente el token del broadcaster activo
 */
exports.refreshToken = async (req, res) => {
    try {
        const broadcasterToken = await KickBroadcasterToken.findOne({
            where: { is_active: true },
            order: [['created_at', 'DESC']]
        });

        if (!broadcasterToken) {
            return res.status(404).json({ error: 'No hay broadcaster conectado' });
        }

        const result = await tokenRefreshService.forceRefresh(broadcasterToken.kick_user_id);

        if (result.success) {
            // Recargar el token actualizado
            await broadcasterToken.reload();

            return res.json({
                message: 'Token refrescado exitosamente',
                broadcaster: broadcasterToken.kick_username,
                new_expires_at: broadcasterToken.token_expires_at
            });
        } else {
            return res.status(400).json({
                error: 'No se pudo refrescar el token',
                details: result.error
            });
        }

    } catch (error) {
        console.error('[Kick Broadcaster] Error refrescando token:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Obtiene el estado del servicio de refresh automático
 */
exports.getRefreshServiceStatus = async (req, res) => {
    try {
        const status = tokenRefreshService.getStatus();
        return res.json(status);
    } catch (error) {
        console.error('[Kick Broadcaster] Error obteniendo estado del servicio:', error.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};

/**
 * Debug endpoint para verificar configuración
 */
exports.debugConfig = async (req, res) => {
    try {
        return res.json({
            config: {
                broadcasterId: config.kick.broadcasterId,
                hasBroadcasterId: !!config.kick.broadcasterId,
                nodeEnv: process.env.NODE_ENV,
                kickBroadcasterIdEnv: process.env.KICK_BROADCASTER_ID
            },
            tokenCount: await KickBroadcasterToken.count({ where: { is_active: true } }),
            subscriptionCount: await KickEventSubscription.count({ where: { status: 'active' } }),
            subscriptionsByBroadcaster: await KickEventSubscription.count({
                where: {
                    broadcaster_user_id: config.kick.broadcasterId ? parseInt(config.kick.broadcasterId) : null,
                    status: 'active'
                }
            })
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
