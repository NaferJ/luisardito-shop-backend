const { verifyWebhookSignature } = require("../utils/kickWebhook.util");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const {
  KickWebhookEvent,
  KickPointsConfig,
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
const { Transaction } = require("sequelize");
const { getRedisClient } = require("../config/redis.config");
const logger = require("../utils/logger");
const { syncUserProfileIfNeeded } = require("../utils/usernameSync.util");

/**
 * DIAGNOSTIC: monitor Redis
 */

exports.debugRedisCooldowns = asyncHandler(async (req, res) => {
  try {
    const { getRedisClient } = require("../config/redis.config");
    const redis = getRedisClient();

    // Get all cooldown keys
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
        (a, b) => a.expires_in_seconds - b.expires_in_seconds
      ),
      redis_status: redis.status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Debug Redis] Error:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * DIAGNOSTIC: Check tokens stored in DB
 */
exports.diagnosticTokensDB = asyncHandler(async (req, res) => {
  try {
    const {
      KickBroadcasterToken,
      KickEventSubscription,
    } = require("../models");
    const config = require("../../config");

    logger.info("[DIAGNOSTIC DB] Querying tokens in database...");

    // 1. Get ALL stored tokens (active and inactive)
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
    logger.info("[DIAGNOSTIC DB] Tokens found:", allTokens.length);
    logger.info("[DIAGNOSTIC DB] Tokens found:", allTokens.length);

    // 2. Check main broadcaster specifically
    const broadcasterPrincipal = await KickBroadcasterToken.findOne({
      where: {
        kick_user_id: config.kick.broadcasterId,
        is_active: true,
      },
    });

    // 3. Check main broadcaster subscriptions
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

    // 4. Token analysis
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
              : "UNKNOWN",
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
          : "UNKNOWN",
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
          ? "Main broadcaster (ID: " +
            config.kick.broadcasterId +
            ") has NO stored token"
          : suscripciones.length === 0
            ? "Main broadcaster has token but NO subscriptions"
            : "Token and subscriptions present - should work",
        accion_requerida: !broadcasterPrincipal
          ? "Luisardito needs to authenticate at: https://luisardito.com/auth/login"
          : suscripciones.length === 0
            ? "Re-authentication needed to create subscriptions"
            : "Test webhook by sending a message in Luisardito's chat",
      },
    };

    logger.info(
      "[DIAGNOSTIC DB] RESULT:",
      JSON.stringify(diagnostico.resumen, null, 2)
    );

    res.json({
      success: true,
      diagnostico,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[DIAGNOSTIC DB] Error:", error);
    throw new AppError(error.message, 500);
  }
});
exports.diagnosticTokens = asyncHandler(async (req, res) => {
  try {
    const {
      KickBroadcasterToken,
      KickEventSubscription,
    } = require("../models");
    const config = require("../../config");

    logger.info("[DIAGNOSTIC] Starting verification...");

    // 1. Check configured main broadcaster
    const broadcasterPrincipal = config.kick.broadcasterId;
    logger.info(
      "[DIAGNOSTIC] Main broadcaster configured:",
      broadcasterPrincipal
    );

    // 2. Get all available tokens
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
      "[DIAGNOSTIC] Available tokens:",
      allTokens.map((t) => ({
        kick_user_id: t.kick_user_id,
        auto_subscribed: t.auto_subscribed,
        last_attempt: t.last_subscription_attempt,
      }))
    );

    // 3. Check if main broadcaster has a token
    const hasBroadcasterToken = allTokens.some(
      (t) => t.kick_user_id.toString() === broadcasterPrincipal.toString()
    );
    logger.info(
      "[DIAGNOSTIC] Main broadcaster has token?",
      hasBroadcasterToken
    );

    // 4. Check current subscriptions
    const suscripciones = await KickEventSubscription.findAll({
      where: { broadcaster_user_id: parseInt(broadcasterPrincipal) },
      attributes: ["event_type", "subscription_id", "status"],
    });

    logger.info(
      "[DIAGNOSTIC] Main broadcaster subscriptions:",
      suscripciones.length
    );

    // 5. Check which user is NaferJ (ID 33112734)
    const hasNaferToken = allTokens.some(
      (t) => t.kick_user_id.toString() === "33112734"
    );
    logger.info("[DIAGNOSTIC] NaferJ (33112734) has token?", hasNaferToken);
    logger.info(
      "[DIAGNOSTIC] Is NaferJ the main broadcaster?",
      broadcasterPrincipal.toString() === "33112734"
    );

    const diagnostico = {
      broadcaster_principal_config: broadcasterPrincipal,
      broadcaster_principal_tiene_token: hasBroadcasterToken,
      nafer_user_id: "33112734",
      nafer_tiene_token: hasNaferToken,
      nafer_es_broadcaster_principal:
        broadcasterPrincipal.toString() === "33112734",
      total_tokens_activos: allTokens.length,
      total_suscripciones: suscripciones.length,
      tokens_disponibles: allTokens.map((t) => t.kick_user_id),
      posible_problema:
        broadcasterPrincipal.toString() !== "33112734"
          ? "Main broadcaster is NOT NaferJ, but NaferJ is trying to subscribe to another broadcaster's events"
          : "NaferJ IS the main broadcaster, should work",
      recomendacion:
        broadcasterPrincipal.toString() !== "33112734"
          ? "The main broadcaster (ID: " +
            broadcasterPrincipal +
            ") needs to authenticate and use THEIR token"
          : "Setup should be correct, the issue may be network or configuration",
    };

    logger.info("[DIAGNOSTIC] SUMMARY:", diagnostico);

    res.json({
      success: true,
      diagnostico,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[DIAGNOSTIC] Error:", error);
    throw new AppError(error.message, 500);
  }
});
exports.testCors = asyncHandler(async (req, res) => {
  logger.info("[CORS Test] ==========================================");
  logger.info("[CORS Test] Method:", req.method);
  logger.info("[CORS Test] Origin:", req.headers.origin || "NO ORIGIN");
  logger.info("[CORS Test] User-Agent:", req.headers["user-agent"]);
  logger.info("[CORS Test] Headers:", Object.keys(req.headers));
  logger.info("[CORS Test] ==========================================");

  res.status(200).json({
    message: "CORS working correctly for webhooks",
    timestamp: new Date().toISOString(),
    method: req.method,
    origin: req.headers.origin || "No origin",
    headers: req.headers,
    corsEnabled: true,
  });
});

/**
 * Main controller to receive Kick webhooks
 */
exports.handleWebhook = async (req, res) => {
  // Production-optimized logging
  const eventType = req.headers["kick-event-type"];
  const messageId = req.headers["kick-event-message-id"];

  // LOG ALL EVENTS - UNFILTERED

  try {
    // If it's a simple test request, respond immediately
    if (req.body && req.body.test === true) {
      return res.status(200).json({
        status: "success",
        message: "Test webhook received",
        timestamp: new Date().toISOString(),
      });
    }

    // Extract webhook headers
    const subscriptionId = req.headers["kick-event-subscription-id"];
    const signature = req.headers["kick-event-signature"];
    const timestamp = req.headers["kick-event-message-timestamp"];
    const eventVersion = req.headers["kick-event-version"];

    // If Kick webhook headers are missing but there's content, it may be a verification
    if (!messageId && !eventType) {
      return res.status(200).json({ message: "Webhook endpoint ready" });
    }

    // Validate required headers exist
    if (!messageId || !signature || !timestamp || !eventType) {
      logger.error("[Kick Webhook] Missing required headers");
      return res.status(400).json({ error: "Missing required headers" });
    }

    // Get raw body as string
    const rawBody = JSON.stringify(req.body);

    // Verify webhook signature
    const isValidSignature = verifyWebhookSignature(
      messageId,
      timestamp,
      rawBody,
      signature
    );

    if (!isValidSignature) {
      logger.error("[Kick Webhook] Invalid signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Check if event was already processed (idempotency)
    const existingEvent = await KickWebhookEvent.findOne({
      where: { message_id: messageId },
    });

    if (existingEvent) {
      return res.status(200).json({ message: "Event already processed" });
    }

    // Save event to database
    await KickWebhookEvent.create({
      message_id: messageId,
      subscription_id: subscriptionId,
      event_type: eventType,
      event_version: eventVersion,
      message_timestamp: new Date(timestamp),
      payload: req.body,
      processed: false,
    });

    // Process event by type
    await processWebhookEvent(eventType, eventVersion, req.body, {
      messageId,
      subscriptionId,
      timestamp,
    });

    // Mark as processed
    await KickWebhookEvent.update(
      { processed: true, processed_at: new Date() },
      { where: { message_id: messageId } }
    );

    // Respond with 200 to confirm receipt
    return res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    logger.error("[Kick Webhook] Error processing webhook:", error.message);
    return res.status(500).json({ error: "Internal error processing webhook" });
  }
};

/**
 * Process event by type
 * @param {string} eventType - Event type (e.g. chat.message.sent)
 * @param {string} eventVersion - Event version
 * @param {object} payload - Event data
 * @param {object} metadata - Webhook metadata (messageId, subscriptionId, timestamp)
 */
async function processWebhookEvent(eventType, eventVersion, payload, metadata) {
  logger.info(`[Kick Webhook] Processing event ${eventType}`);

  // DEBUG LOG - SEE ALL EVENTS

  // Check exact value
  if (eventType === "livestream.status.updated") {
    logger.warn(`EXACT MATCH: livestream.status.updated`);
  } else if (eventType?.includes?.("livestream")) {
    logger.warn(`CONTAINS livestream BUT NO MATCH: "${eventType}"`);
  }

  switch (eventType) {
    case "chat.message.sent":
      await handleChatMessage(payload, metadata);
      break;

    case "channel.followed":
      logger.info("CASE MATCH: channel.followed");
      await handleChannelFollowed(payload, metadata);
      break;

    case "channel.subscription.new":
      logger.info("CASE MATCH: channel.subscription.new");
      await handleNewSubscription(payload, metadata);
      break;

    case "channel.subscription.renewal":
      logger.info("CASE MATCH: channel.subscription.renewal");
      await handleSubscriptionRenewal(payload, metadata);
      break;

    case "channel.subscription.gifts":
      logger.info("CASE MATCH: channel.subscription.gifts");
      await handleSubscriptionGifts(payload, metadata);
      break;

    case "livestream.status.updated":
      logger.info("CASE MATCH: livestream.status.updated");
      await handleLivestreamStatusUpdated(payload, metadata);
      break;

    case "livestream.metadata.updated":
      logger.info("CASE MATCH: livestream.metadata.updated");
      await handleLivestreamMetadataUpdated(payload, metadata);
      break;

    case "moderation.banned":
      logger.info("CASE MATCH: moderation.banned");
      await handleModerationBanned(payload, metadata);
      break;

    case "kicks.gifted":
      logger.info("CASE MATCH: kicks.gifted");
      await handleKicksGifted(payload, metadata);
      break;

    case "channel.reward.redemption.updated":
      logger.info("CASE MATCH: channel.reward.redemption.updated");
      await handleRewardRedemption(payload, metadata);
      break;

    default:
      logger.warn(`UNHANDLED EVENT: "${eventType}"`);
      logger.info(`[Kick Webhook] Unhandled event type: ${eventType}`);
  }
}

// ============================================================================
// Handlers for each event type
// ============================================================================

/**
 * Send chat message notifying user they are not registered for reward redemption
 */
async function notifyUnregisteredReward(kickUsername, localReward) {
  try {
    const bot = require("../services/kickBot.service");
    const message = `@${kickUsername} your reward "${localReward.title}" could not be processed because you are not registered in the shop. Register at https://shop.luisardito.com/ to receive your points!`;
    await bot.sendMessage(message);
    logger.info(`[Reward Redemption] Message sent to ${kickUsername} in chat`);
  } catch (botError) {
    logger.error(
      `[Reward Redemption] Error sending chat message:`,
      botError.message
    );
  }
}

/**
 * Handle channel reward redemptions
 */
async function handleRewardRedemption(payload, _metadata) {
  try {
    const { id: redemptionId, reward, redeemer, status, user_input } = payload;
    const kickRewardId = reward.id;
    const kickUserId = String(redeemer.user_id);
    const kickUsername = redeemer.username;

    logger.info(
      `[Reward Redemption] ${kickUsername} redeemed "${reward.title}" (${reward.cost} pts) - Status: ${status}`
    );

    // Find reward in our DB
    const localReward = await KickReward.findOne({
      where: { kick_reward_id: kickRewardId },
    });

    if (!localReward) {
      logger.warn(
        `[Reward Redemption] Reward "${reward.title}" (${kickRewardId}) not configured in DB`
      );
      return;
    }

    // ALWAYS find user in our DB (for both cases: pending and accepted)
    let usuario = await Usuario.findOne({
      where: { user_id_ext: kickUserId },
    });

    // If pending and user doesn't exist, send message
    if (status === "pending" && !usuario) {
      logger.warn(
        `[Reward Redemption] User ${kickUsername} not registered in store`
      );

      await notifyUnregisteredReward(kickUsername, localReward);
      return;
    }

    // If pending and user DOES exist, just wait
    if (status === "pending") {
      logger.info(
        `[Reward Redemption] User registered. Redemption pending approval - waiting...`
      );
      return;
    }

    if (status === "rejected") {
      logger.info(
        `[Reward Redemption] Redemption rejected - no points processed`
      );
      return;
    }

    if (status !== "accepted") {
      logger.warn(`[Reward Redemption] Unknown status: ${status}`);
      return;
    }

    // Search again in case user registered after pending
    if (!usuario) {
      usuario = await Usuario.findOne({
        where: { user_id_ext: kickUserId },
      });
    }

    // If user STILL doesn't exist after accepted
    if (!usuario) {
      logger.warn(
        `[Reward Redemption] User ${kickUsername} still not registered. No points awarded.`
      );
      return;
    }

    if (!localReward.is_enabled) {
      logger.info(`[Reward Redemption] Reward "${localReward.title}" disabled`);
      return;
    }

    // Award points
    const puntosAOtorgar = localReward.puntos_a_otorgar;

    if (puntosAOtorgar <= 0) {
      logger.info(
        `[Reward Redemption] Reward "${localReward.title}" awards no points (configured at 0)`
      );
      return;
    }

    const transaction = await sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    });

    try {
      // Increment user points
      await usuario.increment("puntos", {
        by: puntosAOtorgar,
        transaction,
      });

      // Register in history
      await HistorialPunto.create(
        {
          usuario_id: usuario.id,
          puntos: puntosAOtorgar,
          tipo: "ganado",
          concepto: `Canje de recompensa: ${localReward.title}`,
          kick_event_data: {
            event_type: "channel.reward.redemption.updated",
            redemption_id: redemptionId,
            reward_id: kickRewardId,
            reward_title: localReward.title,
            reward_cost: reward.cost,
            user_input: user_input || "",
          },
        },
        { transaction }
      );

      // Create notification for earned points
      await NotificacionService.crearNotificacionPuntosGanados(
        usuario.id,
        {
          cantidad: puntosAOtorgar,
          concepto: `Canje de recompensa: ${localReward.title}`,
          tipo_evento: "channel.reward.redemption.updated",
        },
        transaction
      );

      // Increment redemption counter
      await localReward.increment("total_redemptions", {
        by: 1,
        transaction,
      });

      await transaction.commit();

      await usuario.reload();
      logger.info(
        `[Reward Redemption] ${kickUsername} received ${puntosAOtorgar} points. Total: ${usuario.puntos}`
      );
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  } catch (error) {
    logger.error("[Reward Redemption] Error:", error.message);
  }
}

/**
 * Process Botrix migration (points + watchtime) for a chat message.
 * Returns true if the message was fully consumed by migration.
 */
async function processBotrixMigration(payload, botrixConfig) {
  if (botrixConfig.migration_enabled) {
    logger.info("[BOTRIX DEBUG] Checking message for points migration...");
    const botrixResult =
      await BotrixMigrationService.processChatMessage(payload);
    logger.info("[BOTRIX DEBUG] Processing result:", botrixResult);

    if (botrixResult.processed) {
      logger.info(
        `[BOTRIX] Points migration processed: ${JSON.stringify(botrixResult.details)}`
      );
      return true;
    }
    logger.info(`[BOTRIX] Points not processed: ${botrixResult.reason}`);
  }

  if (botrixConfig.watchtime_migration_enabled) {
    logger.info(
      "[BOTRIX WATCHTIME DEBUG] Checking message for watchtime migration..."
    );
    const watchtimeResult =
      await BotrixMigrationService.processWatchtimeMessage(payload);
    logger.info("[BOTRIX WATCHTIME DEBUG] Processing result:", watchtimeResult);

    if (watchtimeResult.processed) {
      logger.info(
        `[BOTRIX WATCHTIME] Watchtime migration processed: ${JSON.stringify(watchtimeResult.details)}`
      );
      return true;
    }
    logger.info(
      `[BOTRIX WATCHTIME] Watchtime not processed: ${watchtimeResult.reason}`
    );
  }

  return false;
}

/**
 * Process moderator commands from chat. Returns true if message was consumed.
 */
async function processModeratorCommands(payload) {
  try {
    const content = String(payload.content || "").trim();
    const modCommands = ["!addcmd", "!editcmd", "!delcmd", "!cmdinfo"];

    if (!modCommands.some((cmd) => content.startsWith(cmd))) {
      return false;
    }

    const ModeratorCommandsService = require("../services/kickModeratorCommands.service");
    const modResult =
      await ModeratorCommandsService.processModeratorCommand(payload);

    if (!modResult.processed) {
      return false;
    }

    logger.info(
      `[MOD-CMD] Moderator command processed: ${content.split(/\s+/)[0]}`
    );

    if (modResult.message) {
      try {
        const bot = require("../services/kickBot.service");
        await bot.sendMessage(modResult.message);
        logger.info(`[MOD-CMD] Response sent to chat: ${modResult.message}`);
      } catch (botError) {
        logger.error(
          `[MOD-CMD] Error sending response to chat:`,
          botError.message
        );
      }
    }

    return true;
  } catch (modErr) {
    logger.error(
      "[MOD-CMD] Error handling moderator commands:",
      modErr.message
    );
    return false;
  }
}

/**
 * Process bot commands from chat.
 */
async function processBotCommands(payload, kickUserId, kickUsername) {
  try {
    const content = String(payload.content || "").trim();
    if (!content.startsWith("!")) {
      return;
    }

    const bot = require("../services/kickBot.service");
    const commandHandler = require("../services/kickBotCommandHandler.service");

    const commandProcessed = await commandHandler.processMessage(
      content,
      kickUserId,
      payload.channel?.username || "luisardito",
      bot,
      null,
      "kick",
      null,
      kickUsername
    );

    if (commandProcessed) {
      logger.info(
        `[BOT-COMMAND] Command processed successfully for ${kickUsername}`
      );
    } else {
      logger.debug(
        `[BOT-COMMAND] Command not registered: ${content.split(/\s+/)[0]}`
      );
    }
  } catch (cmdErr) {
    logger.error("[Chat Command] Error handling commands:", cmdErr.message);
  }
}

/**
 * Check if stream is live via Redis. Returns true if live (or on Redis error, assumes live).
 */
async function isStreamLive() {
  try {
    const redis = getRedisClient();
    const isLive = await redis.get("stream:is_live");

    if (isLive !== "true") {
      return false;
    }
    return true;
  } catch (redisError) {
    logger.error(`[STREAM] Error checking status:`, redisError.message);
    logger.info(`[STREAM] Assuming LIVE due to Redis error`);
    return true;
  }
}

/**
 * Process watchtime tracking for a user on every chat message.
 */
async function processWatchtime(kickUserId, usuarioId) {
  try {
    const wtNow = new Date();
    const redis = getRedisClient();
    const WATCHTIME_COOLDOWN_MS = 60 * 1000;
    const watchtimeKey = `watchtime_cooldown:${kickUserId}`;

    const wasSet = await redis.set(
      watchtimeKey,
      wtNow.toISOString(),
      "PX",
      WATCHTIME_COOLDOWN_MS,
      "NX"
    );

    if (!wasSet) {
      logger.info(`[WATCHTIME] User ${kickUserId} on cooldown (1 min)`);
      return;
    }

    const [, created] = await UserWatchtime.findOrCreate({
      where: { usuario_id: usuarioId },
      defaults: {
        usuario_id: usuarioId,
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
        { where: { usuario_id: usuarioId } }
      );
      await UserWatchtime.update(
        { last_message_at: wtNow },
        { where: { usuario_id: usuarioId } }
      );
    }

    logger.info(`[WATCHTIME] User ${kickUserId} +1 minute`);
  } catch (watchtimeError) {
    logger.error(`[WATCHTIME] Error:`, watchtimeError.message);
  }
}

/**
 * Resolve subscriber status for a Kick user, deactivating expired subscriptions.
 */
async function resolveSubscriberStatus(kickUserId, kickUsername) {
  const userTracking = await KickUserTracking.findOne({
    where: { kick_user_id: kickUserId },
  });

  const now = new Date();
  if (!userTracking?.is_subscribed) {
    return { isSubscriber: false, userTracking };
  }

  const expiresAt = userTracking.subscription_expires_at
    ? new Date(userTracking.subscription_expires_at)
    : null;

  if (expiresAt && expiresAt > now) {
    return { isSubscriber: true, userTracking };
  }

  // Expired subscription: deactivate flag
  try {
    await KickUserTracking.update(
      { is_subscribed: false },
      { where: { kick_user_id: kickUserId } }
    );
    logger.info(
      `[CHAT] Subscription expired for ${kickUsername} - is_subscribed=false`
    );
  } catch (e) {
    logger.error("[CHAT] Error deactivating expired subscription:", e.message);
  }

  return { isSubscriber: false, userTracking };
}

/**
 * Award chat points to a user within a DB transaction.
 */
async function awardChatPoints(
  usuario,
  pointsToAward,
  userType,
  isVipActive,
  isSubscriber,
  payload,
  kickUserId,
  kickUsername
) {
  const COOLDOWN_MS = 5 * 60 * 1000;
  const cooldownKey = `chat_cooldown:${kickUserId}`;
  const now = new Date();

  logger.info(`[REDIS COOLDOWN] Checking for ${kickUsername} (${kickUserId})`);

  try {
    const redis = getRedisClient();
    const wasSet = await redis.set(
      cooldownKey,
      now.toISOString(),
      "PX",
      COOLDOWN_MS,
      "NX"
    );

    if (!wasSet) {
      const ttl = await redis.pttl(cooldownKey);
      const remainingSecs = Math.ceil(ttl / 1000);
      logger.info(`[REDIS COOLDOWN] ${kickUsername} BLOCKED - active cooldown`);
      logger.info(
        `[REDIS COOLDOWN] ${remainingSecs}s remaining (${Math.ceil(ttl / 60000)} minutes)`
      );
      return;
    }

    logger.info(`[REDIS COOLDOWN] ${kickUsername} can receive points`);
    logger.info(
      `[REDIS COOLDOWN] Next message allowed in: ${COOLDOWN_MS / 1000}s (${COOLDOWN_MS / 60000} minutes)`
    );
  } catch (redisError) {
    logger.error(`[REDIS COOLDOWN] Redis error:`, redisError.message);
    logger.info(
      `[REDIS COOLDOWN] Fallback: continuing without cooldown due to Redis error`
    );
  }

  const transaction = await sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
  });

  try {
    await usuario.increment("puntos", { by: pointsToAward }, { transaction });

    const usuarioActualizado = await usuario.reload({ transaction });
    if (usuarioActualizado.puntos > usuarioActualizado.max_puntos) {
      await usuarioActualizado.update(
        { max_puntos: usuarioActualizado.puntos },
        { transaction }
      );
      logger.info(
        `[MAX POINTS] New max points: ${usuarioActualizado.puntos} for ${kickUsername}`
      );
    }

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
      { transaction }
    );

    await transaction.commit();

    logger.info(
      `[Chat Message] ${pointsToAward} points -> ${kickUsername} (${userType})`
    );
    logger.info(
      `[Chat Message] Total user points: ${usuarioActualizado.puntos}`
    );
  } catch (transactionError) {
    await transaction.rollback();
    logger.error(
      `[Chat Message] Transaction error for ${kickUsername}:`,
      transactionError.message
    );

    try {
      const redis = getRedisClient();
      await redis.del(cooldownKey);
      logger.info(
        `[REDIS COOLDOWN] Cooldown deleted due to DB error - allowing retry`
      );
    } catch (redisCleanupError) {
      logger.error(
        `[REDIS COOLDOWN] Error cleaning cooldown:`,
        redisCleanupError.message
      );
    }

    throw transactionError;
  }
}

/**
 * Handle chat messages
 */
async function handleChatMessage(payload, _metadata) {
  try {
    const sender = payload.sender;
    const kickUserId = String(sender.user_id);
    const kickUsername = sender.username;

    // PRIORITY 1: Check if it's a Botrix migration
    const { BotrixMigrationConfig } = require("../models");
    const botrixConfig = await BotrixMigrationConfig.getConfig();

    const botrixConsumed = await processBotrixMigration(payload, botrixConfig);
    if (botrixConsumed) return;

    // ==========================================
    // MODERATOR COMMANDS (Command management from chat)
    // Processed BEFORE regular commands and points
    // ==========================================
    const modConsumed = await processModeratorCommands(payload);
    if (modConsumed) return;

    // ==========================================
    // BOT COMMANDS (Dynamic system from DB)
    // Always responded to, regardless of stream status
    // ==========================================
    await processBotCommands(payload, kickUserId, kickUsername);

    // PRIORITY 2: Check if stream is live (for points, not for commands)
    const live = await isStreamLive();
    if (!live) {
      logger.info(`[STREAM] OFFLINE - No points awarded to ${kickUsername}`);
      return;
    }

    logger.info(`[STREAM] LIVE - Processing points for ${kickUsername}`);

    // Check if user exists in our DB
    const usuario = await Usuario.findOne({
      where: { user_id_ext: kickUserId },
    });

    if (!usuario) {
      logger.info(
        `[Chat Message] User ${kickUsername} not registered, ignoring`
      );
      return;
    }

    // Sync full profile (username and avatar) if changed (with 24h throttling)
    await syncUserProfileIfNeeded(
      usuario,
      kickUsername,
      kickUserId,
      false,
      sender.profile_picture
    );

    // WATCHTIME: Processed on EVERY message (live stream + registered user)
    await processWatchtime(kickUserId, usuario.id);

    // Get points configuration
    const configs = await KickPointsConfig.findAll({
      where: { enabled: true },
    });

    const configMap = {};
    configs.forEach((c) => {
      configMap[c.config_key] = c.config_value;
    });

    // Determine if subscriber (validating expiration)
    const { isSubscriber } = await resolveSubscriberStatus(
      kickUserId,
      kickUsername
    );

    const now = new Date();
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
    } else if (isVipActive && configMap["chat_points_vip"]) {
      pointsToAward = configMap["chat_points_vip"];
      userType = "vip";
    }

    logger.info(
      `[CHAT POINTS] ${kickUsername} - VIP: ${isVipActive}, Subscriber: ${isSubscriber}, Type: ${userType}, Points: ${pointsToAward}`
    );

    if (pointsToAward <= 0) {
      return;
    }

    // AWARD POINTS (only if passed Redis cooldown)
    await awardChatPoints(
      usuario,
      pointsToAward,
      userType,
      isVipActive,
      isSubscriber,
      payload,
      kickUserId,
      kickUsername
    );
  } catch (error) {
    logger.error("[Chat Message] Error:", error.message);
  }
}

/**
 * Handle new followers
 */
async function handleChannelFollowed(payload, _metadata) {
  try {
    const follower = payload.follower;
    const kickUserId = String(follower.user_id);
    const kickUsername = follower.username;

    logger.info("[Kick Webhook][Channel Followed]", {
      broadcaster: payload.broadcaster.username,
      follower: kickUsername,
    });

    // Check if user exists in our DB
    const usuario = await Usuario.findOne({
      where: { user_id_ext: kickUserId },
    });

    if (!usuario) {
      logger.info(
        `[Kick Webhook][Channel Followed] User ${kickUsername} not registered in DB`
      );
      return;
    }

    // Sync full profile (username and avatar) if changed (NO throttling, infrequent event)
    await syncUserProfileIfNeeded(
      usuario,
      kickUsername,
      kickUserId,
      true,
      follower.profile_picture
    );

    // Check if already followed before (first time only)
    let userTracking = await KickUserTracking.findOne({
      where: { kick_user_id: kickUserId },
    });

    if (userTracking && userTracking.follow_points_awarded) {
      logger.info(
        `[Kick Webhook][Channel Followed] User ${kickUsername} already received follow points previously`
      );
      return;
    }

    // Get follow points configuration
    const config = await KickPointsConfig.findOne({
      where: {
        config_key: "follow_points",
        enabled: true,
      },
    });

    const basePoints = config?.config_value || 0;

    // Calculate points considering VIP (TEMPORARY: Disabled)
    const pointsToAward = basePoints; // await VipService.calculatePointsForUser(usuario, 'follow', basePoints);

    if (pointsToAward <= 0) {
      logger.info("[Kick Webhook][Channel Followed] Follow points disabled");
      return;
    }

    // Award points
    await usuario.increment("puntos", { by: pointsToAward });

    // Determine user type
    const userType = "regular"; // usuario.getUserType();

    // Register in history
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

    // Create notification for follow points earned
    await NotificacionService.crearNotificacionPuntosGanados(usuario.id, {
      cantidad: pointsToAward,
      concepto: `Primer follow al canal`,
      tipo_evento: "channel.followed",
    });

    // Update or create tracking
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
      `[Kick Webhook][Channel Followed] ${pointsToAward} points awarded to ${kickUsername} (first follow - ${userType})`
    );
  } catch (error) {
    logger.error("[Kick Webhook][Channel Followed] Error:", error.message);
  }
}

/**
 * Handle new subscriptions
 */
async function handleNewSubscription(payload, _metadata) {
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

    // Check if user exists in our DB
    const usuario = await Usuario.findOne({
      where: { user_id_ext: kickUserId },
    });

    if (!usuario) {
      logger.info(
        `[Kick Webhook][New Subscription] User ${kickUsername} not registered in DB`
      );
      return;
    }

    // Sync full profile (username and avatar) if changed (NO throttling, infrequent event)
    await syncUserProfileIfNeeded(
      usuario,
      kickUsername,
      kickUserId,
      true,
      subscriber.profile_picture
    );

    // Get new subscription points configuration
    const config = await KickPointsConfig.findOne({
      where: {
        config_key: "subscription_new_points",
        enabled: true,
      },
    });

    const basePoints = config?.config_value || 0;

    // Calculate points considering VIP (TEMPORARY: Disabled)
    const pointsToAward = basePoints; // await VipService.calculatePointsForUser(usuario, 'sub', basePoints);

    if (pointsToAward > 0) {
      // Award points
      await usuario.increment("puntos", { by: pointsToAward });

      // Determine user type
      const userType = "sub"; // usuario.getUserType();

      // Register in history
      await HistorialPunto.create({
        usuario_id: usuario.id,
        puntos: pointsToAward,
        tipo: "ganado",
        concepto: `New subscription (${duration} ${duration === 1 ? "month" : "months"}) - ${userType}`,
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

      // Create notification for subscription points earned
      await NotificacionService.crearNotificacionPuntosGanados(usuario.id, {
        cantidad: pointsToAward,
        concepto: `New subscription (${duration} ${duration === 1 ? "month" : "months"})`,
        tipo_evento: "channel.subscription.new",
        duracion_meses: duration,
      });
    }

    // Update user tracking
    await KickUserTracking.upsert({
      kick_user_id: kickUserId,
      kick_username: kickUsername,
      is_subscribed: true,
      subscription_expires_at: expiresAt,
      subscription_duration_months: duration,
      total_subscriptions: KickUserTracking.sequelize.literal(
        "total_subscriptions + 1"
      ),
    });

    logger.info(
      `[Kick Webhook][New Subscription] ${pointsToAward} points awarded to ${kickUsername}, sub until ${expiresAt}`
    );
  } catch (error) {
    logger.error("[Kick Webhook][New Subscription] Error:", error.message);
  }
}

/**
 * Handle subscription renewals
 */
async function handleSubscriptionRenewal(payload, _metadata) {
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

    // Check if user exists in our DB
    const usuario = await Usuario.findOne({
      where: { user_id_ext: kickUserId },
    });

    if (!usuario) {
      logger.info(
        `[Kick Webhook][Subscription Renewal] User ${kickUsername} not registered in DB`
      );
      return;
    }

    // Sync full profile (username and avatar) if changed (NO throttling, infrequent event)
    await syncUserProfileIfNeeded(
      usuario,
      kickUsername,
      kickUserId,
      true,
      subscriber.profile_picture
    );

    // Get renewal points configuration
    const config = await KickPointsConfig.findOne({
      where: {
        config_key: "subscription_renewal_points",
        enabled: true,
      },
    });

    const pointsToAward = config?.config_value || 0;

    if (pointsToAward > 0) {
      // Award points
      await usuario.increment("puntos", { by: pointsToAward });

      // Register in history
      await HistorialPunto.create({
        usuario_id: usuario.id,
        puntos: pointsToAward,
        tipo: "ganado",
        concepto: `Subscription renewal (${duration} ${duration === 1 ? "month" : "months"})`,
        kick_event_data: {
          event_type: "channel.subscription.renewal",
          kick_user_id: kickUserId,
          kick_username: kickUsername,
          duration,
          expires_at: expiresAt,
        },
      });
    }

    // Update user tracking
    await KickUserTracking.upsert({
      kick_user_id: kickUserId,
      kick_username: kickUsername,
      is_subscribed: true,
      subscription_expires_at: expiresAt,
      subscription_duration_months: duration,
      total_subscriptions: KickUserTracking.sequelize.literal(
        "total_subscriptions + 1"
      ),
    });

    logger.info(
      `[Kick Webhook][Subscription Renewal] ${pointsToAward} points awarded to ${kickUsername}, sub renewed until ${expiresAt}`
    );
  } catch (error) {
    logger.error("[Kick Webhook][Subscription Renewal] Error:", error.message);
  }
}

/**
 * Award points to the gifter of subscription gifts.
 */
async function awardGifterPoints(gifter, giftees, pointsForGifter) {
  const gifterKickUserId = String(gifter.user_id);
  const gifterUsuario = await Usuario.findOne({
    where: { user_id_ext: gifterKickUserId },
  });

  if (!gifterUsuario) {
    return;
  }

  logger.info("[Subscription Gifts] Gifter found in DB, awarding points");

  await syncUserProfileIfNeeded(
    gifterUsuario,
    gifter.username,
    gifterKickUserId,
    true,
    gifter.profile_picture
  );

  const totalPoints = pointsForGifter * giftees.length;
  await gifterUsuario.increment("puntos", { by: totalPoints });

  await HistorialPunto.create({
    usuario_id: gifterUsuario.id,
    puntos: totalPoints,
    tipo: "ganado",
    concepto: `Gifted ${giftees.length} subscription${giftees.length !== 1 ? "s" : ""}`,
    kick_event_data: {
      event_type: "channel.subscription.gifts",
      kick_user_id: gifterKickUserId,
      kick_username: gifter.username,
      gifts_count: giftees.length,
    },
  });

  await NotificacionService.crearNotificacionPuntosGanados(gifterUsuario.id, {
    cantidad: totalPoints,
    concepto: `You gifted ${giftees.length} subscription${giftees.length !== 1 ? "s" : ""}`,
    tipo_evento: "channel.subscription.gifts",
    gifts_count: giftees.length,
  });

  await KickUserTracking.upsert({
    kick_user_id: gifterKickUserId,
    kick_username: gifter.username,
    total_gifts_given: KickUserTracking.sequelize.literal(
      `total_gifts_given + ${giftees.length}`
    ),
  });

  logger.info(
    `[Kick Webhook][Subscription Gifts] ${totalPoints} points to ${gifter.username} for gifting ${giftees.length} subs`
  );
}

/**
 * Award points to a single giftee of a subscription gift.
 */
async function awardGifteePoints(giftee, gifter, pointsForGiftee, expiresAt) {
  const gifteeKickUserId = String(giftee.user_id);
  const gifteeUsername = giftee.username;

  const gifteeUsuario = await Usuario.findOne({
    where: { user_id_ext: gifteeKickUserId },
  });

  if (!gifteeUsuario) {
    return;
  }

  await syncUserProfileIfNeeded(
    gifteeUsuario,
    gifteeUsername,
    gifteeKickUserId,
    true,
    giftee.profile_picture
  );

  await gifteeUsuario.increment("puntos", { by: pointsForGiftee });

  await HistorialPunto.create({
    usuario_id: gifteeUsuario.id,
    puntos: pointsForGiftee,
    tipo: "ganado",
    concepto: `Received gifted subscription`,
    kick_event_data: {
      event_type: "channel.subscription.gifts",
      kick_user_id: gifteeKickUserId,
      kick_username: gifteeUsername,
      gifter: gifter.is_anonymous ? "Anonymous" : gifter.username,
      expires_at: expiresAt,
    },
  });

  await NotificacionService.crearNotificacionSubRegalada(gifteeUsuario.id, {
    regalador_username: gifter.is_anonymous
      ? "An anonymous user"
      : gifter.username,
    monto_subscription: 1,
    puntos_otorgados: pointsForGiftee,
    expires_at: expiresAt,
  });

  await KickUserTracking.upsert({
    kick_user_id: gifteeKickUserId,
    kick_username: gifteeUsername,
    is_subscribed: true,
    subscription_expires_at: expiresAt,
    total_gifts_received: KickUserTracking.sequelize.literal(
      "total_gifts_received + 1"
    ),
    total_subscriptions: KickUserTracking.sequelize.literal(
      "total_subscriptions + 1"
    ),
  });

  logger.info(
    "[Subscription Gifts]",
    pointsForGiftee,
    "points to",
    gifteeUsername,
    "for receiving gifted sub"
  );
  logger.info(
    "[Subscription Gifts] Total receiver points:",
    (await gifteeUsuario.reload()).puntos
  );
}

/**
 * Handle subscription gifts
 */
async function handleSubscriptionGifts(payload, _metadata) {
  try {
    const gifter = payload.gifter;
    const giftees = payload.giftees || [];
    const expiresAt = new Date(payload.expires_at);

    logger.info("[Kick Webhook][Subscription Gifts]", {
      broadcaster: payload.broadcaster.username,
      gifter: gifter.is_anonymous ? "Anonymous" : gifter.username,
      giftees: giftees.map((g) => g.username),
      totalGifts: giftees.length,
    });

    // Get points configurations
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

    // Award points to gifter (if not anonymous)
    if (!gifter.is_anonymous && pointsForGifter > 0) {
      await awardGifterPoints(gifter, giftees, pointsForGifter);
    }

    // Award points to each giftee
    if (pointsForGiftee > 0) {
      for (const giftee of giftees) {
        await awardGifteePoints(giftee, gifter, pointsForGiftee, expiresAt);
      }
    }
  } catch (error) {
    logger.error("[Kick Webhook][Subscription Gifts] Error:", error.message);
  }
}

/**
 * Handle livestream status changes
 */
async function handleLivestreamStatusUpdated(payload, metadata) {
  try {
    logger.info("WEBHOOK LIVESTREAM.STATUS.UPDATED RECEIVED");

    const isLive = payload.is_live;
    const redis = getRedisClient();

    // Detailed full payload log for debugging
    logger.info("[STREAM STATUS] ==========================================");
    logger.info("[STREAM STATUS] WEBHOOK LIVESTREAM.STATUS.UPDATED RECEIVED");
    logger.info(
      "[STREAM STATUS] Full payload:",
      JSON.stringify(payload, null, 2)
    );
    logger.info("[STREAM STATUS] Metadata:", JSON.stringify(metadata, null, 2));

    logger.info("[Kick Webhook][Livestream Status]", {
      broadcaster: payload.broadcaster.username,
      is_live: isLive,
      title: payload.title,
      started_at: payload.started_at,
      ended_at: payload.ended_at,
      event_timestamp: metadata.timestamp,
      current_timestamp: new Date().toISOString(),
    });

    // Validate event timestamp (do not process very old events)
    if (metadata.timestamp) {
      const eventTimestamp = new Date(metadata.timestamp);
      const now = new Date();
      const ageMinutes = (now - eventTimestamp) / 1000 / 60;

      if (ageMinutes > 5) {
        logger.warn(
          `[STREAM STATUS] Event too old (${ageMinutes.toFixed(2)} minutes)`
        );
        logger.warn(`[STREAM STATUS] May be outdated, processing with caution`);
      }
    }

    // Get previous state from Redis
    const previousState = await redis.get("stream:is_live");
    const stateChanged = previousState !== (isLive ? "true" : "false");

    if (stateChanged) {
      logger.info(
        `[STREAM STATUS] CHANGE DETECTED: ${previousState || "unknown"} -> ${isLive ? "true" : "false"}`
      );
    } else {
      logger.info(
        `[STREAM STATUS] State unchanged: ${isLive ? "online" : "offline"}`
      );
    }

    // Update state in Redis with debounce logic
    // Webhooks are a fast source, but offline requires confirmation
    if (isLive) {
      // Stream ONLINE: NO TTL (persists indefinitely)
      await redis.set("stream:is_live", "true");
      await redis.set("stream:last_webhook_status", "online");
      await redis.set("stream:offline_poll_failures", 0); // Reset failure counter
      logger.info("[STREAM STATUS] ONLINE state saved (payload.is_live=true)");
    } else {
      // Stream OFFLINE: Mark directly as offline (without waiting for monitor)
      await redis.set("stream:is_live", "false");
      await redis.set("stream:last_webhook_status", "offline");
      logger.info(
        "[STREAM STATUS] OFFLINE state confirmed directly by webhook"
      );
    }

    // Save last update timestamp (always with TTL for cleanup)
    await redis.set(
      "stream:last_status_update",
      new Date().toISOString(),
      "EX",
      86400
    );

    // Save additional stream info
    if (isLive) {
      const streamInfo = {
        title: payload.title || "Untitled",
        started_at: payload.started_at,
        broadcaster: payload.broadcaster?.username,
        updated_by: "status.updated",
      };
      // Stream info NO TTL while online
      await redis.set("stream:current_info", JSON.stringify(streamInfo));
    } else {
      // When stream ends, clean up info
      await redis.del("stream:current_info");
      logger.info("[STREAM STATUS] Stream info cleaned");
    }

    logger.info(
      isLive
        ? "[STREAM] LIVE - Chat points ACTIVATED"
        : "[STREAM] OFFLINE - Chat points DEACTIVATED"
    );

    logger.info("[STREAM STATUS] ==========================================");
  } catch (error) {
    logger.error("[Kick Webhook][Livestream Status] Error:", error);
    logger.error("[Kick Webhook][Livestream Status] Stack:", error.stack);
  }
}

/**
 * Handle livestream metadata updates
 * IMPORTANT: This event does NOT indicate if stream is online/offline
 * Only updates stream info (title, category, etc.)
 * Must NOT change stream:is_live state
 */
async function handleLivestreamMetadataUpdated(payload, _metadata) {
  try {
    const redis = getRedisClient();

    logger.info("[Kick Webhook][Livestream Metadata]", {
      broadcaster: payload.broadcaster.username,
      title: payload.metadata.title,
      category: payload.metadata.category?.name,
      language: payload.metadata.language,
      has_mature_content: payload.metadata.has_mature_content,
    });

    // Get current state (do NOT modify here)
    const currentState = await redis.get("stream:is_live");

    // Update only metadata info
    const streamInfo = {
      title: payload.metadata.title || "Untitled",
      category: payload.metadata.category?.name || "Uncategorized",
      category_id: payload.metadata.category?.id,
      language: payload.metadata.language || "en",
      has_mature_content: payload.metadata.has_mature_content || false,
      broadcaster: payload.broadcaster?.username,
      updated_by: "metadata.updated",
      last_update: new Date().toISOString(),
    };

    // Stream info NO TTL
    await redis.set("stream:current_info", JSON.stringify(streamInfo));

    logger.info(
      `[STREAM METADATA] Metadata updated: "${streamInfo.title}" - ${streamInfo.category}`
    );
    logger.info(
      `[STREAM METADATA] Current stream state: ${currentState === "true" ? "ONLINE" : "OFFLINE"} (unchanged)`
    );
  } catch (error) {
    logger.error("[Kick Webhook][Livestream Metadata] Error:", error.message);
  }
}

/**
 * Handle moderation bans
 */
async function handleModerationBanned(payload, _metadata) {
  logger.info("[Kick Webhook][Moderation Banned]", {
    broadcaster: payload.broadcaster.username,
    moderator: payload.moderator.username,
    banned_user: payload.banned_user.username,
    reason: payload.metadata.reason,
    expires_at: payload.metadata.expires_at,
  });

  // Ban business logic (register ban, update permissions, etc.) is not yet implemented.
  // Logging only — no action taken for moderation bans at this time.
}

/**
 * Handle kicks gifts (kicks.gifted)
 * Awards points equivalent to the amount of kicks gifted
 */
async function handleKicksGifted(payload, _metadata) {
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

    // Check if user exists in our DB
    const usuario = await Usuario.findOne({
      where: { user_id_ext: kickUserId },
    });

    if (!usuario) {
      logger.info(
        `[Kick Webhook][Kicks Gifted] User ${kickUsername} not registered in DB`
      );
      return;
    }

    // Sync full profile (username and avatar) if changed (NO throttling, infrequent event)
    await syncUserProfileIfNeeded(
      usuario,
      kickUsername,
      kickUserId,
      true,
      sender.profile_picture
    );

    // Get multiplier from configuration
    const config = await KickPointsConfig.findOne({
      where: {
        config_key: "kicks_gifted_multiplier",
        enabled: true,
      },
    });

    const multiplier = config?.config_value || 2; // Default x2
    const pointsToAward = kickAmount * multiplier;

    if (pointsToAward <= 0) {
      logger.info("[Kick Webhook][Kicks Gifted] Kick amount is 0 or invalid");
      return;
    }

    // Start transaction to guarantee atomicity
    const transaction = await sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    });

    try {
      // Award points
      await usuario.increment("puntos", { by: pointsToAward }, { transaction });

      // Register in history
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
        { transaction }
      );

      // Create notification for kicks gift points earned
      await NotificacionService.crearNotificacionPuntosGanados(
        usuario.id,
        {
          cantidad: pointsToAward,
          concepto: `Regalo de ${kickAmount} kicks (${giftName})`,
          tipo_evento: "kicks.gifted",
          kick_amount: kickAmount,
          gift_name: giftName,
          gift_tier: giftTier,
        },
        transaction
      );

      // Update user tracking (optional, for statistics)
      await KickUserTracking.upsert(
        {
          kick_user_id: kickUserId,
          kick_username: kickUsername,
          total_kicks_gifted: sequelize.literal(
            `COALESCE(total_kicks_gifted, 0) + ${kickAmount}`
          ),
        },
        { transaction }
      );

      await transaction.commit();

      logger.info(
        `[Kick Webhook][Kicks Gifted] ${pointsToAward} points awarded to ${kickUsername} for gifting ${kickAmount} kicks`
      );

      // Reload user to show updated total
      const updatedUser = await usuario.reload();
      logger.info(
        `[Kick Webhook][Kicks Gifted] Total points for ${kickUsername}: ${updatedUser.puntos}`
      );
    } catch (transactionError) {
      await transaction.rollback();
      logger.error(
        `[Kick Webhook][Kicks Gifted] Transaction error for ${kickUsername}:`,
        transactionError.message
      );
      throw transactionError;
    }
  } catch (error) {
    logger.error("[Kick Webhook][Kicks Gifted] Error:", error.message);
  }
}

/**
 * Simple endpoint to verify Kick can reach the server
 * GET /webhook/test
 */
exports.testWebhook = asyncHandler(async (req, res) => {
  logger.info("[Kick Webhook] Test endpoint reached");
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
});

/**
 * Endpoint to verify webhook configuration
 * GET /webhook/debug
 */
exports.debugWebhook = asyncHandler(async (req, res) => {
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
    if (error instanceof AppError) throw error;
    throw new AppError(error.message, 500);
  }
});

/**
 * Temporary endpoint to simulate a chat event and verify processing works
 * POST /api/kick-webhook/simulate-chat
 */
exports.simulateChat = asyncHandler(async (req, res) => {
  try {
    logger.info("[Webhook Simulator] Simulating chat event...");

    // Simulate chat message payload
    const simulatedPayload = {
      message_id: "sim_" + Date.now(),
      content: "Mensaje de prueba simulado",
      sender: {
        user_id: 33112734, // Your user_id
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

    logger.info("[Webhook Simulator] Processing simulated event...");

    // Process the event as if it were real
    await processWebhookEvent(
      "chat.message.sent",
      1,
      simulatedPayload,
      metadata
    );

    return res.json({
      status: "success",
      message: "Simulated chat event processed",
      payload: simulatedPayload,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Webhook Simulator] Error:", error.message);
    throw new AppError(error.message, 500);
  }
});

/**
 * Endpoint to simulate a REAL Kick webhook (with headers and all)
 * POST /api/kick-webhook/test-real-webhook
 */
exports.testRealWebhook = asyncHandler(async (req, res) => {
  try {
    logger.info(
      "[Test Real Webhook] Simulating REAL Kick webhook with headers..."
    );

    // Simulate exact headers sent by Kick
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

    // Simulate real Kick payload
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

    // Modify request to simulate coming from Kick
    req.headers = { ...req.headers, ...mockHeaders };
    req.body = mockPayload;

    logger.info("[Test Real Webhook] Simulated headers:", mockHeaders);
    logger.info("[Test Real Webhook] Simulated payload:", mockPayload);

    // Call main handler as if it were a real webhook
    await this.handleWebhook(req, res);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Test Real Webhook] Error:", error.message);
    throw new AppError(error.message, 500);
  }
});

/**
 * Renew an expired broadcaster token if possible.
 * Throws AppError on failure.
 */
async function renewBroadcasterTokenIfNeeded(broadcasterToken) {
  const now = new Date();
  const expiresAt = new Date(broadcasterToken.token_expires_at);
  const isExpired = expiresAt <= now;

  logger.info("[REACTIVATE] Token status:", {
    expires_at: expiresAt,
    now: now,
    is_expired: isExpired,
    has_refresh_token: !!broadcasterToken.refresh_token,
  });

  if (!isExpired) {
    return;
  }

  logger.info(
    "[REACTIVATE] Token expired, attempting renewal with refresh_token..."
  );

  if (!broadcasterToken.refresh_token) {
    throw new AppError("Token expired and no refresh_token available", 400);
  }

  try {
    const {
      refreshAccessToken,
    } = require("../services/kickAutoSubscribe.service");
    logger.info("[REACTIVATE] Attempting token renewal...");

    const renewed = await refreshAccessToken(broadcasterToken);

    if (!renewed) {
      throw new AppError("Could not renew expired token", 400);
    }

    logger.info("[REACTIVATE] Token renewed successfully");
    await broadcasterToken.reload();
  } catch (refreshError) {
    logger.error("[REACTIVATE] Error renewing token:", refreshError.message);
    throw new AppError("Error renewing token: " + refreshError.message, 400);
  }
}

/**
 * REACTIVATE: Main broadcaster token
 */
exports.reactivateBroadcasterToken = asyncHandler(async (req, res) => {
  try {
    const { KickBroadcasterToken } = require("../models");
    const {
      autoSubscribeToEvents,
    } = require("../services/kickAutoSubscribe.service");
    const config = require("../../config");

    logger.info("[REACTIVATE] Looking for main broadcaster token...");

    const broadcasterToken = await KickBroadcasterToken.findOne({
      where: { kick_user_id: config.kick.broadcasterId },
    });

    if (!broadcasterToken) {
      throw new AppError("Main broadcaster token not found", 404);
    }

    logger.info("[REACTIVATE] Token found, checking expiration...");

    await renewBroadcasterTokenIfNeeded(broadcasterToken);

    logger.info("[REACTIVATE] Reactivating token...");

    // Reactivate token
    await broadcasterToken.update({
      is_active: true,
      auto_subscribed: false,
      subscription_error: null,
    });

    logger.info(
      "[REACTIVATE] Attempting auto-subscription with broadcaster token..."
    );

    // Attempt auto-subscription using ITS own token
    try {
      const autoSubscribeResult = await autoSubscribeToEvents(
        broadcasterToken.access_token,
        config.kick.broadcasterId,
        config.kick.broadcasterId
      );

      await broadcasterToken.update({
        auto_subscribed: autoSubscribeResult.success,
        last_subscription_attempt: new Date(),
        subscription_error: autoSubscribeResult.success
          ? null
          : JSON.stringify(autoSubscribeResult.error),
      });

      logger.info(
        "[REACTIVATE] Subscription result:",
        autoSubscribeResult.success ? "SUCCESS" : "FAILURE"
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
          ? "Token reactivated and subscriptions created. Webhooks should work!"
          : "Token reactivated but subscription failed",
        next_step: autoSubscribeResult.success
          ? "Test by sending a message in Luisardito's chat"
          : "Check subscription error logs",
      });
    } catch (subscribeError) {
      logger.error("[REACTIVATE] Subscription error:", subscribeError.message);

      await broadcasterToken.update({
        auto_subscribed: false,
        subscription_error: subscribeError.message,
      });

      res.json({
        success: true,
        token_reactivated: true,
        auto_subscribed: false,
        error: subscribeError.message,
        message: "Token reactivated but subscription failed",
        next_step: "Check error logs",
      });
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[REACTIVATE] General error:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * Simplified webhook system status
 */
exports.systemStatus = asyncHandler(async (req, res) => {
  try {
    const {
      KickBroadcasterToken,
      KickEventSubscription,
    } = require("../models");
    const config = require("../../config");

    // Check main broadcaster
    const broadcasterToken = await KickBroadcasterToken.findOne({
      where: {
        kick_user_id: config.kick.broadcasterId,
        is_active: true,
      },
    });

    // Count active subscriptions
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
        ? "Webhook system operational"
        : "System needs configuration",
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[System Status] Error:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * Save a single subscription from Kick API response and return a debug result entry.
 */
async function saveSubscriptionDebugResult(sub, broadcasterId) {
  if (!sub.subscription_id || sub.error) {
    return {
      event: sub.name || "UNKNOWN",
      success: false,
      kick_error: sub.error || "No subscription_id in response",
    };
  }

  const { KickEventSubscription } = require("../models");
  const dataToSave = {
    subscription_id: sub.subscription_id,
    broadcaster_user_id: parseInt(broadcasterId),
    event_type: sub.name,
    event_version: sub.version,
    method: "webhook",
    status: "active",
  };

  logger.info("[DEBUG SUB] Data to save:", JSON.stringify(dataToSave, null, 2));

  try {
    const localSub = await KickEventSubscription.findOne({
      where: { subscription_id: sub.subscription_id },
    });

    if (localSub) {
      await localSub.update(dataToSave);
      logger.info("[DEBUG SUB] Update successful for:", sub.name);
      return {
        event: sub.name,
        success: true,
        action: "updated",
        subscription_id: sub.subscription_id,
        db_id: localSub.id,
      };
    }

    const newSubscription = await KickEventSubscription.create(dataToSave);
    logger.info("[DEBUG SUB] Create successful for:", sub.name);
    return {
      event: sub.name,
      success: true,
      action: "created",
      subscription_id: sub.subscription_id,
      db_id: newSubscription.id,
    };
  } catch (dbError) {
    logger.error("[DEBUG SUB] Detailed DB error:", {
      message: dbError.message,
      name: dbError.name,
      errors: dbError.errors,
      sql: dbError.sql,
      stack: dbError.stack,
    });

    return {
      event: sub.name || "UNKNOWN",
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
    };
  }
}

/**
 * DEBUG: Temporary endpoint to debug the subscription process
 */
exports.debugSubscriptionProcess = asyncHandler(async (req, res) => {
  try {
    const {
      KickBroadcasterToken,
      KickEventSubscription,
    } = require("../models");
    const config = require("../../config");
    const axios = require("axios");

    logger.info("[DEBUG SUB] Starting subscription process debugging...");

    // 1. Check active token
    const broadcasterToken = await KickBroadcasterToken.findOne({
      where: {
        kick_user_id: config.kick.broadcasterId,
        is_active: true,
      },
    });

    if (!broadcasterToken) {
      throw new AppError("No active token for main broadcaster", 500);
    }

    logger.info("[DEBUG SUB] Token found for:", broadcasterToken.kick_username);

    // 2. Simulate Kick API call (single event for testing)
    const apiUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;
    const testPayload = {
      broadcaster_user_id: parseInt(config.kick.broadcasterId),
      events: [{ name: "chat.message.sent", version: 1 }],
      method: "webhook",
      webhook_url: "https://api.luisardito.com/api/kick-webhook/events",
    };

    logger.info(
      "[DEBUG SUB] Payload sent to Kick:",
      JSON.stringify(testPayload, null, 2)
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
        "[DEBUG SUB] Kick response:",
        JSON.stringify(kickResponse, null, 2)
      );
    } catch (apiError) {
      logger.error("[DEBUG SUB] Kick API error:", apiError.message);
      throw new AppError("Error communicating with Kick API", 500);
    }

    // 3. Try saving each subscription and capture detailed errors
    const subscriptionsData = kickResponse.data || [];
    const debugResults = [];

    for (const sub of subscriptionsData) {
      logger.info(
        "[DEBUG SUB] Processing subscription:",
        JSON.stringify(sub, null, 2)
      );

      debugResults.push(
        await saveSubscriptionDebugResult(sub, config.kick.broadcasterId)
      );
    }

    // 4. Clean up any subscription created during testing
    await KickEventSubscription.destroy({
      where: {
        broadcaster_user_id: parseInt(config.kick.broadcasterId),
        event_type: "chat.message.sent",
      },
    });
    logger.info("[DEBUG SUB] Cleanup completed");

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
    if (error instanceof AppError) throw error;
    logger.error("[DEBUG SUB] General error:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * DEBUG: Verify KickEventSubscription table structure
 */
exports.debugTableStructure = asyncHandler(async (req, res) => {
  try {
    const { KickEventSubscription } = require("../models");
    const { sequelize } = require("../models/database");

    logger.info("[DEBUG TABLE] Checking table structure...");

    // 1. Describe table directly in DB
    const [tableDescription] = await sequelize.query(
      `DESCRIBE kick_event_subscriptions`
    );

    // 2. Get constraints and indexes
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

    // 3. Check unique indexes
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

    // 4. Check foreign keys
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

    // 5. Test simple insert to capture error
    let insertTestResult = null;
    try {
      // Minimal test data
      const testData = {
        subscription_id: "test_debug_" + Date.now(),
        broadcaster_user_id: 33112734,
        event_type: "chat.message.sent",
        event_version: 1,
        method: "webhook",
        status: "active",
      };

      logger.info("[DEBUG TABLE] Testing insert with data:", testData);

      const testRecord = await KickEventSubscription.create(testData);

      // If it works, delete immediately
      await testRecord.destroy();

      insertTestResult = {
        success: true,
        message: "Test insert successful",
        test_data: testData,
      };
    } catch (insertError) {
      logger.error("[DEBUG TABLE] Test insert error:", insertError);

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
        KickEventSubscription.rawAttributes
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
    if (error instanceof AppError) throw error;
    logger.error("[DEBUG TABLE] General error:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * APP TOKEN: Configure permanent webhooks with App Access Token
 */
exports.setupPermanentWebhooks = asyncHandler(async (req, res) => {
  try {
    const {
      subscribeToEventsWithAppToken,
    } = require("../services/kickAppToken.service");
    const config = require("../../config");

    logger.info(
      "[Setup Permanent] Starting permanent webhooks configuration..."
    );

    const result = await subscribeToEventsWithAppToken(
      config.kick.broadcasterId
    );

    if (result.success) {
      res.json({
        success: true,
        message: "Permanent webhooks configured successfully!",
        permanent: true,
        token_type: "APP_TOKEN",
        no_user_auth_required: true,
        broadcaster_id: config.kick.broadcasterId,
        subscriptions_created: result.totalSubscribed,
        subscriptions_errors: result.totalErrors,
        webhook_url: "https://api.luisardito.com/api/kick-webhook/events",
        benefits: [
          "No user re-authentication required",
          "Works 24/7 without manual intervention",
          "Does not expire every 2 hours",
          "No refresh tokens that expire",
          "Completely autonomous",
        ],
        next_steps: [
          "Webhooks are ready",
          "Test by sending a message in chat",
          "Check server logs",
        ],
      });
    } else {
      throw new AppError("Error configuring permanent webhooks", 500);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Setup Permanent] General error:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * APP TOKEN: Debug and status of permanent webhooks
 */
exports.debugAppTokenWebhooks = asyncHandler(async (req, res) => {
  try {
    const {
      getAppAccessToken,
      checkAppTokenWebhooksStatus,
    } = require("../services/kickAppToken.service");
    const config = require("../../config");

    logger.info("[Debug App Token] Starting permanent webhooks diagnostics...");

    // 1. Test App Token retrieval
    logger.info("[Debug App Token] Testing App Access Token retrieval...");
    const appToken = await getAppAccessToken();

    // 2. Check subscription status
    logger.info("[Debug App Token] Checking subscription status...");
    const webhooksStatus = await checkAppTokenWebhooksStatus(
      config.kick.broadcasterId
    );

    // 3. Check all subscriptions in DB
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
          ? "App Token obtained successfully"
          : "Error obtaining App Token",
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
          (s) => s.app_id === "APP_TOKEN"
        ),
        user_token_subs: allSubscriptions.filter(
          (s) => s.app_id !== "APP_TOKEN"
        ),
        all_subscriptions: allSubscriptions,
      },
      system_assessment: {
        is_permanent: webhooksStatus.is_permanent,
        requires_maintenance: !webhooksStatus.is_permanent,
        user_dependency: webhooksStatus.requires_user_auth,
        recommendation: webhooksStatus.is_permanent
          ? "System running with permanent webhooks"
          : "Recommended to configure permanent webhooks with App Token",
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
    if (error instanceof AppError) throw error;
    logger.error("[Debug App Token] Error:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * APP TOKEN: Comparative status between User Token vs App Token
 */
exports.compareTokenTypes = asyncHandler(async (req, res) => {
  try {
    const {
      checkAppTokenWebhooksStatus,
    } = require("../services/kickAppToken.service");
    const { KickBroadcasterToken } = require("../models");
    const config = require("../../config");

    logger.info("[Compare Tokens] Comparing User Token vs App Token...");

    // Webhooks status
    const webhooksStatus = await checkAppTokenWebhooksStatus(
      config.kick.broadcasterId
    );

    // User Tokens status
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
        t.is_active && t.token_expires_at && new Date(t.token_expires_at) > now
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
        duration: "2 hours (with refresh up to ~30-90 days)",
        webhooks_count: webhooksStatus.user_token_subscriptions,
      },
      app_tokens: {
        total: "N/A (no DB state)",
        active: webhooksStatus.app_token_subscriptions > 0 ? 1 : 0,
        expires: "NEVER (permanent)",
        requires_user_interaction: false,
        maintenance_required: false,
        duration: "PERMANENT (until manual credential change)",
        webhooks_count: webhooksStatus.app_token_subscriptions,
      },
      recommendation: {
        current_status: webhooksStatus.is_permanent
          ? "USING_APP_TOKEN"
          : "USING_USER_TOKEN",
        should_migrate: !webhooksStatus.is_permanent,
        benefits_migration: [
          "Eliminates user dependency",
          "No re-authentication required",
          "Works 24/7 without maintenance",
          "Eliminates token expiration",
          "Fully autonomous system",
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
          ? "Already optimized"
          : "Migrate to App Token",
        action_needed: !webhooksStatus.is_permanent,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Compare Tokens] Error:", error);
    throw new AppError(error.message, 500);
  }
});

// ============================================================================
// DEBUG ENDPOINTS FOR NEW FEATURES
// ============================================================================

/**
 * DEBUG: Simulate Botrix migration
 */
exports.debugBotrixMigration = asyncHandler(async (req, res) => {
  try {
    const { kick_username, points_amount } = req.body;

    if (!kick_username || !points_amount) {
      throw new AppError(
        "Missing parameters: kick_username, points_amount",
        400
      );
    }

    logger.info(
      `[DEBUG BOTRIX] Simulating migration: ${kick_username} with ${points_amount} points`
    );

    // Create simulated BotRix message
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

    // Process with the real service
    const result = await BotrixMigrationService.processChatMessage(mockMessage);

    res.json({
      success: true,
      message: "Migration simulation completed",
      input: { kick_username, points_amount },
      result: result,
      mock_message: mockMessage.content,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[DEBUG BOTRIX] Simulation error:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * DEBUG: VIP configuration and migration info
 */
exports.debugSystemInfo = asyncHandler(async (req, res) => {
  try {
    const { BotrixMigrationConfig } = require("../models");
    const config = await BotrixMigrationConfig.getConfig();

    // Get real migration stats
    const migrationStats = await BotrixMigrationService.getMigrationStats();

    // Get real VIP stats using imported service
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
    if (error instanceof AppError) throw error;
    logger.error("Error getting system info:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * Format a Redis TTL value for display.
 */
function formatTtl(ttl) {
  if (ttl === -1) return "no_expiration";
  if (ttl === -2) return "not_found";
  return `${ttl}s (${Math.floor(ttl / 60)} min)`;
}

/**
 * Calculate minutes since a given timestamp string.
 */
function minutesSince(timestampStr) {
  if (!timestampStr) return null;
  const lastUpdate = new Date(timestampStr);
  const now = new Date();
  return (now - lastUpdate) / 1000 / 60;
}

/**
 * Build stream health warnings based on Redis state.
 */
function buildStreamWarnings(
  isLive,
  ttlIsLive,
  minutesSinceStatus,
  streamInfo
) {
  const warnings = [];

  if (isLive === "true" && ttlIsLive < 3600) {
    warnings.push(`Low TTL: expires in ${Math.floor(ttlIsLive / 60)} minutes`);
  }

  if (isLive === "true" && minutesSinceStatus && minutesSinceStatus > 120) {
    warnings.push(
      `No status updates for ${minutesSinceStatus.toFixed(1)} minutes`
    );
  }

  if (isLive === "true" && !streamInfo) {
    warnings.push("Stream online but no info in Redis");
  }

  if (ttlIsLive === -1) {
    warnings.push("Key without TTL (permanent)");
  }

  return warnings;
}

/**
 * DEBUG: Check stream status
 */
exports.debugStreamStatus = asyncHandler(async (req, res) => {
  try {
    const redis = getRedisClient();

    // Get all stream-related keys
    const isLive = await redis.get("stream:is_live");
    const currentInfo = await redis.get("stream:current_info");
    const lastStatusUpdate = await redis.get("stream:last_status_update");
    const lastMetadataUpdate = await redis.get("stream:last_metadata_update");

    // Get TTL of keys
    const ttlIsLive = await redis.ttl("stream:is_live");
    const ttlCurrentInfo = await redis.ttl("stream:current_info");

    // Parse stream info if exists
    let streamInfo = null;
    if (currentInfo) {
      try {
        streamInfo = JSON.parse(currentInfo);
      } catch (parseError) {
        logger.warn(
          "[Stream Status] Error parsing stream:current_info:",
          parseError.message
        );
      }
    }

    // Calculate time since last updates
    const minutesSinceStatusUpdate = minutesSince(lastStatusUpdate);
    const minutesSinceMetadataUpdate = minutesSince(lastMetadataUpdate);

    // Detect inconsistencies
    const warnings = buildStreamWarnings(
      isLive,
      ttlIsLive,
      minutesSinceStatusUpdate,
      streamInfo
    );

    res.json({
      success: true,
      stream: {
        is_live: isLive === "true",
        redis_value: isLive || "not_set",
        points_enabled: isLive === "true",
        message:
          isLive === "true"
            ? "Stream LIVE - Points activated"
            : "Stream OFFLINE - Points deactivated",
      },
      stream_info: streamInfo,
      redis_metadata: {
        ttl_is_live: formatTtl(ttlIsLive),
        ttl_current_info: formatTtl(ttlCurrentInfo),
        last_status_update: lastStatusUpdate || "never",
        last_metadata_update: lastMetadataUpdate || "never",
        minutes_since_status_update: minutesSinceStatusUpdate
          ? minutesSinceStatusUpdate.toFixed(1)
          : "n/a",
        minutes_since_metadata_update: minutesSinceMetadataUpdate
          ? minutesSinceMetadataUpdate.toFixed(1)
          : "n/a",
      },
      health_check: {
        status: warnings.length === 0 ? "Healthy" : "Warnings",
        warnings: warnings,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Stream Status] Error:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * EMERGENCY: Manually set stream status
 * POST /api/kick-webhook/debug/force-stream-state
 * Body: { "is_live": true/false, "reason": "explanation" }
 */
exports.forceStreamState = asyncHandler(async (req, res) => {
  try {
    const { is_live, reason } = req.body;

    if (typeof is_live !== "boolean") {
      throw new AppError("Parameter is_live must be boolean (true/false)", 400);
    }

    const redis = getRedisClient();
    const previousState = await redis.get("stream:is_live");

    logger.warn(
      "[FORCE STREAM STATE] =========================================="
    );
    logger.warn("[FORCE STREAM STATE] MANUAL STATE CHANGE DETECTED");
    logger.warn(
      `[FORCE STREAM STATE] Previous state: ${previousState || "unknown"}`
    );
    logger.warn(
      `[FORCE STREAM STATE] New state: ${is_live ? "true" : "false"}`
    );
    logger.warn(`[FORCE STREAM STATE] Reason: ${reason || "Not specified"}`);
    logger.warn(`[FORCE STREAM STATE] Timestamp: ${new Date().toISOString()}`);
    logger.warn(
      "[FORCE STREAM STATE] =========================================="
    );

    // Update state with consistent logic: NO TTL if online, WITH TTL if offline
    if (is_live) {
      await redis.set("stream:is_live", "true");
      logger.warn(
        "[FORCE STREAM STATE] State forced to ONLINE (persistent, no TTL)"
      );
    } else {
      await redis.set("stream:is_live", "false");
      await redis.set("stream:last_webhook_status", "offline");
      logger.info(
        "[FORCE STREAM STATE] OFFLINE state confirmed directly by webhook"
      );
    }

    await redis.set(
      "stream:last_status_update",
      new Date().toISOString(),
      "EX",
      86400
    );

    // Mark as manual change
    await redis.set(
      "stream:last_manual_override",
      JSON.stringify({
        previous_state: previousState || "unknown",
        new_state: is_live ? "true" : "false",
        reason: reason || "Not specified",
        timestamp: new Date().toISOString(),
      }),
      "EX",
      86400
    ); // 24 hours

    if (is_live) {
      // If forced online, create basic info (NO TTL)
      const streamInfo = {
        title: "Stream manual override",
        broadcaster: "Manual",
        updated_by: "manual_override",
        last_update: new Date().toISOString(),
      };
      await redis.set("stream:current_info", JSON.stringify(streamInfo));
    } else {
      // If forced offline, clean up info
      await redis.del("stream:current_info");
    }

    res.json({
      success: true,
      message: "Stream state updated manually",
      previous_state: previousState || "unknown",
      new_state: is_live ? "true" : "false",
      reason: reason || "Not specified",
      warning: "This change will be reverted if a Kick webhook arrives",
      ttl_hours: 2,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[FORCE STREAM STATE] Error:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * PUBLIC ENDPOINT: Get public Kick points configuration
 * GET /api/kick/public/points-config
 */
exports.getPublicPointsConfig = asyncHandler(async (req, res) => {
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
    if (error instanceof AppError) throw error;
    logger.error("[Public Points Config] Error:", error.message);
    throw new AppError("Internal server error", 500);
  }
});
