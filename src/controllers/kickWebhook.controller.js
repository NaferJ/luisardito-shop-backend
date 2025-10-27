const { verifyWebhookSignature } = require('../utils/kickWebhook.util');
const {
    KickWebhookEvent,
    KickPointsConfig,
    KickChatCooldown,
    KickUserTracking,
    Usuario,
    HistorialPunto
} = require('../models');
const { Op } = require('sequelize');

/**
 * Endpoint específico para probar CORS de webhooks
 */
exports.testCors = async (req, res) => {
    console.log('🧪 [CORS Test] ==========================================');
    console.log('🧪 [CORS Test] Method:', req.method);
    console.log('🧪 [CORS Test] Origin:', req.headers.origin || 'SIN ORIGIN');
    console.log('🧪 [CORS Test] User-Agent:', req.headers['user-agent']);
    console.log('🧪 [CORS Test] Headers:', Object.keys(req.headers));
    console.log('🧪 [CORS Test] ==========================================');

    res.status(200).json({
        message: '✅ CORS funcionando correctamente para webhooks',
        timestamp: new Date().toISOString(),
        method: req.method,
        origin: req.headers.origin || 'Sin origin',
        headers: req.headers,
        corsEnabled: true
    });
};

/**
 * Controlador principal para recibir webhooks de Kick
 */
exports.handleWebhook = async (req, res) => {
    // LOG UNIVERSAL - captura CUALQUIER petición que llegue
    console.log('🚨 [Kick Webhook] ==========================================');
    console.log('🚨 [Kick Webhook] PETICIÓN RECIBIDA EN /api/kick-webhook/events');
    console.log('🚨 [Kick Webhook] Timestamp:', new Date().toISOString());
    console.log('🚨 [Kick Webhook] Method:', req.method);
    console.log('🚨 [Kick Webhook] URL:', req.url);
    console.log('🚨 [Kick Webhook] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('🚨 [Kick Webhook] Body:', JSON.stringify(req.body, null, 2));
    console.log('🚨 [Kick Webhook] IP:', req.ip);
    console.log('🚨 [Kick Webhook] User-Agent:', req.headers['user-agent']);
    console.log('🚨 [Kick Webhook] ==========================================');

    try {
        // Si es una petición de test simple, responder inmediatamente
        if (req.body && req.body.test === true) {
            console.log('🔧 [Kick Webhook] Petición de test detectada');
            return res.status(200).json({
                status: 'success',
                message: 'Test webhook received',
                timestamp: new Date().toISOString()
            });
        }

        // Extraer headers del webhook
        const messageId = req.headers['kick-event-message-id'];
        const subscriptionId = req.headers['kick-event-subscription-id'];
        const signature = req.headers['kick-event-signature'];
        const timestamp = req.headers['kick-event-message-timestamp'];
        const eventType = req.headers['kick-event-type'];
        const eventVersion = req.headers['kick-event-version'];

        console.log('[Kick Webhook] Evento recibido:', {
            messageId,
            subscriptionId,
            eventType,
            eventVersion,
            timestamp
        });

        // Si faltan headers de webhook de Kick, pero hay contenido, puede ser una verificación
        if (!messageId && !eventType) {
            console.log('⚠️ [Kick Webhook] Petición sin headers de Kick - posible verificación');
            return res.status(200).json({ message: 'Webhook endpoint ready' });
        }

        // Validar que existen los headers necesarios
        if (!messageId || !signature || !timestamp || !eventType) {
            console.error('[Kick Webhook] Faltan headers requeridos');
            return res.status(400).json({ error: 'Faltan headers requeridos' });
        }

        // Obtener el cuerpo sin procesar como string
        const rawBody = JSON.stringify(req.body);

        // Verificar la firma del webhook
        const isValidSignature = verifyWebhookSignature(messageId, timestamp, rawBody, signature);

        if (!isValidSignature) {
            console.error('[Kick Webhook] Firma inválida');
            return res.status(401).json({ error: 'Firma inválida' });
        }

        console.log('[Kick Webhook] Firma verificada correctamente');

        // Verificar si el evento ya fue procesado (idempotencia)
        const existingEvent = await KickWebhookEvent.findOne({
            where: { message_id: messageId }
        });

        if (existingEvent) {
            console.log('[Kick Webhook] Evento duplicado, ya fue procesado:', messageId);
            return res.status(200).json({ message: 'Evento ya procesado previamente' });
        }

        // Guardar el evento en la base de datos
        await KickWebhookEvent.create({
            message_id: messageId,
            subscription_id: subscriptionId,
            event_type: eventType,
            event_version: eventVersion,
            message_timestamp: new Date(timestamp),
            payload: req.body,
            processed: false
        });

        // Procesar el evento según su tipo
        await processWebhookEvent(eventType, eventVersion, req.body, {
            messageId,
            subscriptionId,
            timestamp
        });

        // Marcar como procesado
        await KickWebhookEvent.update(
            { processed: true, processed_at: new Date() },
            { where: { message_id: messageId } }
        );

        // Responder con 200 para confirmar recepción
        return res.status(200).json({ message: 'Webhook procesado correctamente' });

    } catch (error) {
        console.error('[Kick Webhook] Error procesando webhook:', error.message);
        return res.status(500).json({ error: 'Error interno al procesar webhook' });
    }
};

/**
 * Procesa el evento según su tipo
 * @param {string} eventType - Tipo de evento (ej: chat.message.sent)
 * @param {string} eventVersion - Versión del evento
 * @param {object} payload - Datos del evento
 * @param {object} metadata - Metadatos del webhook (messageId, subscriptionId, timestamp)
 */
async function processWebhookEvent(eventType, eventVersion, payload, metadata) {
    console.log(`[Kick Webhook] Procesando evento ${eventType} v${eventVersion}`, payload);

    switch (eventType) {
        case 'chat.message.sent':
            await handleChatMessage(payload, metadata);
            break;

        case 'channel.followed':
            await handleChannelFollowed(payload, metadata);
            break;

        case 'channel.subscription.new':
            await handleNewSubscription(payload, metadata);
            break;

        case 'channel.subscription.renewal':
            await handleSubscriptionRenewal(payload, metadata);
            break;

        case 'channel.subscription.gifts':
            await handleSubscriptionGifts(payload, metadata);
            break;

        case 'livestream.status.updated':
            await handleLivestreamStatusUpdated(payload, metadata);
            break;

        case 'livestream.metadata.updated':
            await handleLivestreamMetadataUpdated(payload, metadata);
            break;

        case 'moderation.banned':
            await handleModerationBanned(payload, metadata);
            break;

        default:
            console.log(`[Kick Webhook] Tipo de evento no manejado: ${eventType}`);
    }
}

// ============================================================================
// Handlers para cada tipo de evento
// ============================================================================

/**
 * Maneja mensajes de chat
 */
async function handleChatMessage(payload, metadata) {
    try {
        const sender = payload.sender;
        const kickUserId = String(sender.user_id);
        const kickUsername = sender.username;

        console.log('[Kick Webhook][Chat Message]', {
            messageId: payload.message_id,
            sender: kickUsername,
            content: payload.content,
            broadcaster: payload.broadcaster.username
        });

        // Verificar si el usuario existe en nuestra BD
        const usuario = await Usuario.findOne({
            where: { user_id_ext: kickUserId }
        });

        if (!usuario) {
            console.log(`[Kick Webhook][Chat Message] Usuario ${kickUsername} no registrado en la BD`);
            return;
        }

        // Obtener configuración de puntos
        const configs = await KickPointsConfig.findAll({
            where: { enabled: true }
        });

        const configMap = {};
        configs.forEach(c => {
            configMap[c.config_key] = c.config_value;
        });

        // Determinar si es suscriptor
        const userTracking = await KickUserTracking.findOne({
            where: { kick_user_id: kickUserId }
        });

        const isSubscriber = userTracking?.is_subscribed || false;
        const pointsKey = isSubscriber ? 'chat_points_subscriber' : 'chat_points_regular';
        const pointsToAward = configMap[pointsKey] || 0;

        if (pointsToAward <= 0) {
            console.log('[Kick Webhook][Chat Message] Puntos por chat deshabilitados');
            return;
        }

        // Verificar cooldown (5 minutos)
        const now = new Date();
        const cooldown = await KickChatCooldown.findOne({
            where: { kick_user_id: kickUserId }
        });

        if (cooldown && cooldown.cooldown_expires_at > now) {
            console.log(`[Kick Webhook][Chat Message] Usuario ${kickUsername} en cooldown hasta ${cooldown.cooldown_expires_at}`);
            return;
        }

        // Otorgar puntos
        await usuario.increment('puntos', { by: pointsToAward });

        // Registrar en historial
        await HistorialPunto.create({
            usuario_id: usuario.id,
            puntos: pointsToAward,
            tipo: 'ganado',
            concepto: `Mensaje en chat (${isSubscriber ? 'suscriptor' : 'regular'})`,
            kick_event_data: {
                event_type: 'chat.message.sent',
                message_id: payload.message_id,
                kick_user_id: kickUserId,
                kick_username: kickUsername
            }
        });

        // Actualizar o crear cooldown
        const cooldownExpiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutos
        await KickChatCooldown.upsert({
            kick_user_id: kickUserId,
            kick_username: kickUsername,
            last_message_at: now,
            cooldown_expires_at: cooldownExpiresAt
        });

        console.log(`[Kick Webhook][Chat Message] ✅ ${pointsToAward} puntos otorgados a ${kickUsername}`);

    } catch (error) {
        console.error('[Kick Webhook][Chat Message] Error:', error.message);
    }
}

/**
 * Maneja nuevos seguidores
 */
async function handleChannelFollowed(payload, metadata) {
    try {
        const follower = payload.follower;
        const kickUserId = String(follower.user_id);
        const kickUsername = follower.username;

        console.log('[Kick Webhook][Channel Followed]', {
            broadcaster: payload.broadcaster.username,
            follower: kickUsername
        });

        // Verificar si el usuario existe en nuestra BD
        const usuario = await Usuario.findOne({
            where: { user_id_ext: kickUserId }
        });

        if (!usuario) {
            console.log(`[Kick Webhook][Channel Followed] Usuario ${kickUsername} no registrado en la BD`);
            return;
        }

        // Verificar si ya siguió antes (solo primera vez)
        let userTracking = await KickUserTracking.findOne({
            where: { kick_user_id: kickUserId }
        });

        if (userTracking && userTracking.follow_points_awarded) {
            console.log(`[Kick Webhook][Channel Followed] Usuario ${kickUsername} ya recibió puntos por follow anteriormente`);
            return;
        }

        // Obtener configuración de puntos por follow
        const config = await KickPointsConfig.findOne({
            where: {
                config_key: 'follow_points',
                enabled: true
            }
        });

        const pointsToAward = config?.config_value || 0;

        if (pointsToAward <= 0) {
            console.log('[Kick Webhook][Channel Followed] Puntos por follow deshabilitados');
            return;
        }

        // Otorgar puntos
        await usuario.increment('puntos', { by: pointsToAward });

        // Registrar en historial
        await HistorialPunto.create({
            usuario_id: usuario.id,
            puntos: pointsToAward,
            tipo: 'ganado',
            concepto: 'Primer follow al canal',
            kick_event_data: {
                event_type: 'channel.followed',
                kick_user_id: kickUserId,
                kick_username: kickUsername
            }
        });

        // Actualizar o crear tracking
        if (!userTracking) {
            userTracking = await KickUserTracking.create({
                kick_user_id: kickUserId,
                kick_username: kickUsername,
                has_followed: true,
                first_follow_at: new Date(),
                follow_points_awarded: true
            });
        } else {
            await userTracking.update({
                has_followed: true,
                first_follow_at: userTracking.first_follow_at || new Date(),
                follow_points_awarded: true
            });
        }

        console.log(`[Kick Webhook][Channel Followed] ✅ ${pointsToAward} puntos otorgados a ${kickUsername} (primer follow)`);

    } catch (error) {
        console.error('[Kick Webhook][Channel Followed] Error:', error.message);
    }
}

/**
 * Maneja nuevas suscripciones
 */
async function handleNewSubscription(payload, metadata) {
    try {
        const subscriber = payload.subscriber;
        const kickUserId = String(subscriber.user_id);
        const kickUsername = subscriber.username;
        const duration = payload.duration;
        const expiresAt = new Date(payload.expires_at);

        console.log('[Kick Webhook][New Subscription]', {
            broadcaster: payload.broadcaster.username,
            subscriber: kickUsername,
            duration,
            expires_at: expiresAt
        });

        // Verificar si el usuario existe en nuestra BD
        const usuario = await Usuario.findOne({
            where: { user_id_ext: kickUserId }
        });

        if (!usuario) {
            console.log(`[Kick Webhook][New Subscription] Usuario ${kickUsername} no registrado en la BD`);
            return;
        }

        // Obtener configuración de puntos por nueva suscripción
        const config = await KickPointsConfig.findOne({
            where: {
                config_key: 'subscription_new_points',
                enabled: true
            }
        });

        const pointsToAward = config?.config_value || 0;

        if (pointsToAward > 0) {
            // Otorgar puntos
            await usuario.increment('puntos', { by: pointsToAward });

            // Registrar en historial
            await HistorialPunto.create({
                usuario_id: usuario.id,
                puntos: pointsToAward,
                tipo: 'ganado',
                concepto: `Nueva suscripción (${duration} ${duration === 1 ? 'mes' : 'meses'})`,
                kick_event_data: {
                    event_type: 'channel.subscription.new',
                    kick_user_id: kickUserId,
                    kick_username: kickUsername,
                    duration,
                    expires_at: expiresAt
                }
            });
        }

        // Actualizar tracking de usuario
        await KickUserTracking.upsert({
            kick_user_id: kickUserId,
            kick_username: kickUsername,
            is_subscribed: true,
            subscription_expires_at: expiresAt,
            subscription_duration_months: duration,
            total_subscriptions: KickUserTracking.sequelize.literal('total_subscriptions + 1')
        });

        console.log(`[Kick Webhook][New Subscription] ✅ ${pointsToAward} puntos otorgados a ${kickUsername}, sub hasta ${expiresAt}`);

    } catch (error) {
        console.error('[Kick Webhook][New Subscription] Error:', error.message);
    }
}

/**
 * Maneja renovaciones de suscripción
 */
async function handleSubscriptionRenewal(payload, metadata) {
    try {
        const subscriber = payload.subscriber;
        const kickUserId = String(subscriber.user_id);
        const kickUsername = subscriber.username;
        const duration = payload.duration;
        const expiresAt = new Date(payload.expires_at);

        console.log('[Kick Webhook][Subscription Renewal]', {
            broadcaster: payload.broadcaster.username,
            subscriber: kickUsername,
            duration,
            expires_at: expiresAt
        });

        // Verificar si el usuario existe en nuestra BD
        const usuario = await Usuario.findOne({
            where: { user_id_ext: kickUserId }
        });

        if (!usuario) {
            console.log(`[Kick Webhook][Subscription Renewal] Usuario ${kickUsername} no registrado en la BD`);
            return;
        }

        // Obtener configuración de puntos por renovación
        const config = await KickPointsConfig.findOne({
            where: {
                config_key: 'subscription_renewal_points',
                enabled: true
            }
        });

        const pointsToAward = config?.config_value || 0;

        if (pointsToAward > 0) {
            // Otorgar puntos
            await usuario.increment('puntos', { by: pointsToAward });

            // Registrar en historial
            await HistorialPunto.create({
                usuario_id: usuario.id,
                puntos: pointsToAward,
                tipo: 'ganado',
                concepto: `Renovación de suscripción (${duration} ${duration === 1 ? 'mes' : 'meses'})`,
                kick_event_data: {
                    event_type: 'channel.subscription.renewal',
                    kick_user_id: kickUserId,
                    kick_username: kickUsername,
                    duration,
                    expires_at: expiresAt
                }
            });
        }

        // Actualizar tracking de usuario
        await KickUserTracking.upsert({
            kick_user_id: kickUserId,
            kick_username: kickUsername,
            is_subscribed: true,
            subscription_expires_at: expiresAt,
            subscription_duration_months: duration,
            total_subscriptions: KickUserTracking.sequelize.literal('total_subscriptions + 1')
        });

        console.log(`[Kick Webhook][Subscription Renewal] ✅ ${pointsToAward} puntos otorgados a ${kickUsername}, sub renovada hasta ${expiresAt}`);

    } catch (error) {
        console.error('[Kick Webhook][Subscription Renewal] Error:', error.message);
    }
}

/**
 * Maneja regalos de suscripciones
 */
async function handleSubscriptionGifts(payload, metadata) {
    try {
        const gifter = payload.gifter;
        const giftees = payload.giftees || [];
        const expiresAt = new Date(payload.expires_at);

        console.log('[Kick Webhook][Subscription Gifts]', {
            broadcaster: payload.broadcaster.username,
            gifter: gifter.is_anonymous ? 'Anónimo' : gifter.username,
            giftees: giftees.map(g => g.username),
            totalGifts: giftees.length
        });

        // Obtener configuraciones de puntos
        const configs = await KickPointsConfig.findAll({
            where: {
                config_key: ['gift_given_points', 'gift_received_points'],
                enabled: true
            }
        });

        const configMap = {};
        configs.forEach(c => {
            configMap[c.config_key] = c.config_value;
        });

        const pointsForGifter = configMap['gift_given_points'] || 0;
        const pointsForGiftee = configMap['gift_received_points'] || 0;

        // Otorgar puntos al que regala (si no es anónimo)
        if (!gifter.is_anonymous && pointsForGifter > 0) {
            const gifterKickUserId = String(gifter.user_id);
            const gifterUsuario = await Usuario.findOne({
                where: { user_id_ext: gifterKickUserId }
            });

            if (gifterUsuario) {
                const totalPoints = pointsForGifter * giftees.length;
                await gifterUsuario.increment('puntos', { by: totalPoints });

                await HistorialPunto.create({
                    usuario_id: gifterUsuario.id,
                    puntos: totalPoints,
                    tipo: 'ganado',
                    concepto: `Regaló ${giftees.length} suscripción${giftees.length !== 1 ? 'es' : ''}`,
                    kick_event_data: {
                        event_type: 'channel.subscription.gifts',
                        kick_user_id: gifterKickUserId,
                        kick_username: gifter.username,
                        gifts_count: giftees.length
                    }
                });

                // Actualizar tracking del que regala
                await KickUserTracking.upsert({
                    kick_user_id: gifterKickUserId,
                    kick_username: gifter.username,
                    total_gifts_given: KickUserTracking.sequelize.literal(`total_gifts_given + ${giftees.length}`)
                });

                console.log(`[Kick Webhook][Subscription Gifts] ✅ ${totalPoints} puntos a ${gifter.username} por regalar ${giftees.length} subs`);
            }
        }

        // Otorgar puntos a cada giftee
        if (pointsForGiftee > 0) {
            for (const giftee of giftees) {
                const gifteeKickUserId = String(giftee.user_id);
                const gifteeUsername = giftee.username;

                const gifteeUsuario = await Usuario.findOne({
                    where: { user_id_ext: gifteeKickUserId }
                });

                if (gifteeUsuario) {
                    await gifteeUsuario.increment('puntos', { by: pointsForGiftee });

                    await HistorialPunto.create({
                        usuario_id: gifteeUsuario.id,
                        puntos: pointsForGiftee,
                        tipo: 'ganado',
                        concepto: `Suscripción regalada recibida`,
                        kick_event_data: {
                            event_type: 'channel.subscription.gifts',
                            kick_user_id: gifteeKickUserId,
                            kick_username: gifteeUsername,
                            gifter: gifter.is_anonymous ? 'Anónimo' : gifter.username,
                            expires_at: expiresAt
                        }
                    });

                    // Actualizar tracking del que recibe
                    await KickUserTracking.upsert({
                        kick_user_id: gifteeKickUserId,
                        kick_username: gifteeUsername,
                        is_subscribed: true,
                        subscription_expires_at: expiresAt,
                        total_gifts_received: KickUserTracking.sequelize.literal('total_gifts_received + 1'),
                        total_subscriptions: KickUserTracking.sequelize.literal('total_subscriptions + 1')
                    });

                    console.log(`[Kick Webhook][Subscription Gifts] ✅ ${pointsForGiftee} puntos a ${gifteeUsername} por recibir sub regalada`);
                }
            }
        }

    } catch (error) {
        console.error('[Kick Webhook][Subscription Gifts] Error:', error.message);
    }
}

/**
 * Maneja cambios de estado de transmisión
 */
async function handleLivestreamStatusUpdated(payload, metadata) {
    console.log('[Kick Webhook][Livestream Status]', {
        broadcaster: payload.broadcaster.username,
        is_live: payload.is_live,
        title: payload.title,
        started_at: payload.started_at,
        ended_at: payload.ended_at
    });

    // TODO: Implementar lógica de negocio (notificar usuarios, actualizar estado, etc.)
}

/**
 * Maneja actualizaciones de metadatos de transmisión
 */
async function handleLivestreamMetadataUpdated(payload, metadata) {
    console.log('[Kick Webhook][Livestream Metadata]', {
        broadcaster: payload.broadcaster.username,
        title: payload.metadata.title,
        category: payload.metadata.category?.name,
        language: payload.metadata.language,
        has_mature_content: payload.metadata.has_mature_content
    });

    // TODO: Implementar lógica de negocio (actualizar información de stream, etc.)
}

/**
 * Maneja baneos de moderación
 */
async function handleModerationBanned(payload, metadata) {
    console.log('[Kick Webhook][Moderation Banned]', {
        broadcaster: payload.broadcaster.username,
        moderator: payload.moderator.username,
        banned_user: payload.banned_user.username,
        reason: payload.metadata.reason,
        expires_at: payload.metadata.expires_at
    });

    // TODO: Implementar lógica de negocio (registrar baneo, actualizar permisos, etc.)
}

/**
 * Endpoint simple para verificar que Kick puede alcanzar el servidor
 * GET /webhook/test
 */
exports.testWebhook = async (req, res) => {
    console.log('[Kick Webhook] Test endpoint alcanzado');
    console.log('[Kick Webhook] Headers:', req.headers);
    console.log('[Kick Webhook] IP:', req.ip);
    console.log('[Kick Webhook] User-Agent:', req.headers['user-agent']);

    return res.json({
        status: 'success',
        message: 'Webhook endpoint is reachable',
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.headers['user-agent']
    });
};

/**
 * Endpoint para verificar la configuración del webhook
 * GET /webhook/debug
 */
exports.debugWebhook = async (req, res) => {
    try {
        const { KickEventSubscription } = require('../models');

        const subscriptions = await KickEventSubscription.findAll({
            where: { status: 'active' },
            attributes: ['id', 'subscription_id', 'broadcaster_user_id', 'event_type', 'created_at']
        });

        return res.json({
            activeSubscriptions: subscriptions.length,
            subscriptions: subscriptions,
            webhookUrl: 'https://api.luisardito.com/api/webhook/kick',
            expectedHeaders: [
                'kick-event-message-id',
                'kick-event-subscription-id',
                'kick-event-signature',
                'kick-event-message-timestamp',
                'kick-event-type',
                'kick-event-version'
            ]
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

/**
 * Endpoint temporal para simular un evento de chat y verificar que el procesamiento funciona
 * POST /api/kick-webhook/simulate-chat
 */
exports.simulateChat = async (req, res) => {
    try {
        console.log('[Webhook Simulator] Simulando evento de chat...');

        // Simular payload de chat message
        const simulatedPayload = {
            message_id: 'sim_' + Date.now(),
            content: 'Mensaje de prueba simulado',
            sender: {
                user_id: 33112734, // Tu user_id
                username: 'NaferJ'
            },
            broadcaster: {
                user_id: 2771761,
                username: 'Luisardito'
            },
            sent_at: new Date().toISOString()
        };

        const metadata = {
            messageId: simulatedPayload.message_id,
            subscriptionId: 'sim_subscription',
            timestamp: Date.now()
        };

        console.log('[Webhook Simulator] Procesando evento simulado...');

        // Procesar el evento como si fuera real
        await processWebhookEvent('chat.message.sent', 1, simulatedPayload, metadata);

        return res.json({
            status: 'success',
            message: 'Evento de chat simulado procesado',
            payload: simulatedPayload,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Webhook Simulator] Error:', error.message);
        return res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
};

/**
 * Endpoint para simular un webhook REAL de Kick (con headers y todo)
 * POST /api/kick-webhook/test-real-webhook
 */
exports.testRealWebhook = async (req, res) => {
    try {
        console.log('[Test Real Webhook] Simulando webhook REAL de Kick con headers...');

        // Simular headers exactos que envía Kick
        const mockHeaders = {
            'kick-event-message-id': 'test_' + Date.now(),
            'kick-event-subscription-id': '01K7JPFW2HYW4GCBQN85DVB9WG',
            'kick-event-signature': 'test_signature_' + Date.now(),
            'kick-event-message-timestamp': Date.now().toString(),
            'kick-event-type': 'chat.message.sent',
            'kick-event-version': '1',
            'content-type': 'application/json',
            'user-agent': 'Kick-Webhooks/1.0'
        };

        // Simular payload real de Kick
        const mockPayload = {
            message_id: 'real_test_' + Date.now(),
            content: '7',
            sender: {
                user_id: 33112734,
                username: 'NaferJ'
            },
            broadcaster: {
                user_id: 2771761,
                username: 'Luisardito'
            },
            sent_at: new Date().toISOString()
        };

        // Modificar el request para simular que viene de Kick
        req.headers = { ...req.headers, ...mockHeaders };
        req.body = mockPayload;

        console.log('[Test Real Webhook] Headers simulados:', mockHeaders);
        console.log('[Test Real Webhook] Payload simulado:', mockPayload);

        // Llamar al handler principal como si fuera un webhook real
        await this.handleWebhook(req, res);

    } catch (error) {
        console.error('[Test Real Webhook] Error:', error.message);
        return res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
};
