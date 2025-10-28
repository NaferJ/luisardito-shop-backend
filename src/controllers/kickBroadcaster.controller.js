const { KickBroadcasterToken, KickEventSubscription } = require('../models');
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

        // Verificar suscripciones activas (puede usar App Token o User Token)
        console.log(`[Broadcaster Status] Buscando suscripciones para broadcaster ${mainBroadcasterId}`);

        const subscriptions = await KickEventSubscription.findAll({
            where: {
                broadcaster_user_id: parseInt(mainBroadcasterId),
                status: 'active'
            }
        });

        console.log(`[Broadcaster Status] Suscripciones encontradas: ${subscriptions.length}`);

        // Si hay suscripciones activas, el sistema está conectado (App Token o User Token)
        if (subscriptions.length > 0) {
            console.log(`[Broadcaster Status] Eventos:`, subscriptions.map(s => s.event_type));

            // Verificar si es sistema permanente (App Token) o temporal (User Token)
            const appTokenSubscriptions = subscriptions.filter(s => s.app_id === 'APP_TOKEN');
            const isPermanent = appTokenSubscriptions.length > 0;

            return res.json({
                connected: true,
                system_type: isPermanent ? 'PERMANENT' : 'TEMPORARY',
                broadcaster: {
                    kick_user_id: mainBroadcasterId,
                    kick_username: "Luisardito",
                    connected_at: subscriptions[0].created_at,
                    last_updated: new Date()
                },
                token: {
                    type: isPermanent ? 'App Token (Permanente)' : 'User Token (Temporal)',
                    expires_at: isPermanent ? null : 'Variable según user token',
                    is_expired: false,
                    requires_maintenance: !isPermanent
                },
                subscriptions: {
                    auto_subscribed: true,
                    total_active: subscriptions.length,
                    permanent_webhooks: isPermanent,
                    events: subscriptions.map(s => ({
                        event_type: s.event_type,
                        event_version: s.event_version,
                        subscription_id: s.subscription_id,
                        token_type: s.app_id === 'APP_TOKEN' ? 'App Token' : 'User Token',
                        created_at: s.created_at
                    }))
                }
            });
        }

        // Si no hay suscripciones, verificar tokens de usuario como fallback
        const broadcasterToken = await KickBroadcasterToken.findOne({
            where: { is_active: true },
            order: [['created_at', 'DESC']]
        });

        if (!broadcasterToken) {
            return res.json({
                connected: false,
                system_type: 'DISCONNECTED',
                message: 'No hay tokens activos ni suscripciones disponibles'
            });
        }

        // Verificar si el token expiró
        const now = new Date();
        const isTokenExpired = broadcasterToken.token_expires_at && broadcasterToken.token_expires_at < now;

        return res.json({
            connected: true,
            system_type: 'TEMPORARY',
            broadcaster: {
                kick_user_id: mainBroadcasterId,
                kick_username: "Luisardito",
                connected_at: broadcasterToken.created_at,
                last_updated: broadcasterToken.updated_at
            },
            token: {
                type: 'User Token (Temporal)',
                expires_at: broadcasterToken.token_expires_at,
                is_expired: isTokenExpired,
                has_refresh_token: !!broadcasterToken.refresh_token,
                provided_by: broadcasterToken.kick_username,
                requires_maintenance: true
            },
            subscriptions: {
                auto_subscribed: broadcasterToken.auto_subscribed,
                total_active: 0,
                permanent_webhooks: false,
                last_attempt: broadcasterToken.last_subscription_attempt,
                error: broadcasterToken.subscription_error,
                events: []
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
