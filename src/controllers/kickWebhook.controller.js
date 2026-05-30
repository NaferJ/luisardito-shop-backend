const { verifyWebhookSignature } = require("../utils/kickWebhook.util");
const {
  KickWebhookEvent,
  KickPointsConfig,
  KickChatCooldown,
  KickUserTracking,
  Usuario,
  HistorialPunto,
  KickReward,
  UserWatchtime,
  sequelize,
} = require("../models");
const BotrixMigrationService = require("../services/botrixMigration.service");
const VipService = require("../services/vip.service");
const NotificacionService = require("../services/notificacion.service");
const { Op, Transaction } = require("sequelize");
const { getRedisClient } = require("../config/redis.config");
const logger = require("../utils/logger");
const { syncUserProfileIfNeeded } = require("../utils/usernameSync.util");

/**
 * 🔍 DIAGNÓSTICO: monitorear Redis
 */

exports.debugRedisCooldowns = async (req, res) => {
  try {
    const { getRedisClient } = require("../config/redis.config");
    const redis = getRedisClient();

    // Obtener todas las claves de cooldown
    const keys = await redis.keys("chat_cooldown:*");

    const cooldowns = [];
    for (const key of keys) {
      const ttl = await redis.pttl(key);
      const value = await redis.get(key);
      const userId = key.replace("chat_cooldown:", "");

      cooldowns.push({
        kick_user_id: userId,
        created_at: value,
        expires_in_seconds: Math.ceil(ttl / 1000),
        expires_in_minutes: Math.ceil(ttl / 60000),
      });
    }

    res.json({
      success: true,
      total_active_cooldowns: cooldowns.length,
      cooldowns: cooldowns.sort(
        (a, b) => a.expires_in_seconds - b.expires_in_seconds,
      ),
      redis_status: redis.status,
      timestamp: new Date().toISOString(),
    });
    logger.error("[Debug Redis] Error:", error);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * 🔍 DIAGNÓSTICO: Verificar tokens guardados en BD
 */
exports.diagnosticTokensDB = async (req, res) => {
  try {
    const {
      KickBroadcasterToken,
      KickEventSubscription,
    } = require("../models");
    const config = require("../../config");

    logger.info("🔍 [DIAGNÓSTICO DB] Consultando tokens en base de datos...");

    // 1. Obtener TODOS los tokens guardados (activos e inactivos)
    const allTokens = await KickBroadcasterToken.findAll({
      attributes: [
        "id",
        "kick_user_id",
        "kick_username",
        "token_expires_at",
        "is_active",
        "auto_subscribed",
        "last_subscription_attempt",
        "subscription_error",
        "created_at",
        "updated_at",
      ],
      order: [["updated_at", "DESC"]],
    });
    logger.info("🔍 [DIAGNÓSTICO DB] Tokens encontrados:", allTokens.length);
    logger.info("🔍 [DIAGNÓSTICO DB] Tokens encontrados:", allTokens.length);

    // 2. Verificar el broadcaster principal específicamente
    const broadcasterPrincipal = await KickBroadcasterToken.findOne({
      where: {
        kick_user_id: config.kick.broadcasterId,
        is_active: true,
      },
    });

    // 3. Verificar suscripciones del broadcaster principal
    const suscripciones = await KickEventSubscription.findAll({
      where: { broadcaster_user_id: parseInt(config.kick.broadcasterId) },
      attributes: [
        "id",
        "subscription_id",
        "event_type",
        "status",
        "created_at",
      ],
    });

    // 4. Análisis de tokens
    const tokensActivos = allTokens.filter((t) => t.is_active);
    const tokensExpirados = allTokens.filter((t) => {
      if (!t.token_expires_at) return false;
      return new Date(t.token_expires_at) < new Date();
    });

    const diagnostico = {
      resumen: {
        total_tokens: allTokens.length,
        tokens_activos: tokensActivos.length,
        tokens_expirados: tokensExpirados.length,
        broadcaster_principal_id: config.kick.broadcasterId,
        broadcaster_principal_tiene_token: !!broadcasterPrincipal,
        total_suscripciones: suscripciones.length,
      },
      broadcaster_principal: broadcasterPrincipal
        ? {
            id: broadcasterPrincipal.id,
            kick_user_id: broadcasterPrincipal.kick_user_id,
            kick_username: broadcasterPrincipal.kick_username,
            token_expires_at: broadcasterPrincipal.token_expires_at,
            auto_subscribed: broadcasterPrincipal.auto_subscribed,
            last_subscription_attempt:
              broadcasterPrincipal.last_subscription_attempt,
            subscription_error: broadcasterPrincipal.subscription_error,
            created_at: broadcasterPrincipal.created_at,
            updated_at: broadcasterPrincipal.updated_at,
            token_valido: broadcasterPrincipal.token_expires_at
              ? new Date(broadcasterPrincipal.token_expires_at) > new Date()
              : "DESCONOCIDO",
          }
        : null,
      todos_los_tokens: allTokens.map((t) => ({
        id: t.id,
        kick_user_id: t.kick_user_id,
        kick_username: t.kick_username,
        is_active: t.is_active,
        auto_subscribed: t.auto_subscribed,
        token_expires_at: t.token_expires_at,
        token_valido: t.token_expires_at
          ? new Date(t.token_expires_at) > new Date()
          : "DESCONOCIDO",
        created_at: t.created_at,
        updated_at: t.updated_at,
      })),
      suscripciones: suscripciones.map((s) => ({
        id: s.id,
        subscription_id: s.subscription_id,
        event_type: s.event_type,
        status: s.status,
        created_at: s.created_at,
      })),
      estado: {
        problema_identificado: !broadcasterPrincipal
          ? "El broadcaster principal (ID: " +
            config.kick.broadcasterId +
            ") NO tiene token guardado"
          : suscripciones.length === 0
            ? "El broadcaster principal tiene token pero NO hay suscripciones"
            : "Token y suscripciones presentes - debería funcionar",
        accion_requerida: !broadcasterPrincipal
          ? "Luisardito necesita autenticarse en: https://luisardito.com/auth/login"
          : suscripciones.length === 0
            ? "Re-autenticación necesaria para crear suscripciones"
            : "Probar webhook enviando mensaje en chat de Luisardito",
      },
    };

    logger.info(
      "🔍 [DIAGNÓSTICO DB] RESULTADO:",
      JSON.stringify(diagnostico.resumen, null, 2),
    );

    res.json({
      success: true,
      diagnostico,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("🔍 [DIAGNÓSTICO DB] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
exports.diagnosticTokens = async (req, res) => {
  try {
    const {
      KickBroadcasterToken,
      KickEventSubscription,
    } = require("../models");
    const config = require("../../config");

    logger.info("🔍 [DIAGNÓSTICO] Iniciando verificación...");

    // 1. Verificar el broadcaster principal configurado
    const broadcasterPrincipal = config.kick.broadcasterId;
    logger.info(
      "🔍 [DIAGNÓSTICO] Broadcaster principal configurado:",
      broadcasterPrincipal,
    );

    // 2. Obtener todos los tokens disponibles
    const allTokens = await KickBroadcasterToken.findAll({
      where: { is_active: true },
      attributes: [
        "kick_user_id",
        "auto_subscribed",
        "last_subscription_attempt",
        "subscription_error",
      ],
    });

    logger.info(
      "🔍 [DIAGNÓSTICO] Tokens disponibles:",
      allTokens.map((t) => ({
        kick_user_id: t.kick_user_id,
        auto_subscribed: t.auto_subscribed,
        last_attempt: t.last_subscription_attempt,
      })),
    );

    // 3. Verificar si el broadcaster principal tiene token
    const broadcasterToken = allTokens.find(
      (t) => t.kick_user_id.toString() === broadcasterPrincipal.toString(),
    );
    logger.info(
      "🔍 [DIAGNÓSTICO] ¿Broadcaster principal tiene token?",
      !!broadcasterToken,
    );

    // 4. Verificar suscripciones actuales
    const suscripciones = await KickEventSubscription.findAll({
      where: { broadcaster_user_id: parseInt(broadcasterPrincipal) },
      attributes: ["event_type", "subscription_id", "status"],
    });

    logger.info(
      "🔍 [DIAGNÓSTICO] Suscripciones del broadcaster principal:",
      suscripciones.length,
    );

    // 5. Verificar qué usuario es NaferJ (ID 33112734)
    const naferToken = allTokens.find(
      (t) => t.kick_user_id.toString() === "33112734",
    );
    logger.info(
      "🔍 [DIAGNÓSTICO] ¿NaferJ (33112734) tiene token?",
      !!naferToken,
    );
    logger.info(
      "🔍 [DIAGNÓSTICO] ¿NaferJ ES el broadcaster principal?",
      broadcasterPrincipal.toString() === "33112734",
    );

    const diagnostico = {
      broadcaster_principal_config: broadcasterPrincipal,
      broadcaster_principal_tiene_token: !!broadcasterToken,
      nafer_user_id: "33112734",
      nafer_tiene_token: !!naferToken,
      nafer_es_broadcaster_principal:
        broadcasterPrincipal.toString() === "33112734",
      total_tokens_activos: allTokens.length,
      total_suscripciones: suscripciones.length,
      tokens_disponibles: allTokens.map((t) => t.kick_user_id),
      posible_problema:
        broadcasterPrincipal.toString() !== "33112734"
          ? "El broadcaster principal NO es NaferJ, pero NaferJ está intentando suscribirse a eventos de otro broadcaster"
          : "NaferJ ES el broadcaster principal, debería funcionar",
      recomendacion:
        broadcasterPrincipal.toString() !== "33112734"
          ? "Necesitas que el broadcaster principal (ID: " +
            broadcasterPrincipal +
            ") se autentique y use SU token"
          : "El setup debería estar correcto, el problema puede ser de red o configuración",
    };

    logger.info("🔍 [DIAGNÓSTICO] RESUMEN:", diagnostico);

    res.json({
      success: true,
      diagnostico,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("🔍 [DIAGNÓSTICO] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
exports.testCors = async (req, res) => {
  logger.info("🧪 [CORS Test] ==========================================");
  logger.info("🧪 [CORS Test] Method:", req.method);
  logger.info("🧪 [CORS Test] Origin:", req.headers.origin || "SIN ORIGIN");
  logger.info("🧪 [CORS Test] User-Agent:", req.headers["user-agent"]);
  logger.info("🧪 [CORS Test] Headers:", Object.keys(req.headers));
  logger.info("🧪 [CORS Test] ==========================================");

  res.status(200).json({
    message: "✅ CORS funcionando correctamente para webhooks",
    timestamp: new Date().toISOString(),
    method: req.method,
    origin: req.headers.origin || "Sin origin",
    headers: req.headers,
    corsEnabled: true,
  });
};

/**
 * Controlador principal para recibir webhooks de Kick
 */
exports.handleWebhook = async (req, res) => {
  // Log optimizado para producción
  const eventType = req.headers["kick-event-type"];
  const messageId = req.headers["kick-event-message-id"];

  // LOG TODOS LOS EVENTOS - SIN FILTRAR

  try {
    // Si es una petición de test simple, responder inmediatamente
    if (req.body && req.body.test === true) {
      return res.status(200).json({
        status: "success",
        message: "Test webhook received",
        timestamp: new Date().toISOString(),
      });
    }

    // Extraer headers del webhook
    const subscriptionId = req.headers["kick-event-subscription-id"];
    const signature = req.headers["kick-event-signature"];
    const timestamp = req.headers["kick-event-message-timestamp"];
    const eventVersion = req.headers["kick-event-version"];

    // Si faltan headers de webhook de Kick, pero hay contenido, puede ser una verificación
    if (!messageId && !eventType) {
      return res.status(200).json({ message: "Webhook endpoint ready" });
    }

    // Validar que existen los headers necesarios
    if (!messageId || !signature || !timestamp || !eventType) {
      logger.error("[Kick Webhook] ❌ Faltan headers requeridos");
      return res.status(400).json({ error: "Faltan headers requeridos" });
    }

    // Obtener el cuerpo sin procesar como string
    const rawBody = JSON.stringify(req.body);

    // Verificar la firma del webhook
    const isValidSignature = verifyWebhookSignature(
      messageId,
      timestamp,
      rawBody,
      signature,
    );

    if (!isValidSignature) {
      logger.error("[Kick Webhook] ❌ Firma inválida");
      return res.status(401).json({ error: "Firma inválida" });
    }

    // Verificar si el evento ya fue procesado (idempotencia)
    const existingEvent = await KickWebhookEvent.findOne({
      where: { message_id: messageId },
    });

    if (existingEvent) {
      return res
        .status(200)
        .json({ message: "Evento ya procesado previamente" });
    }

    // Guardar el evento en la base de datos
    await KickWebhookEvent.create({
      message_id: messageId,
      subscription_id: subscriptionId,
      event_type: eventType,
      event_version: eventVersion,
      message_timestamp: new Date(timestamp),
      payload: req.body,
      processed: false,
    });

    // Procesar el evento según su tipo
    await processWebhookEvent(eventType, eventVersion, req.body, {
      messageId,
      subscriptionId,
      timestamp,
    });

    // Marcar como procesado
    await KickWebhookEvent.update(
      { processed: true, processed_at: new Date() },
      { where: { message_id: messageId } },
    );

    // Responder con 200 para confirmar recepción
    return res.status(200).json({ message: "Webhook procesado correctamente" });
  } catch (error) {
    logger.error("[Kick Webhook] ❌ Error procesando webhook:", error.message);
    return res.status(500).json({ error: "Error interno al procesar webhook" });
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
  logger.info(`[Kick Webhook] Procesando evento ${eventType}`);

  // LOG PARA DEBUG - VER TODOS LOS EVENTOS

  // Ver exactamente qué valor tiene
  if (eventType === "livestream.status.updated") {
    logger.warn(`✅ MATCH EXACTO: livestream.status.updated`);
  } else if (eventType?.includes?.("livestream")) {
    logger.warn(`⚠️ CONTIENE livestream PERO NO COINCIDE: "${eventType}"`);
  }

  switch (eventType) {
    case "chat.message.sent":
      await handleChatMessage(payload, metadata);
      break;

    case "channel.followed":
      logger.info("👥 CASE MATCH: channel.followed");
      await handleChannelFollowed(payload, metadata);
      break;

    case "channel.subscription.new":
      logger.info("🔔 CASE MATCH: channel.subscription.new");
      await handleNewSubscription(payload, metadata);
      break;

    case "channel.subscription.renewal":
      logger.info("🔄 CASE MATCH: channel.subscription.renewal");
      await handleSubscriptionRenewal(payload, metadata);
      break;

    case "channel.subscription.gifts":
      logger.info("🎁 CASE MATCH: channel.subscription.gifts");
      await handleSubscriptionGifts(payload, metadata);
      break;

    case "livestream.status.updated":
      logger.info("🎥🎥🎥 CASE MATCH: livestream.status.updated 🎥🎥🎥");
      await handleLivestreamStatusUpdated(payload, metadata);
      break;

    case "livestream.metadata.updated":
      logger.info("📝 CASE MATCH: livestream.metadata.updated");
      await handleLivestreamMetadataUpdated(payload, metadata);
      break;

    case "moderation.banned":
      logger.info("🚫 CASE MATCH: moderation.banned");
      await handleModerationBanned(payload, metadata);
      break;

    case "kicks.gifted":
      logger.info("💰 CASE MATCH: kicks.gifted");
      await handleKicksGifted(payload, metadata);
      break;

    case "channel.reward.redemption.updated":
      logger.info("🏆 CASE MATCH: channel.reward.redemption.updated");
      await handleRewardRedemption(payload, metadata);
      break;

    default:
      logger.warn(`❌ EVENTO NO MANEJADO: "${eventType}"`);
      logger.info(`[Kick Webhook] Tipo de evento no manejado: ${eventType}`);
  }
}

// ============================================================================
// Handlers para cada tipo de evento
// ============================================================================

/**
 * 🎁 Maneja canjeos de recompensas de canal
 */
async function handleRewardRedemption(payload, metadata) {
  try {
    const { id: redemptionId, reward, redeemer, status, user_input } = payload;
    const kickRewardId = reward.id;
    const kickUserId = String(redeemer.user_id);
    const kickUsername = redeemer.username;

    logger.info(`🎁 [Reward Redemption] ${kickUsername} canjeó "${reward.title}" (${reward.cost} pts) - Status: ${status}`);

    // Buscar la recompensa en nuestra BD
    const localReward = await KickReward.findOne({
      where: { kick_reward_id: kickRewardId }
    });

    if (!localReward) {
      logger.warn(`⚠️ [Reward Redemption] Recompensa "${reward.title}" (${kickRewardId}) no configurada en BD`);
      return;
    }

    // SIEMPRE buscar el usuario en nuestra BD (para ambos casos: pending y accepted)
    let usuario = await Usuario.findOne({
      where: { user_id_ext: kickUserId }
    });

    // Si es pending y el usuario no existe, enviar mensaje
    if (status === 'pending' && !usuario) {
      logger.warn(`⚠️ [Reward Redemption] Usuario ${kickUsername} no registrado en la tienda`);
      
      // Enviar mensaje en chat notificando al usuario INMEDIATAMENTE
      try {
        const bot = require('../services/kickBot.service');
        const message = `@${kickUsername} tu recompensa "${localReward.title}" no pudo ser gestionada porque no estás registrado en la tienda. Regístrate en https://shop.luisardito.com/ para recibir tus puntos! 🎁`;
        await bot.sendMessage(message);
        logger.info(`📢 [Reward Redemption] Mensaje enviado a ${kickUsername} en chat`);
      } catch (botError) {
        logger.error(`❌ [Reward Redemption] Error enviando mensaje al chat:`, botError.message);
      }
      return;
    }

    // Si es pending y el usuario SÍ existe, solo esperar
    if (status === 'pending') {
      logger.info(`⏳ [Reward Redemption] Usuario registrado. Canje pendiente de aprobación - esperando...`);
      return;
    }

    if (status === 'rejected') {
      logger.info(`❌ [Reward Redemption] Canje rechazado - no se procesan puntos`);
      return;
    }

    if (status !== 'accepted') {
      logger.warn(`⚠️ [Reward Redemption] Status desconocido: ${status}`);
      return;
    }

    // VOLVER A BUSCAR el usuario por si se registró después del pending
    if (!usuario) {
      usuario = await Usuario.findOne({
        where: { user_id_ext: kickUserId }
      });
    }

    // Si después de accepted el usuario TODAVÍA no existe
    if (!usuario) {
      logger.warn(`⚠️ [Reward Redemption] Usuario ${kickUsername} sigue sin registrarse. No se otorgan puntos.`);
      return;
    }

    if (!localReward.is_enabled) {
      logger.info(`🔒 [Reward Redemption] Recompensa "${localReward.title}" deshabilitada`);
      return;
    }

    // Otorgar puntos
    const puntosAOtorgar = localReward.puntos_a_otorgar;
    
    if (puntosAOtorgar <= 0) {
      logger.info(`ℹ️ [Reward Redemption] Recompensa "${localReward.title}" no otorga puntos (configurado en 0)`);
      return;
    }

    const transaction = await sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
    });

    try {
      // Incrementar puntos del usuario
      await usuario.increment('puntos', {
        by: puntosAOtorgar,
        transaction
      });

      // Registrar en historial
      await HistorialPunto.create({
        usuario_id: usuario.id,
        puntos: puntosAOtorgar,
        tipo: 'ganado',
        concepto: `Canje de recompensa: ${localReward.title}`,
        kick_event_data: {
          event_type: 'channel.reward.redemption.updated',
          redemption_id: redemptionId,
          reward_id: kickRewardId,
          reward_title: localReward.title,
          reward_cost: reward.cost,
          user_input: user_input || ''
        }
      }, { transaction });

      // 📬 Crear notificación de puntos ganados
      await NotificacionService.crearNotificacionPuntosGanados(
        usuario.id,
        {
          cantidad: puntosAOtorgar,
          concepto: `Canje de recompensa: ${localReward.title}`,
          tipo_evento: 'channel.reward.redemption.updated'
        },
        transaction
      );

      // Incrementar contador de canjeos
      await localReward.increment('total_redemptions', {
        by: 1,
        transaction
      });

      await transaction.commit();

      await usuario.reload();
      logger.info(`✅ [Reward Redemption] ${kickUsername} recibió ${puntosAOtorgar} puntos. Total: ${usuario.puntos}`);

    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }

  } catch (error) {
    logger.error('[Reward Redemption] ❌ Error:', error.message);
  }
}

/**
 * Maneja mensajes de chat
 */
async function handleChatMessage(payload, metadata) {
  try {
    const sender = payload.sender;
    const kickUserId = String(sender.user_id);
    const kickUsername = sender.username;


    // PRIORIDAD 1: Verificar si es migración de Botrix
    // Solo procesamos si la migración está habilitada
    const { BotrixMigrationConfig } = require("../models");
    const botrixConfig = await BotrixMigrationConfig.getConfig();

    if (botrixConfig.migration_enabled) {
      logger.info("🔍 [BOTRIX DEBUG] Verificando mensaje para migración de puntos...");
      const botrixResult =
        await BotrixMigrationService.processChatMessage(payload);
      logger.info("🔍 [BOTRIX DEBUG] Resultado procesamiento:", botrixResult);

      if (botrixResult.processed) {
        logger.info(
          `📄 [BOTRIX] Migración de puntos procesada: ${JSON.stringify(botrixResult.details)}`,
        );
        return;
      } else {
        logger.info(`🔍 [BOTRIX] Puntos no procesados: ${botrixResult.reason}`);
      }
    }

    // Procesar migración de watchtime
    if (botrixConfig.watchtime_migration_enabled) {
      logger.info("🔍 [BOTRIX WATCHTIME DEBUG] Verificando mensaje para migración de watchtime...");
      const watchtimeResult =
        await BotrixMigrationService.processWatchtimeMessage(payload);
      logger.info("🔍 [BOTRIX WATCHTIME DEBUG] Resultado procesamiento:", watchtimeResult);

      if (watchtimeResult.processed) {
        logger.info(
          `📄 [BOTRIX WATCHTIME] Migración de watchtime procesada: ${JSON.stringify(watchtimeResult.details)}`,
        );
        return;
      } else {
        logger.info(`🔍 [BOTRIX WATCHTIME] Watchtime no procesado: ${watchtimeResult.reason}`);
      }
    }

    // ==========================================
    // COMANDOS DE MODERADORES (Gestión de comandos desde el chat)
    // Se procesan ANTES de los comandos regulares y puntos
    // ==========================================
    try {
      const content = String(payload.content || "").trim();
      const modCommands = ['!addcmd', '!editcmd', '!delcmd', '!cmdinfo'];

      if (modCommands.some(cmd => content.startsWith(cmd))) {
        const ModeratorCommandsService = require("../services/kickModeratorCommands.service");
        const modResult = await ModeratorCommandsService.processModeratorCommand(payload);

        if (modResult.processed) {
          logger.info(`[MOD-CMD] Comando de moderador procesado: ${content.split(/\s+/)[0]}`);

          // Enviar respuesta al chat si hay mensaje
          if (modResult.message) {
            try {
              const bot = require("../services/kickBot.service");
              await bot.sendMessage(modResult.message);
              logger.info(`[MOD-CMD] Respuesta enviada al chat: ${modResult.message}`);
            } catch (botError) {
              logger.error(`[MOD-CMD] Error enviando respuesta al chat:`, botError.message);
            }
          }

          return; // Terminar procesamiento aquí
        }
      }
    } catch (modErr) {
      logger.error(
        "[MOD-CMD] Error manejando comandos de moderador:",
        modErr.message,
      );
    }

    // ==========================================
    // 🤖 Comandos del BOT (Sistema Dinámico desde DB)
    // Se responden SIEMPRE, independientemente del estado del stream
    // ==========================================
    try {
      const content = String(payload.content || "").trim();
      if (content.startsWith("!")) {
        const bot = require("../services/kickBot.service");
        const commandHandler = require("../services/kickBotCommandHandler.service");

        // Procesar comando dinámicamente desde la base de datos
        const commandProcessed = await commandHandler.processMessage(
          content,
          kickUserId, // Usar ID numérico para buscar en user_id_ext
          payload.channel?.username || "luisardito",
          bot,
          null, // No hay contexto de mensaje para webhooks
          'kick', // Especificar plataforma
          null, // No hay discordUserId
          kickUsername // Pasar displayName para @ en respuestas
        );

        if (commandProcessed) {
          logger.info(
            `✅ [BOT-COMMAND] Comando procesado exitosamente para ${kickUsername}`,
          );
        } else {
          logger.debug(
            `ℹ️ [BOT-COMMAND] Comando no registrado: ${content.split(/\s+/)[0]}`,
          );
        }
      }
    } catch (cmdErr) {
      logger.error(
        "[Chat Command] ❌ Error manejando comandos:",
        cmdErr.message,
      );
    }

    // 🎥 PRIORIDAD 2: Verificar si el stream está en vivo (para puntos, no para comandos)
    try {
      const redis = getRedisClient();
      const isLive = await redis.get("stream:is_live");

      if (isLive !== "true") {
        logger.info(
          `🔴 [STREAM] OFFLINE - No se otorgan puntos a ${kickUsername}`,
        );
        return; // ❌ NO CONTINUAR
      }

      logger.info(
        `🟢 [STREAM] EN VIVO - Procesando puntos para ${kickUsername}`,
      );
    } catch (redisError) {
      logger.error(`❌ [STREAM] Error verificando estado:`, redisError.message);
      logger.info(`⚠️  [STREAM] Asumiendo EN VIVO por error de Redis`);
      // Fallback: continuar si Redis falla (para no romper el sistema)
    }

    // Verificar si el usuario existe en nuestra BD
    const usuario = await Usuario.findOne({
      where: { user_id_ext: kickUserId },
    });

    if (!usuario) {
      logger.info(
        `[Chat Message] Usuario ${kickUsername} no registrado, ignorando`,
      );
      return;
    }

    // 🔄 Sincronizar perfil completo (username y avatar) si cambió (con throttling de 24h)
    // El webhook SIEMPRE trae sender.profile_picture según la documentación de Kick
    await syncUserProfileIfNeeded(usuario, kickUsername, kickUserId, false, sender.profile_picture);

    // ============================================================================
    // 🕐 WATCHTIME: Se procesa en CADA mensaje (stream en vivo + usuario registrado)
    // Cooldown propio de 1 minuto para evitar spam de +1min por flood
    // ============================================================================
    try {
      const wtNow = new Date();
      const redis = getRedisClient();
      const WATCHTIME_COOLDOWN_MS = 60 * 1000; // 1 minuto
      const watchtimeKey = `watchtime_cooldown:${kickUserId}`;

      const wasSet = await redis.set(
        watchtimeKey,
        wtNow.toISOString(),
        "PX",
        WATCHTIME_COOLDOWN_MS,
        "NX"
      );

      if (!wasSet) {
        logger.info(
          `⏰ [WATCHTIME] ${kickUsername} en cooldown (1 min)`
        );
      } else {
        const [, created] = await UserWatchtime.findOrCreate({
          where: { usuario_id: usuario.id },
          defaults: {
            usuario_id: usuario.id,
            kick_user_id: kickUserId,
            total_watchtime_minutes: 1,
            message_count: 1,
            first_message_date: wtNow,
            last_message_at: wtNow,
          },
        });

        if (!created) {
          await UserWatchtime.increment(
            { total_watchtime_minutes: 1, message_count: 1 },
            { where: { usuario_id: usuario.id } }
          );
          await UserWatchtime.update(
            { last_message_at: wtNow },
            { where: { usuario_id: usuario.id } }
          );
        }

        logger.info(
          `🕐 [WATCHTIME] ${kickUsername} +1 minuto`
        );
      }
    } catch (watchtimeError) {
      logger.error(`❌ [WATCHTIME] Error:`, watchtimeError.message);
      // No bloquear el resto del procesamiento
    }

    // Obtener configuración de puntos
    const configs = await KickPointsConfig.findAll({
      where: { enabled: true },
    });

    const configMap = {};
    configs.forEach((c) => {
      configMap[c.config_key] = c.config_value;
    });

    // Determinar si es suscriptor (validando expiración)
    const userTracking = await KickUserTracking.findOne({
      where: { kick_user_id: kickUserId },
    });

    const now = new Date();
    let isSubscriber = false;
    if (userTracking?.is_subscribed) {
      const expiresAt = userTracking.subscription_expires_at
        ? new Date(userTracking.subscription_expires_at)
        : null;
      if (expiresAt && expiresAt > now) {
        isSubscriber = true;
      } else {
        // Suscripción expirada: desactivar flag para no dar puntos de sub
        try {
          await KickUserTracking.update(
            { is_subscribed: false },
            { where: { kick_user_id: kickUserId } },
          );
          logger.info(
            `[CHAT] Suscripción expirada para ${kickUsername} - is_subscribed=false`,
          );
        } catch (e) {
          logger.error(
            "[CHAT] Error desactivando suscripción expirada:",
            e.message,
          );
        }
        isSubscriber = false;
      }
    }

    let basePoints = isSubscriber
      ? configMap["chat_points_subscriber"] || 0
      : configMap["chat_points_regular"] || 0;

    const isVipActive =
      usuario.is_vip &&
      (!usuario.vip_expires_at || new Date(usuario.vip_expires_at) > now);

    let pointsToAward = basePoints;
    let userType = "regular";

    if (isSubscriber) {
      userType = "subscriber";
      // Los puntos ya están asignados en basePoints (chat_points_subscriber)
    } else if (isVipActive && configMap["chat_points_vip"]) {
      pointsToAward = configMap["chat_points_vip"];
      userType = "vip";
    }

    logger.info(
      `🎯 [CHAT POINTS] ${kickUsername} - VIP: ${isVipActive}, Subscriber: ${isSubscriber}, Tipo: ${userType}, Puntos: ${pointsToAward}`,
    );

    if (pointsToAward <= 0) {
      return;
    }

    // ============================================================================
    // 🚀 COOLDOWN CON REDIS: Ultra-rápido y atómico (para 1000 msg/min)
    // ============================================================================
    const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos
    const cooldownKey = `chat_cooldown:${kickUserId}`;

    logger.info(
      `🚀 [REDIS COOLDOWN] Verificando para ${kickUsername} (${kickUserId})`,
    );

    try {
      const redis = getRedisClient();

      // 🔒 SET NX PX: SET si NO existe, con expiración automática
      // Retorna "OK" si se creó la clave, null si ya existía
      const wasSet = await redis.set(
        cooldownKey,
        now.toISOString(),
        "PX", // Milisegundos
        COOLDOWN_MS,
        "NX", // Solo si NO existe
      );

      if (!wasSet) {
        // La clave ya existe = cooldown activo
        const ttl = await redis.pttl(cooldownKey); // TTL en milisegundos
        const remainingSecs = Math.ceil(ttl / 1000);

        logger.info(
          `⏰ [REDIS COOLDOWN] ${kickUsername} BLOQUEADO - cooldown activo`,
        );
        logger.info(
          `⏰ [REDIS COOLDOWN] Faltan ${remainingSecs}s (${Math.ceil(ttl / 60000)} minutos)`,
        );

        return; // ❌ NO CONTINUAR - NO DAR PUNTOS
      }

      // ✅ Si llegamos aquí: clave creada exitosamente = puede recibir puntos
      logger.info(`✅ [REDIS COOLDOWN] ${kickUsername} puede recibir puntos`);
      logger.info(
        `📅 [REDIS COOLDOWN] Próximo mensaje permitido en: ${COOLDOWN_MS / 1000}s (${COOLDOWN_MS / 60000} minutos)`,
      );
    } catch (redisError) {
      logger.error(`❌ [REDIS COOLDOWN] Error de Redis:`, redisError.message);
      logger.info(
        `⚠️  [REDIS COOLDOWN] Fallback: continuando sin cooldown por error de Redis`,
      );
      // Para máxima disponibilidad: continuar
      // Para máxima consistencia: return;
    }

    // ============================================================================
    // 💰 OTORGAR PUNTOS (solo si pasó el cooldown de Redis)
    // ============================================================================
    const transaction = await sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    });

    try {
      // Otorgar puntos
      await usuario.increment("puntos", { by: pointsToAward }, { transaction });

      // Actualizar max_puntos si es necesario
      const usuarioActualizado = await usuario.reload({ transaction });
      if (usuarioActualizado.puntos > usuarioActualizado.max_puntos) {
        await usuarioActualizado.update(
          { max_puntos: usuarioActualizado.puntos },
          { transaction }
        );
        logger.info(
          `🏆 [MAX POINTS] Nuevo máximo de puntos: ${usuarioActualizado.puntos} para ${kickUsername}`,
        );
      }

      // Registrar en historial
      await HistorialPunto.create(
        {
          usuario_id: usuario.id,
          puntos: pointsToAward,
          tipo: "ganado",
          concepto: `Mensaje en chat (${userType})`,
          kick_event_data: {
            event_type: "chat.message.sent",
            message_id: payload.message_id,
            kick_user_id: kickUserId,
            kick_username: kickUsername,
            user_type: userType,
            is_vip: isVipActive,
            is_subscriber: isSubscriber,
          },
        },
        { transaction },
      );

      await transaction.commit();

      logger.info(
        `[Chat Message] ✅ ${pointsToAward} puntos → ${kickUsername} (${userType})`,
      );
      logger.info(
        `[Chat Message] 💰 Total puntos usuario: ${usuarioActualizado.puntos}`,
      );
    } catch (transactionError) {
      await transaction.rollback();
      logger.error(
        `[Chat Message] ❌ Error en transacción para ${kickUsername}:`,
        transactionError.message,
      );

      // Si falla la DB, eliminar el cooldown de Redis para permitir retry
      try {
        const redis = getRedisClient();
        await redis.del(cooldownKey);
        logger.info(
          `🔄 [REDIS COOLDOWN] Cooldown eliminado por error de DB - permitir retry`,
        );
      } catch (redisCleanupError) {
        logger.error(
          `❌ [REDIS COOLDOWN] Error limpiando cooldown:`,
          redisCleanupError.message,
        );
      }

      throw transactionError;
    }
  } catch (error) {
    logger.error("[Chat Message] ❌ Error:", error.message);
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

    logger.info("[Kick Webhook][Channel Followed]", {
      broadcaster: payload.broadcaster.username,
      follower: kickUsername,
    });

    // Verificar si el usuario existe en nuestra BD
    const usuario = await Usuario.findOne({
      where: { user_id_ext: kickUserId },
    });

    if (!usuario) {
      logger.info(
        `[Kick Webhook][Channel Followed] Usuario ${kickUsername} no registrado en la BD`,
      );
      return;
    }

    // 🔄 Sincronizar perfil completo (username y avatar) si cambió (SIN throttling, evento poco frecuente)
    await syncUserProfileIfNeeded(usuario, kickUsername, kickUserId, true, follower.profile_picture);

    // Verificar si ya siguió antes (solo primera vez)
    let userTracking = await KickUserTracking.findOne({
      where: { kick_user_id: kickUserId },
    });

    if (userTracking && userTracking.follow_points_awarded) {
      logger.info(
        `[Kick Webhook][Channel Followed] Usuario ${kickUsername} ya recibió puntos por follow anteriormente`,
      );
      return;
    }

    // Obtener configuración de puntos por follow
    const config = await KickPointsConfig.findOne({
      where: {
        config_key: "follow_points",
        enabled: true,
      },
    });

    const basePoints = config?.config_value || 0;

    // 🌟 Calcular puntos considerando VIP (TEMPORAL: Deshabilitado)
    const pointsToAward = basePoints; // await VipService.calculatePointsForUser(usuario, 'follow', basePoints);

    if (pointsToAward <= 0) {
      logger.info(
        "[Kick Webhook][Channel Followed] Puntos por follow deshabilitados",
      );
      return;
    }

    // Otorgar puntos
    await usuario.increment("puntos", { by: pointsToAward });

    // Determinar tipo de usuario
    const userType = "regular"; // usuario.getUserType();

    // Registrar en historial
    await HistorialPunto.create({
      usuario_id: usuario.id,
      puntos: pointsToAward,
      tipo: "ganado",
      concepto: `Primer follow al canal (${userType})`,
      kick_event_data: {
        event_type: "channel.followed",
        kick_user_id: kickUserId,
        kick_username: kickUsername,
        user_type: userType,
        is_vip: false, // usuario.isVipActive()
      },
    });

    // 📬 Crear notificación de puntos ganados por follow
    await NotificacionService.crearNotificacionPuntosGanados(
      usuario.id,
      {
        cantidad: pointsToAward,
        concepto: `Primer follow al canal`,
        tipo_evento: 'channel.followed'
      }
    );

    // Actualizar o crear tracking
    if (!userTracking) {
      userTracking = await KickUserTracking.create({
        kick_user_id: kickUserId,
        kick_username: kickUsername,
        has_followed: true,
        first_follow_at: new Date(),
        follow_points_awarded: true,
      });
    } else {
      await userTracking.update({
        has_followed: true,
        first_follow_at: userTracking.first_follow_at || new Date(),
        follow_points_awarded: true,
      });
    }

    logger.info(
      `[Kick Webhook][Channel Followed] ✅ ${pointsToAward} puntos otorgados a ${kickUsername} (primer follow - ${userType})`,
    );
  } catch (error) {
    logger.error("[Kick Webhook][Channel Followed] Error:", error.message);
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

    logger.info("[Kick Webhook][New Subscription]", {
      broadcaster: payload.broadcaster.username,
      subscriber: kickUsername,
      duration,
      expires_at: expiresAt,
    });

    // Verificar si el usuario existe en nuestra BD
    const usuario = await Usuario.findOne({
      where: { user_id_ext: kickUserId },
    });

    if (!usuario) {
      logger.info(
        `[Kick Webhook][New Subscription] Usuario ${kickUsername} no registrado en la BD`,
      );
      return;
    }

    // 🔄 Sincronizar perfil completo (username y avatar) si cambió (SIN throttling, evento poco frecuente)
    await syncUserProfileIfNeeded(usuario, kickUsername, kickUserId, true, subscriber.profile_picture);

    // Obtener configuración de puntos por nueva suscripción
    const config = await KickPointsConfig.findOne({
      where: {
        config_key: "subscription_new_points",
        enabled: true,
      },
    });

    const basePoints = config?.config_value || 0;

    // 🌟 Calcular puntos considerando VIP (TEMPORAL: Deshabilitado)
    const pointsToAward = basePoints; // await VipService.calculatePointsForUser(usuario, 'sub', basePoints);

    if (pointsToAward > 0) {
      // Otorgar puntos
      await usuario.increment("puntos", { by: pointsToAward });

      // Determinar tipo de usuario
      const userType = "sub"; // usuario.getUserType();

      // Registrar en historial
      await HistorialPunto.create({
        usuario_id: usuario.id,
        puntos: pointsToAward,
        tipo: "ganado",
        concepto: `Nueva suscripción (${duration} ${duration === 1 ? "mes" : "meses"}) - ${userType}`,
        kick_event_data: {
          event_type: "channel.subscription.new",
          kick_user_id: kickUserId,
          kick_username: kickUsername,
          duration,
          expires_at: expiresAt,
          user_type: userType,
          is_vip: false, // usuario.isVipActive()
        },
      });

      // 📬 Crear notificación de puntos ganados por suscripción
      await NotificacionService.crearNotificacionPuntosGanados(
        usuario.id,
        {
          cantidad: pointsToAward,
          concepto: `Nueva suscripción (${duration} ${duration === 1 ? "mes" : "meses"})`,
          tipo_evento: 'channel.subscription.new',
          duracion_meses: duration
        }
      );
    }

    // Actualizar tracking de usuario
    await KickUserTracking.upsert({
      kick_user_id: kickUserId,
      kick_username: kickUsername,
      is_subscribed: true,
      subscription_expires_at: expiresAt,
      subscription_duration_months: duration,
      total_subscriptions: KickUserTracking.sequelize.literal(
        "total_subscriptions + 1",
      ),
    });

    logger.info(
      `[Kick Webhook][New Subscription] ✅ ${pointsToAward} puntos otorgados a ${kickUsername}, sub hasta ${expiresAt}`,
    );
  } catch (error) {
    logger.error("[Kick Webhook][New Subscription] Error:", error.message);
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

    logger.info("[Kick Webhook][Subscription Renewal]", {
      broadcaster: payload.broadcaster.username,
      subscriber: kickUsername,
      duration,
      expires_at: expiresAt,
    });

    // Verificar si el usuario existe en nuestra BD
    const usuario = await Usuario.findOne({
      where: { user_id_ext: kickUserId },
    });

    if (!usuario) {
      logger.info(
        `[Kick Webhook][Subscription Renewal] Usuario ${kickUsername} no registrado en la BD`,
      );
      return;
    }

    // 🔄 Sincronizar perfil completo (username y avatar) si cambió (SIN throttling, evento poco frecuente)
    await syncUserProfileIfNeeded(usuario, kickUsername, kickUserId, true, subscriber.profile_picture);

    // Obtener configuración de puntos por renovación
    const config = await KickPointsConfig.findOne({
      where: {
        config_key: "subscription_renewal_points",
        enabled: true,
      },
    });

    const pointsToAward = config?.config_value || 0;

    if (pointsToAward > 0) {
      // Otorgar puntos
      await usuario.increment("puntos", { by: pointsToAward });

      // Registrar en historial
      await HistorialPunto.create({
        usuario_id: usuario.id,
        puntos: pointsToAward,
        tipo: "ganado",
        concepto: `Renovación de suscripción (${duration} ${duration === 1 ? "mes" : "meses"})`,
        kick_event_data: {
          event_type: "channel.subscription.renewal",
          kick_user_id: kickUserId,
          kick_username: kickUsername,
          duration,
          expires_at: expiresAt,
        },
      });
    }

    // Actualizar tracking de usuario
    await KickUserTracking.upsert({
      kick_user_id: kickUserId,
      kick_username: kickUsername,
      is_subscribed: true,
      subscription_expires_at: expiresAt,
      subscription_duration_months: duration,
      total_subscriptions: KickUserTracking.sequelize.literal(
        "total_subscriptions + 1",
      ),
    });

    logger.info(
      `[Kick Webhook][Subscription Renewal] ✅ ${pointsToAward} puntos otorgados a ${kickUsername}, sub renovada hasta ${expiresAt}`,
    );
  } catch (error) {
    logger.error("[Kick Webhook][Subscription Renewal] Error:", error.message);
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

    logger.info("[Kick Webhook][Subscription Gifts]", {
      broadcaster: payload.broadcaster.username,
      gifter: gifter.is_anonymous ? "Anónimo" : gifter.username,
      giftees: giftees.map((g) => g.username),
      totalGifts: giftees.length,
    });

    // Obtener configuraciones de puntos
    const configs = await KickPointsConfig.findAll({
      where: {
        config_key: ["gift_given_points", "gift_received_points"],
        enabled: true,
      },
    });

    const configMap = {};
    configs.forEach((c) => {
      configMap[c.config_key] = c.config_value;
    });

    const pointsForGifter = configMap["gift_given_points"] || 0;
    const pointsForGiftee = configMap["gift_received_points"] || 0;

    // Otorgar puntos al que regala (si no es anónimo)
    if (!gifter.is_anonymous && pointsForGifter > 0) {
      const gifterKickUserId = String(gifter.user_id);
      const gifterUsuario = await Usuario.findOne({
        where: { user_id_ext: gifterKickUserId },
      });

      if (gifterUsuario) {
        logger.info(
          "🎯 [Subscription Gifts] Regalador encontrado en BD, otorgando puntos",
        );
        
        // 🔄 Sincronizar perfil completo (username y avatar) si cambió (SIN throttling, evento poco frecuente)
        await syncUserProfileIfNeeded(gifterUsuario, gifter.username, gifterKickUserId, true, gifter.profile_picture);

        const totalPoints = pointsForGifter * giftees.length;
        await gifterUsuario.increment("puntos", { by: totalPoints });

        await HistorialPunto.create({
          usuario_id: gifterUsuario.id,
          puntos: totalPoints,
          tipo: "ganado",
          concepto: `Regaló ${giftees.length} suscripción${giftees.length !== 1 ? "es" : ""}`,
          kick_event_data: {
            event_type: "channel.subscription.gifts",
            kick_user_id: gifterKickUserId,
            kick_username: gifter.username,
            gifts_count: giftees.length,
          },
        });

        // 📬 Crear notificación de puntos ganados por regalo de suscripciones
        await NotificacionService.crearNotificacionPuntosGanados(
          gifterUsuario.id,
          {
            cantidad: totalPoints,
            concepto: `Regalaste ${giftees.length} suscripción${giftees.length !== 1 ? "es" : ""}`,
            tipo_evento: 'channel.subscription.gifts',
            gifts_count: giftees.length
          }
        );

        // Actualizar tracking del que regala
        await KickUserTracking.upsert({
          kick_user_id: gifterKickUserId,
          kick_username: gifter.username,
          total_gifts_given: KickUserTracking.sequelize.literal(
            `total_gifts_given + ${giftees.length}`,
          ),
        });

        logger.info(
          `[Kick Webhook][Subscription Gifts] ✅ ${totalPoints} puntos a ${gifter.username} por regalar ${giftees.length} subs`,
        );
      }
    }

    // Otorgar puntos a cada giftee
    if (pointsForGiftee > 0) {
      for (const giftee of giftees) {
        const gifteeKickUserId = String(giftee.user_id);
        const gifteeUsername = giftee.username;

        const gifteeUsuario = await Usuario.findOne({
          where: { user_id_ext: gifteeKickUserId },
        });

        if (gifteeUsuario) {
          // 🔄 Sincronizar perfil completo (username y avatar) si cambió (SIN throttling, evento poco frecuente)
          await syncUserProfileIfNeeded(gifteeUsuario, gifteeUsername, gifteeKickUserId, true, giftee.profile_picture);

          await gifteeUsuario.increment("puntos", { by: pointsForGiftee });

          await HistorialPunto.create({
            usuario_id: gifteeUsuario.id,
            puntos: pointsForGiftee,
            tipo: "ganado",
            concepto: `Suscripción regalada recibida`,
            kick_event_data: {
              event_type: "channel.subscription.gifts",
              kick_user_id: gifteeKickUserId,
              kick_username: gifteeUsername,
              gifter: gifter.is_anonymous ? "Anónimo" : gifter.username,
              expires_at: expiresAt,
            },
          });

          // 📬 Crear notificación de suscripción regalada
          await NotificacionService.crearNotificacionSubRegalada(
            gifteeUsuario.id,
            {
              regalador_username: gifter.is_anonymous ? "Un usuario anónimo" : gifter.username,
              monto_subscription: 1,
              puntos_otorgados: pointsForGiftee,
              expires_at: expiresAt
            }
          );

          // Actualizar tracking del que recibe
          await KickUserTracking.upsert({
            kick_user_id: gifteeKickUserId,
            kick_username: gifteeUsername,
            is_subscribed: true,
            subscription_expires_at: expiresAt,
            total_gifts_received: KickUserTracking.sequelize.literal(
              "total_gifts_received + 1",
            ),
            total_subscriptions: KickUserTracking.sequelize.literal(
              "total_subscriptions + 1",
            ),
          });

          logger.info(
            "🎯 [Subscription Gifts] ✅",
            pointsForGiftee,
            "puntos a",
            gifteeUsername,
            "por recibir sub regalada",
          );
          logger.info(
            "🎯 [Subscription Gifts] 💰 Total puntos del receptor:",
            (await gifteeUsuario.reload()).puntos,
          );
        }
      }
    }
  } catch (error) {
    logger.error("[Kick Webhook][Subscription Gifts] Error:", error.message);
  }
}

/**
 * Maneja cambios de estado de transmisión
 */
async function handleLivestreamStatusUpdated(payload, metadata) {
  try {
    console.log("🎥🎥🎥 WEBHOOK LIVESTREAM.STATUS.UPDATED RECIBIDO 🎥🎥🎥");

    const isLive = payload.is_live;
    const redis = getRedisClient();

    // 📊 Log detallado del payload completo para debugging
    logger.info(
      "🎥 [STREAM STATUS] ==========================================",
    );
    logger.info(
      "🎥 [STREAM STATUS] ✅ WEBHOOK LIVESTREAM.STATUS.UPDATED RECIBIDO",
    );
    logger.info(
      "🎥 [STREAM STATUS] Payload completo:",
      JSON.stringify(payload, null, 2),
    );
    logger.info(
      "🎥 [STREAM STATUS] Metadata:",
      JSON.stringify(metadata, null, 2),
    );

    logger.info("[Kick Webhook][Livestream Status]", {
      broadcaster: payload.broadcaster.username,
      is_live: isLive,
      title: payload.title,
      started_at: payload.started_at,
      ended_at: payload.ended_at,
      timestamp_evento: metadata.timestamp,
      timestamp_actual: new Date().toISOString(),
    });

    // 🔍 Validar timestamp del evento (no procesar eventos muy antiguos)
    if (metadata.timestamp) {
      const eventTimestamp = new Date(metadata.timestamp);
      const now = new Date();
      const ageMinutes = (now - eventTimestamp) / 1000 / 60;

      if (ageMinutes > 5) {
        logger.warn(
          `⚠️  [STREAM STATUS] Evento muy antiguo (${ageMinutes.toFixed(2)} minutos)`,
        );
        logger.warn(
          `⚠️  [STREAM STATUS] Podría estar desactualizado, procesando con precaución`,
        );
      }
    }

    // 🎥 Obtener estado anterior de Redis
    const previousState = await redis.get("stream:is_live");
    const stateChanged = previousState !== (isLive ? "true" : "false");

    if (stateChanged) {
      logger.info(
        `🔄 [STREAM STATUS] CAMBIO DETECTADO: ${previousState || "unknown"} → ${isLive ? "true" : "false"}`,
      );
    } else {
      logger.info(
        `✅ [STREAM STATUS] Estado sin cambios: ${isLive ? "online" : "offline"}`,
      );
    }

    // 🎥 Actualizar estado en Redis con lógica de debounce
    // Webhooks son fuente rápida, pero offline requiere confirmación
    if (isLive) {
      // Stream ONLINE: SIN TTL (persiste indefinidamente)
      await redis.set("stream:is_live", "true");
      await redis.set("stream:last_webhook_status", "online");
      await redis.set("stream:offline_poll_failures", 0); // Resetear contador de fallos
      logger.info(
        "✅ [STREAM STATUS] Estado ONLINE guardado (según payload.is_live=true)",
      );
    } else {
      // Stream OFFLINE: Marcar directamente como offline (sin esperar monitor)
      await redis.set("stream:is_live", "false");
      await redis.set("stream:last_webhook_status", "offline");
      logger.info(
        "🔴 [STREAM STATUS] Estado OFFLINE confirmado directamente por webhook",
      );
    }

    // Guardar timestamp de última actualización (siempre con TTL para limpieza)
    await redis.set(
      "stream:last_status_update",
      new Date().toISOString(),
      "EX",
      86400,
    );

    // Guardar información adicional del stream
    if (isLive) {
      const streamInfo = {
        title: payload.title || "Sin título",
        started_at: payload.started_at,
        broadcaster: payload.broadcaster?.username,
        updated_by: "status.updated",
      };
      // Info del stream SIN TTL mientras esté online
      await redis.set("stream:current_info", JSON.stringify(streamInfo));
    } else {
      // Al terminar el stream, limpiar información
      await redis.del("stream:current_info");
      logger.info("🧹 [STREAM STATUS] Información del stream limpiada");
    }

    logger.info(
      isLive
        ? "🟢 [STREAM] EN VIVO - Puntos por chat ACTIVADOS"
        : "🔴 [STREAM] OFFLINE - Puntos por chat DESACTIVADOS",
    );

    logger.info(
      "🎥 [STREAM STATUS] ==========================================",
    );
  } catch (error) {
    logger.error("[Kick Webhook][Livestream Status] Error:", error);
    logger.error("[Kick Webhook][Livestream Status] Stack:", error.stack);
  }
}

/**
 * Maneja actualizaciones de metadatos de transmisión
 * IMPORTANTE: Este evento NO indica si el stream está online/offline
 * Solo actualiza información (título, categoría, etc.) del stream
 * NO debe cambiar el estado stream:is_live
 */
async function handleLivestreamMetadataUpdated(payload, metadata) {
  try {
    const redis = getRedisClient();

    logger.info("[Kick Webhook][Livestream Metadata]", {
      broadcaster: payload.broadcaster.username,
      title: payload.metadata.title,
      category: payload.metadata.category?.name,
      language: payload.metadata.language,
      has_mature_content: payload.metadata.has_mature_content,
    });

    // Obtener estado actual (NO lo modificamos aquí)
    const currentState = await redis.get("stream:is_live");

    // Actualizar solo la información de metadatos
    const streamInfo = {
      title: payload.metadata.title || "Sin título",
      category: payload.metadata.category?.name || "Sin categoría",
      category_id: payload.metadata.category?.id,
      language: payload.metadata.language || "en",
      has_mature_content: payload.metadata.has_mature_content || false,
      broadcaster: payload.broadcaster?.username,
      updated_by: "metadata.updated",
      last_update: new Date().toISOString(),
    };

    // Info del stream SIN TTL
    await redis.set("stream:current_info", JSON.stringify(streamInfo));

    logger.info(
      `💾 [STREAM METADATA] Metadatos actualizados: "${streamInfo.title}" - ${streamInfo.category}`,
    );
    logger.info(
      `ℹ️  [STREAM METADATA] Estado actual del stream: ${currentState === "true" ? "ONLINE" : "OFFLINE"} (sin cambios)`,
    );
  } catch (error) {
    logger.error("[Kick Webhook][Livestream Metadata] Error:", error.message);
  }
}

/**
 * Maneja baneos de moderación
 */
async function handleModerationBanned(payload, metadata) {
  logger.info("[Kick Webhook][Moderation Banned]", {
    broadcaster: payload.broadcaster.username,
    moderator: payload.moderator.username,
    banned_user: payload.banned_user.username,
    reason: payload.metadata.reason,
    expires_at: payload.metadata.expires_at,
  });

  // TODO: Implementar lógica de negocio (registrar baneo, actualizar permisos, etc.)
}

/**
 * Maneja regalos de kicks (kicks.gifted)
 * Otorga puntos equivalentes a la cantidad de kicks regalados
 */
async function handleKicksGifted(payload, metadata) {
  try {
    const sender = payload.sender;
    const kickUserId = String(sender.user_id);
    const kickUsername = sender.username;
    const kickAmount = payload.gift?.amount || 0;
    const giftName = payload.gift?.name || "Unknown Gift";
    const giftTier = payload.gift?.tier || "BASIC";
    const giftMessage = payload.gift?.message || "";

    logger.info("[Kick Webhook][Kicks Gifted]", {
      broadcaster: payload.broadcaster.username,
      sender: kickUsername,
      kick_amount: kickAmount,
      gift_name: giftName,
      gift_tier: giftTier,
      message: giftMessage,
      created_at: payload.created_at,
    });

    // Verificar si el usuario existe en nuestra BD
    const usuario = await Usuario.findOne({
      where: { user_id_ext: kickUserId },
    });

    if (!usuario) {
      logger.info(
        `[Kick Webhook][Kicks Gifted] Usuario ${kickUsername} no registrado en la BD`,
      );
      return;
    }

    // 🔄 Sincronizar perfil completo (username y avatar) si cambió (SIN throttling, evento poco frecuente)
    await syncUserProfileIfNeeded(usuario, kickUsername, kickUserId, true, sender.profile_picture);

    // Obtener el multiplicador desde la configuración
    const config = await KickPointsConfig.findOne({
      where: {
        config_key: 'kicks_gifted_multiplier',
        enabled: true
      }
    });

    const multiplier = config?.config_value || 2; // Por defecto x2
    const pointsToAward = kickAmount * multiplier;

    if (pointsToAward <= 0) {
      logger.info(
        "[Kick Webhook][Kicks Gifted] Cantidad de kicks es 0 o inválida",
      );
      return;
    }

    // Iniciar transacción para garantizar atomicidad
    const transaction = await sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    });

    try {
      // Otorgar puntos
      await usuario.increment("puntos", { by: pointsToAward }, { transaction });

      // Registrar en historial
      await HistorialPunto.create(
        {
          usuario_id: usuario.id,
          puntos: pointsToAward,
          tipo: "ganado",
          concepto: `Regalo de ${kickAmount} kicks (${giftName})`,
          kick_event_data: {
            event_type: "kicks.gifted",
            kick_user_id: kickUserId,
            kick_username: kickUsername,
            kick_amount: kickAmount,
            gift_name: giftName,
            gift_tier: giftTier,
            gift_message: giftMessage,
            created_at: payload.created_at,
          },
        },
        { transaction },
      );

      // 📬 Crear notificación de puntos ganados por regalo de kicks
      await NotificacionService.crearNotificacionPuntosGanados(
        usuario.id,
        {
          cantidad: pointsToAward,
          concepto: `Regalo de ${kickAmount} kicks (${giftName})`,
          tipo_evento: 'kicks.gifted',
          kick_amount: kickAmount,
          gift_name: giftName,
          gift_tier: giftTier
        },
        transaction
      );

      // Actualizar tracking del usuario (opcional, para estadísticas)
      await KickUserTracking.upsert(
        {
          kick_user_id: kickUserId,
          kick_username: kickUsername,
          total_kicks_gifted: sequelize.literal(
            `COALESCE(total_kicks_gifted, 0) + ${kickAmount}`,
          ),
        },
        { transaction },
      );

      await transaction.commit();

      logger.info(
        `[Kick Webhook][Kicks Gifted] ✅ ${pointsToAward} puntos otorgados a ${kickUsername} por regalar ${kickAmount} kicks`,
      );

      // Recargar usuario para mostrar total actualizado
      const updatedUser = await usuario.reload();
      logger.info(
        `[Kick Webhook][Kicks Gifted] 💰 Total puntos de ${kickUsername}: ${updatedUser.puntos}`,
      );
    } catch (transactionError) {
      await transaction.rollback();
      logger.error(
        `[Kick Webhook][Kicks Gifted] ❌ Error en transacción para ${kickUsername}:`,
        transactionError.message,
      );
      throw transactionError;
    }
  } catch (error) {
    logger.error("[Kick Webhook][Kicks Gifted] Error:", error.message);
  }
}

/**
 * Endpoint simple para verificar que Kick puede alcanzar el servidor
 * GET /webhook/test
 */
exports.testWebhook = async (req, res) => {
  logger.info("[Kick Webhook] Test endpoint alcanzado");
  logger.info("[Kick Webhook] Headers:", req.headers);
  logger.info("[Kick Webhook] IP:", req.ip);
  logger.info("[Kick Webhook] User-Agent:", req.headers["user-agent"]);

  return res.json({
    status: "success",
    message: "Webhook endpoint is reachable",
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });
};

/**
 * Endpoint para verificar la configuración del webhook
 * GET /webhook/debug
 */
exports.debugWebhook = async (req, res) => {
  try {
    const { KickEventSubscription } = require("../models");

    const subscriptions = await KickEventSubscription.findAll({
      where: { status: "active" },
      attributes: [
        "id",
        "subscription_id",
        "broadcaster_user_id",
        "event_type",
        "created_at",
      ],
    });

    return res.json({
      activeSubscriptions: subscriptions.length,
      subscriptions: subscriptions,
      webhookUrl: "https://api.luisardito.com/api/webhook/kick",
      expectedHeaders: [
        "kick-event-message-id",
        "kick-event-subscription-id",
        "kick-event-signature",
        "kick-event-message-timestamp",
        "kick-event-type",
        "kick-event-version",
      ],
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
    logger.info("[Webhook Simulator] Simulando evento de chat...");

    // Simular payload de chat message
    const simulatedPayload = {
      message_id: "sim_" + Date.now(),
      content: "Mensaje de prueba simulado",
      sender: {
        user_id: 33112734, // Tu user_id
        username: "NaferJ",
      },
      broadcaster: {
        user_id: 2771761,
        username: "Luisardito",
      },
      sent_at: new Date().toISOString(),
    };

    const metadata = {
      messageId: simulatedPayload.message_id,
      subscriptionId: "sim_subscription",
      timestamp: Date.now(),
    };

    logger.info("[Webhook Simulator] Procesando evento simulado...");

    // Procesar el evento como si fuera real
    await processWebhookEvent(
      "chat.message.sent",
      1,
      simulatedPayload,
      metadata,
    );

    return res.json({
      status: "success",
      message: "Evento de chat simulado procesado",
      payload: simulatedPayload,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("[Webhook Simulator] Error:", error.message);
    return res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
};

/**
 * Endpoint para simular un webhook REAL de Kick (con headers y todo)
 * POST /api/kick-webhook/test-real-webhook
 */
exports.testRealWebhook = async (req, res) => {
  try {
    logger.info(
      "[Test Real Webhook] Simulando webhook REAL de Kick con headers...",
    );

    // Simular headers exactos que envía Kick
    const mockHeaders = {
      "kick-event-message-id": "test_" + Date.now(),
      "kick-event-subscription-id": "01K7JPFW2HYW4GCBQN85DVB9WG",
      "kick-event-signature": "test_signature_" + Date.now(),
      "kick-event-message-timestamp": Date.now().toString(),
      "kick-event-type": "chat.message.sent",
      "kick-event-version": "1",
      "content-type": "application/json",
      "user-agent": "Kick-Webhooks/1.0",
    };

    // Simular payload real de Kick
    const mockPayload = {
      message_id: "real_test_" + Date.now(),
      content: "7",
      sender: {
        user_id: 33112734,
        username: "NaferJ",
      },
      broadcaster: {
        user_id: 2771761,
        username: "Luisardito",
      },
      sent_at: new Date().toISOString(),
    };

    // Modificar el request para simular que viene de Kick
    req.headers = { ...req.headers, ...mockHeaders };
    req.body = mockPayload;

    logger.info("[Test Real Webhook] Headers simulados:", mockHeaders);
    logger.info("[Test Real Webhook] Payload simulado:", mockPayload);

    // Llamar al handler principal como si fuera un webhook real
    await this.handleWebhook(req, res);
  } catch (error) {
    logger.error("[Test Real Webhook] Error:", error.message);
    return res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
};

/**
 * 🔧 REACTIVAR: Token del broadcaster principal
 */
exports.reactivateBroadcasterToken = async (req, res) => {
  try {
    const { KickBroadcasterToken } = require("../models");
    const {
      autoSubscribeToEvents,
    } = require("../services/kickAutoSubscribe.service");
    const config = require("../../config");

    logger.info("🔧 [REACTIVAR] Buscando token de broadcaster principal...");

    const broadcasterToken = await KickBroadcasterToken.findOne({
      where: { kick_user_id: config.kick.broadcasterId },
    });

    if (!broadcasterToken) {
      return res.status(404).json({
        success: false,
        error: "No se encontró token del broadcaster principal",
        accion: "Luisardito debe autenticarse primero",
      });
    }

    logger.info("🔧 [REACTIVAR] Token encontrado, verificando expiración...");

    // Verificar si el token está expirado
    const now = new Date();
    const expiresAt = new Date(broadcasterToken.token_expires_at);
    const isExpired = expiresAt <= now;

    logger.info("🔧 [REACTIVAR] Estado del token:", {
      expires_at: expiresAt,
      now: now,
      is_expired: isExpired,
      has_refresh_token: !!broadcasterToken.refresh_token,
    });

    if (isExpired) {
      logger.info(
        "🔧 [REACTIVAR] Token expirado, intentando renovar con refresh_token...",
      );

      if (!broadcasterToken.refresh_token) {
        return res.status(400).json({
          success: false,
          error: "Token expirado y no hay refresh_token disponible",
          expires_at: broadcasterToken.token_expires_at,
          accion: "Luisardito debe re-autenticarse completamente",
        });
      }

      // Intentar renovar el token
      try {
        const {
          refreshAccessToken,
        } = require("../services/kickAutoSubscribe.service");
        logger.info("🔧 [REACTIVAR] Intentando renovar token...");

        const renewed = await refreshAccessToken(broadcasterToken);

        if (!renewed) {
          return res.status(400).json({
            success: false,
            error: "No se pudo renovar el token expirado",
            expires_at: broadcasterToken.token_expires_at,
            accion: "Luisardito debe re-autenticarse completamente",
          });
        }

        logger.info("🔧 [REACTIVAR] ✅ Token renovado exitosamente");
        await broadcasterToken.reload(); // Recargar el token actualizado
      } catch (refreshError) {
        logger.error(
          "🔧 [REACTIVAR] Error renovando token:",
          refreshError.message,
        );
        return res.status(400).json({
          success: false,
          error: "Error renovando token: " + refreshError.message,
          expires_at: broadcasterToken.token_expires_at,
          accion: "Luisardito debe re-autenticarse completamente",
        });
      }
    }

    logger.info("🔧 [REACTIVAR] Reactivando token...");

    // Reactivar el token
    await broadcasterToken.update({
      is_active: true,
      auto_subscribed: false, // Lo marcaremos true después de suscribirse
      subscription_error: null,
    });

    logger.info(
      "🔧 [REACTIVAR] Intentando auto-suscripción con token del broadcaster...",
    );

    // Intentar auto-suscripción usando SU propio token
    try {
      const autoSubscribeResult = await autoSubscribeToEvents(
        broadcasterToken.access_token,
        config.kick.broadcasterId,
        config.kick.broadcasterId,
      );

      await broadcasterToken.update({
        auto_subscribed: autoSubscribeResult.success,
        last_subscription_attempt: new Date(),
        subscription_error: autoSubscribeResult.success
          ? null
          : JSON.stringify(autoSubscribeResult.error),
      });

      logger.info(
        "🔧 [REACTIVAR] Resultado de suscripción:",
        autoSubscribeResult.success ? "ÉXITO" : "FALLO",
      );

      res.json({
        success: true,
        token_reactivated: true,
        auto_subscribed: autoSubscribeResult.success,
        broadcaster_id: config.kick.broadcasterId,
        broadcaster_username: broadcasterToken.kick_username,
        subscriptions_created: autoSubscribeResult.totalSubscribed || 0,
        subscriptions_errors: autoSubscribeResult.totalErrors || 0,
        message: autoSubscribeResult.success
          ? "✅ Token reactivado y suscripciones creadas. ¡Los webhooks deberían funcionar!"
          : "⚠️ Token reactivado pero falló la suscripción",
        next_step: autoSubscribeResult.success
          ? "Probar enviando mensaje en chat de Luisardito"
          : "Verificar logs de error de suscripción",
      });
    } catch (subscribeError) {
      logger.error(
        "🔧 [REACTIVAR] Error en suscripción:",
        subscribeError.message,
      );

      await broadcasterToken.update({
        auto_subscribed: false,
        subscription_error: subscribeError.message,
      });

      res.json({
        success: true,
        token_reactivated: true,
        auto_subscribed: false,
        error: subscribeError.message,
        message: "⚠️ Token reactivado pero falló la suscripción",
        next_step: "Verificar logs de error",
      });
    }
  } catch (error) {
    logger.error("🔧 [REACTIVAR] Error general:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Estado simplificado del sistema de webhooks
 */
exports.systemStatus = async (req, res) => {
  try {
    const {
      KickBroadcasterToken,
      KickEventSubscription,
    } = require("../models");
    const config = require("../../config");

    // Verificar broadcaster principal
    const broadcasterToken = await KickBroadcasterToken.findOne({
      where: {
        kick_user_id: config.kick.broadcasterId,
        is_active: true,
      },
    });

    // Contar suscripciones activas
    const subscriptions = await KickEventSubscription.count({
      where: {
        broadcaster_user_id: parseInt(config.kick.broadcasterId),
        status: "active",
      },
    });

    const now = new Date();
    const tokenValid =
      broadcasterToken && new Date(broadcasterToken.token_expires_at) > now;

    const status = {
      system_ready: broadcasterToken && tokenValid && subscriptions > 0,
      broadcaster_authenticated: !!broadcasterToken,
      token_valid: tokenValid,
      subscriptions_active: subscriptions,
      webhook_url: "https://api.luisardito.com/api/kick-webhook/events",
      last_check: now.toISOString(),
    };

    if (broadcasterToken) {
      status.broadcaster_username = broadcasterToken.kick_username;
      status.token_expires_at = broadcasterToken.token_expires_at;
      status.auto_subscribed = broadcasterToken.auto_subscribed;
    }

    const statusCode = status.system_ready ? 200 : 503;

    res.status(statusCode).json({
      success: status.system_ready,
      status,
      message: status.system_ready
        ? "Sistema de webhooks operativo"
        : "Sistema necesita configuración",
    });
  } catch (error) {
    logger.error("[System Status] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * 🔧 DEPURACIÓN: Endpoint temporal para debuggear el proceso de suscripción
 */
exports.debugSubscriptionProcess = async (req, res) => {
  try {
    const {
      KickBroadcasterToken,
      KickEventSubscription,
    } = require("../models");
    const config = require("../../config");
    const axios = require("axios");

    logger.info(
      "🔧 [DEBUG SUB] Iniciando depuración del proceso de suscripción...",
    );

    // 1. Verificar token activo
    const broadcasterToken = await KickBroadcasterToken.findOne({
      where: {
        kick_user_id: config.kick.broadcasterId,
        is_active: true,
      },
    });

    if (!broadcasterToken) {
      return res.json({
        success: false,
        error: "No hay token activo para el broadcaster principal",
        broadcaster_id: config.kick.broadcasterId,
      });
    }

    logger.info(
      "🔧 [DEBUG SUB] Token encontrado para:",
      broadcasterToken.kick_username,
    );

    // 2. Simular llamada a la API de Kick (solo un evento para prueba)
    const apiUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;
    const testPayload = {
      broadcaster_user_id: parseInt(config.kick.broadcasterId),
      events: [{ name: "chat.message.sent", version: 1 }], // Solo un evento para prueba
      method: "webhook",
      webhook_url: "https://api.luisardito.com/api/kick-webhook/events",
    };

    logger.info(
      "🔧 [DEBUG SUB] Payload enviado a Kick:",
      JSON.stringify(testPayload, null, 2),
    );

    let kickResponse;
    try {
      const response = await axios.post(apiUrl, testPayload, {
        headers: {
          Authorization: `Bearer ${broadcasterToken.access_token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      });
      kickResponse = response.data;
      logger.info(
        "🔧 [DEBUG SUB] Respuesta de Kick:",
        JSON.stringify(kickResponse, null, 2),
      );
    } catch (apiError) {
      logger.error("🔧 [DEBUG SUB] Error en API de Kick:", apiError.message);
      return res.json({
        success: false,
        error: "Error comunicándose con API de Kick",
        details: apiError.response?.data || apiError.message,
      });
    }

    // 3. Intentar guardar cada suscripción y capturar errores detallados
    const subscriptionsData = kickResponse.data || [];
    const debugResults = [];

    for (const sub of subscriptionsData) {
      logger.info(
        "🔧 [DEBUG SUB] Procesando suscripción:",
        JSON.stringify(sub, null, 2),
      );

      if (sub.subscription_id && !sub.error) {
        const dataToSave = {
          subscription_id: sub.subscription_id,
          broadcaster_user_id: parseInt(config.kick.broadcasterId),
          event_type: sub.name,
          event_version: sub.version,
          method: "webhook",
          status: "active",
        };

        logger.info(
          "🔧 [DEBUG SUB] Datos a guardar:",
          JSON.stringify(dataToSave, null, 2),
        );

        try {
          // Usar la misma lógica que en el servicio principal: find-update
          let localSub = await KickEventSubscription.findOne({
            where: { subscription_id: sub.subscription_id },
          });

          if (localSub) {
            // Si existe, actualizar los datos
            await localSub.update(dataToSave);
            debugResults.push({
              event: sub.name,
              success: true,
              action: "updated",
              subscription_id: sub.subscription_id,
              db_id: localSub.id,
            });
            logger.info(
              "🔧 [DEBUG SUB] ✅ Actualizado exitoso para:",
              sub.name,
            );
          } else {
            // Si no existe, crear nuevo
            const newSubscription =
              await KickEventSubscription.create(dataToSave);
            debugResults.push({
              event: sub.name,
              success: true,
              action: "created",
              subscription_id: sub.subscription_id,
              db_id: newSubscription.id,
            });
            logger.info("🔧 [DEBUG SUB] ✅ Creado exitoso para:", sub.name);
          }
        } catch (dbError) {
          logger.error("🔧 [DEBUG SUB] ❌ Error DB detallado:", {
            message: dbError.message,
            name: dbError.name,
            errors: dbError.errors,
            sql: dbError.sql,
            stack: dbError.stack,
          });

          debugResults.push({
            event: sub.name || "DESCONOCIDO",
            success: false,
            error: {
              message: dbError.message,
              name: dbError.name,
              errors: dbError.errors
                ? dbError.errors.map((e) => ({
                    message: e.message,
                    type: e.type,
                    path: e.path,
                    value: e.value,
                  }))
                : null,
              sql: dbError.sql,
            },
            attempted_data: dataToSave,
          });
        }
      } else {
        debugResults.push({
          event: sub.name || "DESCONOCIDO",
          success: false,
          kick_error: sub.error || "No subscription_id en respuesta",
        });
      }
    }

    // 4. Limpiar cualquier suscripción que se haya creado durante la prueba
    await KickEventSubscription.destroy({
      where: {
        broadcaster_user_id: parseInt(config.kick.broadcasterId),
        event_type: "chat.message.sent",
      },
    });
    logger.info("🔧 [DEBUG SUB] Limpieza completada");

    res.json({
      success: true,
      debug_info: {
        broadcaster_id: config.kick.broadcasterId,
        broadcaster_username: broadcasterToken.kick_username,
        token_expires_at: broadcasterToken.token_expires_at,
        kick_api_payload: testPayload,
        kick_api_response: kickResponse,
        db_save_results: debugResults,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("🔧 [DEBUG SUB] Error general:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
};

/**
 * 🔧 DEPURACIÓN: Verificar estructura de tabla KickEventSubscription
 */
exports.debugTableStructure = async (req, res) => {
  try {
    const { KickEventSubscription } = require("../models");
    const { sequelize } = require("../models/database");

    logger.info("🔧 [DEBUG TABLE] Verificando estructura de tabla...");

    // 1. Describir la tabla directamente en la BD
    const [tableDescription] = await sequelize.query(
      `DESCRIBE kick_event_subscriptions`,
    );

    // 2. Obtener constraints y índices
    const [constraints] = await sequelize.query(`
            SELECT
                COLUMN_NAME,
                IS_NULLABLE,
                DATA_TYPE,
                COLUMN_DEFAULT,
                COLUMN_KEY,
                EXTRA
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'kick_event_subscriptions'
            AND TABLE_SCHEMA = DATABASE()
        `);

    // 3. Verificar índices únicos
    const [uniqueIndexes] = await sequelize.query(`
            SELECT
                INDEX_NAME,
                COLUMN_NAME,
                NON_UNIQUE
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_NAME = 'kick_event_subscriptions'
            AND TABLE_SCHEMA = DATABASE()
            AND NON_UNIQUE = 0
        `);

    // 4. Verificar foreign keys
    const [foreignKeys] = await sequelize.query(`
            SELECT
                COLUMN_NAME,
                CONSTRAINT_NAME,
                REFERENCED_TABLE_NAME,
                REFERENCED_COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_NAME = 'kick_event_subscriptions'
            AND TABLE_SCHEMA = DATABASE()
            AND REFERENCED_TABLE_NAME IS NOT NULL
        `);

    // 5. Probar inserción simple para capturar error
    let insertTestResult = null;
    try {
      // Datos de prueba mínimos
      const testData = {
        subscription_id: "test_debug_" + Date.now(),
        broadcaster_user_id: 33112734,
        event_type: "chat.message.sent",
        event_version: 1,
        method: "webhook",
        status: "active",
      };

      logger.info("🔧 [DEBUG TABLE] Probando inserción con datos:", testData);

      const testRecord = await KickEventSubscription.create(testData);

      // Si funciona, eliminar inmediatamente
      await testRecord.destroy();

      insertTestResult = {
        success: true,
        message: "Inserción de prueba exitosa",
        test_data: testData,
      };
    } catch (insertError) {
      logger.error(
        "🔧 [DEBUG TABLE] Error en inserción de prueba:",
        insertError,
      );

      insertTestResult = {
        success: false,
        error: {
          message: insertError.message,
          name: insertError.name,
          errors: insertError.errors
            ? insertError.errors.map((e) => ({
                message: e.message,
                type: e.type,
                path: e.path,
                value: e.value,
                validatorKey: e.validatorKey,
                validatorName: e.validatorName,
              }))
            : null,
          sql: insertError.sql,
        },
      };
    }

    res.json({
      success: true,
      table_info: {
        table_description: tableDescription,
        column_constraints: constraints,
        unique_indexes: uniqueIndexes,
        foreign_keys: foreignKeys,
        insert_test: insertTestResult,
      },
      sequelize_model_attributes: Object.keys(
        KickEventSubscription.rawAttributes,
      ).map((key) => ({
        name: key,
        type: KickEventSubscription.rawAttributes[key].type.constructor.name,
        allowNull: KickEventSubscription.rawAttributes[key].allowNull,
        defaultValue: KickEventSubscription.rawAttributes[key].defaultValue,
        unique: KickEventSubscription.rawAttributes[key].unique,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("🔧 [DEBUG TABLE] Error general:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
};

/**
 * 🚀 APP TOKEN: Configurar webhooks permanentes con App Access Token
 */
exports.setupPermanentWebhooks = async (req, res) => {
  try {
    const {
      subscribeToEventsWithAppToken,
    } = require("../services/kickAppToken.service");
    const config = require("../../config");

    logger.info(
      "🚀 [Setup Permanent] Iniciando configuración de webhooks permanentes...",
    );

    const result = await subscribeToEventsWithAppToken(
      config.kick.broadcasterId,
    );

    if (result.success) {
      res.json({
        success: true,
        message: "🚀 ¡Webhooks permanentes configurados exitosamente!",
        permanent: true,
        token_type: "APP_TOKEN",
        no_user_auth_required: true,
        broadcaster_id: config.kick.broadcasterId,
        subscriptions_created: result.totalSubscribed,
        subscriptions_errors: result.totalErrors,
        webhook_url: "https://api.luisardito.com/api/kick-webhook/events",
        benefits: [
          "No requiere re-autenticación del usuario",
          "Funciona 24/7 sin intervención manual",
          "No expira cada 2 horas",
          "No hay refresh tokens que expiren",
          "Completamente autónomo",
        ],
        next_steps: [
          "Los webhooks están listos",
          "Probar enviando mensaje en chat",
          "Verificar logs del servidor",
        ],
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Error configurando webhooks permanentes",
        error: result.error,
        token_type: "APP_TOKEN",
        permanent: false,
      });
    }
  } catch (error) {
    logger.error("🚀 [Setup Permanent] Error general:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Error interno configurando webhooks permanentes",
    });
  }
};

/**
 * 🔍 APP TOKEN: Debug y estado de webhooks permanentes
 */
exports.debugAppTokenWebhooks = async (req, res) => {
  try {
    const {
      getAppAccessToken,
      checkAppTokenWebhooksStatus,
    } = require("../services/kickAppToken.service");
    const config = require("../../config");

    logger.info(
      "🔍 [Debug App Token] Iniciando diagnóstico de webhooks permanentes...",
    );

    // 1. Probar obtención de App Token
    logger.info(
      "🔍 [Debug App Token] Probando obtención de App Access Token...",
    );
    const appToken = await getAppAccessToken();

    // 2. Verificar estado de suscripciones
    logger.info("🔍 [Debug App Token] Verificando estado de suscripciones...");
    const webhooksStatus = await checkAppTokenWebhooksStatus(
      config.kick.broadcasterId,
    );

    // 3. Verificar todas las suscripciones en DB
    const { KickEventSubscription } = require("../models");
    const allSubscriptions = await KickEventSubscription.findAll({
      where: { broadcaster_user_id: parseInt(config.kick.broadcasterId) },
      attributes: [
        "id",
        "subscription_id",
        "event_type",
        "app_id",
        "status",
        "created_at",
      ],
      order: [["created_at", "DESC"]],
    });

    const debug_info = {
      app_token_test: {
        success: !!appToken,
        token_obtained: !!appToken,
        token_length: appToken ? appToken.length : 0,
        message: appToken
          ? "App Token obtenido exitosamente"
          : "Error obteniendo App Token",
      },
      webhooks_status: webhooksStatus,
      broadcaster_config: {
        broadcaster_id: config.kick.broadcasterId,
        webhook_url: "https://api.luisardito.com/api/kick-webhook/events",
        client_id: config.kick.clientId,
        client_secret_configured: !!config.kick.clientSecret,
      },
      subscriptions_breakdown: {
        app_token_subs: allSubscriptions.filter(
          (s) => s.app_id === "APP_TOKEN",
        ),
        user_token_subs: allSubscriptions.filter(
          (s) => s.app_id !== "APP_TOKEN",
        ),
        all_subscriptions: allSubscriptions,
      },
      system_assessment: {
        is_permanent: webhooksStatus.is_permanent,
        requires_maintenance: !webhooksStatus.is_permanent,
        user_dependency: webhooksStatus.requires_user_auth,
        recommendation: webhooksStatus.is_permanent
          ? "Sistema funcionando con webhooks permanentes"
          : "Se recomienda configurar webhooks permanentes con App Token",
      },
    };

    res.json({
      success: true,
      debug_info,
      summary: {
        app_token_working: !!appToken,
        permanent_webhooks_active: webhooksStatus.is_permanent,
        total_active_subscriptions: webhooksStatus.total_subscriptions,
        system_status: webhooksStatus.is_permanent ? "PERMANENT" : "TEMPORARY",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("🔍 [Debug App Token] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
};

/**
 * 🔄 APP TOKEN: Estado comparativo entre User Token vs App Token
 */
exports.compareTokenTypes = async (req, res) => {
  try {
    const {
      checkAppTokenWebhooksStatus,
    } = require("../services/kickAppToken.service");
    const { KickBroadcasterToken } = require("../models");
    const config = require("../../config");

    logger.info("🔄 [Compare Tokens] Comparando User Token vs App Token...");

    // Estado de webhooks
    const webhooksStatus = await checkAppTokenWebhooksStatus(
      config.kick.broadcasterId,
    );

    // Estado de User Tokens
    const userTokens = await KickBroadcasterToken.findAll({
      where: { kick_user_id: config.kick.broadcasterId },
      attributes: [
        "id",
        "kick_username",
        "is_active",
        "token_expires_at",
        "auto_subscribed",
      ],
      order: [["updated_at", "DESC"]],
    });

    const now = new Date();
    const activeUserTokens = userTokens.filter(
      (t) =>
        t.is_active && t.token_expires_at && new Date(t.token_expires_at) > now,
    );

    const comparison = {
      user_tokens: {
        total: userTokens.length,
        active: activeUserTokens.length,
        expires:
          activeUserTokens.length > 0
            ? activeUserTokens[0].token_expires_at
            : null,
        requires_user_interaction: true,
        maintenance_required: true,
        duration: "2 horas (con refresh hasta ~30-90 días)",
        webhooks_count: webhooksStatus.user_token_subscriptions,
      },
      app_tokens: {
        total: "N/A (sin estado en DB)",
        active: webhooksStatus.app_token_subscriptions > 0 ? 1 : 0,
        expires: "NUNCA (permanente)",
        requires_user_interaction: false,
        maintenance_required: false,
        duration: "PERMANENTE (hasta cambio manual de credenciales)",
        webhooks_count: webhooksStatus.app_token_subscriptions,
      },
      recommendation: {
        current_status: webhooksStatus.is_permanent
          ? "USANDO_APP_TOKEN"
          : "USANDO_USER_TOKEN",
        should_migrate: !webhooksStatus.is_permanent,
        benefits_migration: [
          "Elimina dependencia del usuario",
          "No requiere re-autenticación",
          "Funciona 24/7 sin mantenimiento",
          "Elimina expiración de tokens",
          "Sistema completamente autónomo",
        ],
      },
    };

    res.json({
      success: true,
      comparison,
      summary: {
        current_system: webhooksStatus.is_permanent
          ? "PERMANENT (App Token)"
          : "TEMPORARY (User Token)",
        recommendation: webhooksStatus.is_permanent
          ? "Ya optimizado"
          : "Migrar a App Token",
        action_needed: !webhooksStatus.is_permanent,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("🔄 [Compare Tokens] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ============================================================================
// ENDPOINTS DE DEBUG PARA NUEVAS FUNCIONALIDADES
// ============================================================================

/**
 * 🧪 DEBUG: Simular migración de Botrix
 */
exports.debugBotrixMigration = async (req, res) => {
  try {
    const { kick_username, points_amount } = req.body;

    if (!kick_username || !points_amount) {
      return res.status(400).json({
        success: false,
        error: "Faltan parámetros: kick_username, points_amount",
      });
    }

    logger.info(
      `🧪 [DEBUG BOTRIX] Simulando migración: ${kick_username} con ${points_amount} puntos`,
    );

    // Crear mensaje simulado de BotRix
    const mockMessage = {
      sender: {
        username: "BotRix",
        user_id: "debug_botrix",
      },
      content: `@${kick_username} tiene ${points_amount} puntos.`,
      broadcaster: {
        user_id: parseInt(process.env.KICK_BROADCASTER_ID || "2771761"),
      },
    };

    // Procesar con el servicio real
    const result = await BotrixMigrationService.processChatMessage(mockMessage);

    res.json({
      success: true,
      message: "Simulación de migración completada",
      input: { kick_username, points_amount },
      result: result,
      mock_message: mockMessage.content,
    });
  } catch (error) {
    logger.error("❌ [DEBUG BOTRIX] Error en simulación:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * 🧪 DEBUG: Información de configuración VIP y migración
 */
exports.debugSystemInfo = async (req, res) => {
  try {
    const { BotrixMigrationConfig } = require("../models");
    const config = await BotrixMigrationConfig.getConfig();

    // Obtener estadísticas reales de migración
    const migrationStats = await BotrixMigrationService.getMigrationStats();

    // Obtener estadísticas reales de VIP usando el servicio importado
    const vipStats = await VipService.getVipStats();

    res.json({
      success: true,
      system_info: {
        migration: {
          enabled: config.migration_enabled,
          stats: {
            migrated_users: migrationStats.migrated_users,
            total_points_migrated: migrationStats.total_migrated_points,
            pending_users: migrationStats.pending_users,
            migration_percentage: migrationStats.migration_percentage,
          },
        },
        vip: {
          points_enabled: config.vip_points_enabled,
          config: {
            chat_points: config.vip_chat_points,
            follow_points: config.vip_follow_points,
            sub_points: config.vip_sub_points,
          },
          stats: {
            total_vips: vipStats.total_vips,
            active_vips: vipStats.active_vips,
            expired_vips: vipStats.expired_vips,
            permanent_vips: vipStats.permanent_vips,
            temporary_vips: vipStats.temporary_vips,
          },
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error obteniendo información del sistema:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * 🎥 DEBUG: Verificar estado del stream
 */
exports.debugStreamStatus = async (req, res) => {
  try {
    const redis = getRedisClient();

    // Obtener todas las claves relacionadas con el stream
    const isLive = await redis.get("stream:is_live");
    const currentInfo = await redis.get("stream:current_info");
    const lastStatusUpdate = await redis.get("stream:last_status_update");
    const lastMetadataUpdate = await redis.get("stream:last_metadata_update");

    // Obtener TTL de las claves
    const ttlIsLive = await redis.ttl("stream:is_live");
    const ttlCurrentInfo = await redis.ttl("stream:current_info");

    // Parsear información del stream si existe
    let streamInfo = null;
    if (currentInfo) {
      try {
        streamInfo = JSON.parse(currentInfo);
      } catch (e) {
        logger.warn("[Stream Status] Error parseando stream:current_info");
      }
    }

    // Calcular tiempo desde última actualización
    let minutesSinceStatusUpdate = null;
    if (lastStatusUpdate) {
      const lastUpdate = new Date(lastStatusUpdate);
      const now = new Date();
      minutesSinceStatusUpdate = (now - lastUpdate) / 1000 / 60;
    }

    let minutesSinceMetadataUpdate = null;
    if (lastMetadataUpdate) {
      const lastUpdate = new Date(lastMetadataUpdate);
      const now = new Date();
      minutesSinceMetadataUpdate = (now - lastUpdate) / 1000 / 60;
    }

    // Detectar inconsistencias
    const warnings = [];

    if (isLive === "true" && ttlIsLive < 3600) {
      warnings.push(
        `⚠️ TTL bajo: expira en ${Math.floor(ttlIsLive / 60)} minutos`,
      );
    }

    if (
      isLive === "true" &&
      minutesSinceStatusUpdate &&
      minutesSinceStatusUpdate > 120
    ) {
      warnings.push(
        `⚠️ Sin actualizaciones de status desde hace ${minutesSinceStatusUpdate.toFixed(1)} minutos`,
      );
    }

    if (isLive === "true" && !streamInfo) {
      warnings.push("⚠️ Stream online pero sin información en Redis");
    }

    if (ttlIsLive === -1) {
      warnings.push("⚠️ Clave sin TTL (permanente)");
    }

    res.json({
      success: true,
      stream: {
        is_live: isLive === "true",
        redis_value: isLive || "not_set",
        points_enabled: isLive === "true",
        message:
          isLive === "true"
            ? "🟢 Stream EN VIVO - Puntos activados"
            : "🔴 Stream OFFLINE - Puntos desactivados",
      },
      stream_info: streamInfo,
      redis_metadata: {
        ttl_is_live:
          ttlIsLive === -1
            ? "sin_expiración"
            : ttlIsLive === -2
              ? "no_existe"
              : `${ttlIsLive}s (${Math.floor(ttlIsLive / 60)} min)`,
        ttl_current_info:
          ttlCurrentInfo === -1
            ? "sin_expiración"
            : ttlCurrentInfo === -2
              ? "no_existe"
              : `${ttlCurrentInfo}s (${Math.floor(ttlCurrentInfo / 60)} min)`,
        last_status_update: lastStatusUpdate || "nunca",
        last_metadata_update: lastMetadataUpdate || "nunca",
        minutes_since_status_update: minutesSinceStatusUpdate
          ? minutesSinceStatusUpdate.toFixed(1)
          : "n/a",
        minutes_since_metadata_update: minutesSinceMetadataUpdate
          ? minutesSinceMetadataUpdate.toFixed(1)
          : "n/a",
      },
      health_check: {
        status: warnings.length === 0 ? "✅ Saludable" : "⚠️ Advertencias",
        warnings: warnings,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("[Stream Status] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * 🚨 EMERGENCY: Establecer manualmente el estado del stream
 * POST /api/kick-webhook/debug/force-stream-state
 * Body: { "is_live": true/false, "reason": "explicación" }
 */
exports.forceStreamState = async (req, res) => {
  try {
    const { is_live, reason } = req.body;

    if (typeof is_live !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "Parámetro is_live debe ser boolean (true/false)",
      });
    }

    const redis = getRedisClient();
    const previousState = await redis.get("stream:is_live");

    logger.warn(
      "🚨 [FORCE STREAM STATE] ==========================================",
    );
    logger.warn("🚨 [FORCE STREAM STATE] CAMBIO MANUAL DE ESTADO DETECTADO");
    logger.warn(
      `🚨 [FORCE STREAM STATE] Estado anterior: ${previousState || "unknown"}`,
    );
    logger.warn(
      `🚨 [FORCE STREAM STATE] Nuevo estado: ${is_live ? "true" : "false"}`,
    );
    logger.warn(
      `🚨 [FORCE STREAM STATE] Razón: ${reason || "No especificada"}`,
    );
    logger.warn(
      `🚨 [FORCE STREAM STATE] Timestamp: ${new Date().toISOString()}`,
    );
    logger.warn(
      "🚨 [FORCE STREAM STATE] ==========================================",
    );

    // Actualizar estado con lógica consistente: SIN TTL si está online, CON TTL si está offline
    if (is_live) {
      await redis.set("stream:is_live", "true");
      logger.warn(
        "✅ [FORCE STREAM STATE] Estado forzado a ONLINE (persistente, sin TTL)",
      );
    } else {
      await redis.set("stream:is_live", "false");
      await redis.set("stream:last_webhook_status", "offline");
      logger.info(
        "🔴 [FORCE STREAM STATE] Estado OFFLINE confirmado directamente por webhook",
      );
    }

    await redis.set(
      "stream:last_status_update",
      new Date().toISOString(),
      "EX",
      86400,
    );

    // Marcar que fue un cambio manual
    await redis.set(
      "stream:last_manual_override",
      JSON.stringify({
        previous_state: previousState || "unknown",
        new_state: is_live ? "true" : "false",
        reason: reason || "No especificada",
        timestamp: new Date().toISOString(),
      }),
      "EX",
      86400,
    ); // 24 horas

    if (is_live) {
      // Si se fuerza a online, crear información básica (SIN TTL)
      const streamInfo = {
        title: "Stream manual override",
        broadcaster: "Manual",
        updated_by: "manual_override",
        last_update: new Date().toISOString(),
      };
      await redis.set("stream:current_info", JSON.stringify(streamInfo));
    } else {
      // Si se fuerza a offline, limpiar información
      await redis.del("stream:current_info");
    }

    res.json({
      success: true,
      message: "✅ Estado del stream actualizado manualmente",
      previous_state: previousState || "unknown",
      new_state: is_live ? "true" : "false",
      reason: reason || "No especificada",
      warning: "⚠️ Este cambio se revertirá si llega un webhook de Kick",
      ttl_hours: 2,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("🚨 [FORCE STREAM STATE] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * 📊 ENDPOINT PÚBLICO: Obtener configuración pública de puntos de Kick
 * GET /api/kick/public/points-config
 */
exports.getPublicPointsConfig = async (req, res) => {
  try {
    const configs = await KickPointsConfig.findAll({
      order: [["id", "ASC"]],
    });

    const total = configs.length;
    const initialized = total > 0;

    res.json({
      config: configs.map((c) => ({
        id: c.id,
        config_key: c.config_key,
        config_value: c.config_value,
        enabled: c.enabled,
        description: c.description || null,
      })),
      total,
      initialized,
    });
  } catch (error) {
    logger.error("[Public Points Config] Error:", error.message);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
};
