import {
  KickPointsConfig,
  KickUserTracking,
  Usuario,
  HistorialPunto,
  UserWatchtime,
  sequelize,
  BotrixMigrationConfig,
} from "../../../models";
import BotrixMigrationService from "../../botrixMigration.service";
import * as ModeratorCommandsService from "../../kickModeratorCommands.service";
import { Transaction } from "sequelize";
import { getRedisClient } from "../../../config/redis.config";
import logger from "../../../utils/logger";
import { syncUserProfileIfNeeded } from "../../../utils/usernameSync.util";
import toErrorMessage from "../../../utils/toErrorMessage";

interface KickSender {
  user_id: string | number;
  username: string;
  profile_picture?: string;
  identity?: { badges?: { type: string }[] };
}

interface ChatMessagePayload {
  content: string;
  message_id?: string;
  sender: KickSender;
  broadcaster: { user_id: string; username: string };
  channel?: { username?: string };
}

interface WebhookMetadata {
  [key: string]: unknown;
}

interface BotrixConfigData {
  migration_enabled: boolean;
  watchtime_migration_enabled: boolean;
}

interface SubscriberStatusResult {
  isSubscriber: boolean;
  userTracking: KickUserTracking | null;
}

interface AwardChatPointsContext {
  isVipActive: boolean;
  isSubscriber: boolean;
  payload: ChatMessagePayload;
  kickUserId: string;
  kickUsername: string;
}

/**
 * Process Botrix migration (points + watchtime) for a chat message.
 * Returns true if the message was fully consumed by migration.
 */
async function processBotrixMigration(
  payload: ChatMessagePayload,
  botrixConfig: BotrixConfigData
): Promise<boolean> {
  if (botrixConfig.migration_enabled) {
    const botrixResult =
      await BotrixMigrationService.processChatMessage(payload);

    if (botrixResult.processed) {
      logger.info(
        `[BOTRIX] Points migration processed: ${JSON.stringify(botrixResult.details)}`
      );
      return true;
    }
    logger.info(`[BOTRIX] Points not processed: ${botrixResult.reason}`);
  }

  if (botrixConfig.watchtime_migration_enabled) {
    const watchtimeResult =
      await BotrixMigrationService.processWatchtimeMessage(payload);

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
async function processModeratorCommands(
  payload: ChatMessagePayload
): Promise<boolean> {
  try {
    const content = String(payload.content || "").trim();
    const modCommands = ["!addcmd", "!editcmd", "!delcmd", "!cmdinfo"];

    if (!modCommands.some((cmd) => content.startsWith(cmd))) {
      return false;
    }

    const modResult = await ModeratorCommandsService.processModeratorCommand(
      payload as never
    );

    if (!modResult.processed) {
      return false;
    }

    logger.info(
      `[MOD-CMD] Moderator command processed: ${content.split(/\s+/)[0]}`
    );

    if (modResult.message) {
      try {
        const bot = (await import("../../kickBot.service")).default;
        await bot.sendMessage(modResult.message);
        logger.info(`[MOD-CMD] Response sent to chat: ${modResult.message}`);
      } catch (botError: unknown) {
        logger.error(
          `[MOD-CMD] Error sending response to chat:`,
          toErrorMessage(botError)
        );
      }
    }

    return true;
  } catch (modErr: unknown) {
    logger.error(
      "[MOD-CMD] Error handling moderator commands:",
      toErrorMessage(modErr)
    );
    return false;
  }
}

/**
 * Process bot commands from chat.
 */
async function processBotCommands(
  payload: ChatMessagePayload,
  kickUserId: string,
  kickUsername: string
): Promise<void> {
  try {
    const content = String(payload.content || "").trim();
    if (!content.startsWith("!")) {
      return;
    }

    const bot = (await import("../../kickBot.service")).default;
    const commandHandler = (await import("../../kickBotCommandHandler.service"))
      .default;

    const commandProcessed = await commandHandler.processMessage(
      content,
      kickUserId,
      payload.channel?.username || "luisardito",
      bot,
      {
        messageContext: null,
        platform: "kick",
        discordUserId: null,
        displayName: kickUsername,
      }
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
  } catch (cmdErr: unknown) {
    logger.error(
      "[Chat Command] Error handling commands:",
      toErrorMessage(cmdErr)
    );
  }
}

/**
 * Check if stream is live via Redis. Returns true if live (or on Redis error, assumes live).
 */
async function isStreamLive(): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const isLive = await redis.get("stream:is_live");

    return isLive === "true";
  } catch (redisError: unknown) {
    logger.error(`[STREAM] Error checking status:`, toErrorMessage(redisError));
    logger.info(`[STREAM] Assuming LIVE due to Redis error`);
    return true;
  }
}

/**
 * Process watchtime tracking for a user on every chat message.
 */
async function processWatchtime(
  kickUserId: string,
  usuarioId: number
): Promise<void> {
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
  } catch (watchtimeError: unknown) {
    logger.error(`[WATCHTIME] Error:`, toErrorMessage(watchtimeError));
  }
}

/**
 * Resolve subscriber status for a Kick user, deactivating expired subscriptions.
 */
async function resolveSubscriberStatus(
  kickUserId: string,
  kickUsername: string
): Promise<SubscriberStatusResult> {
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
  } catch (e: unknown) {
    logger.error(
      "[CHAT] Error deactivating expired subscription:",
      toErrorMessage(e)
    );
  }

  return { isSubscriber: false, userTracking };
}

/**
 * Award chat points to a user within a DB transaction.
 */
async function awardChatPoints(
  usuario: Usuario,
  pointsToAward: number,
  userType: string,
  ctx: AwardChatPointsContext
): Promise<void> {
  const { isVipActive, isSubscriber, payload, kickUserId, kickUsername } = ctx;
  const COOLDOWN_MS = 5 * 60 * 1000;
  const cooldownKey = `chat_cooldown:${kickUserId}`;
  const now = new Date();

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
      logger.info(`[REDIS COOLDOWN] ${kickUsername} BLOCKED - active cooldown`);
      return;
    }
  } catch (redisError: unknown) {
    logger.error(`[REDIS COOLDOWN] Redis error:`, toErrorMessage(redisError));
  }

  const transaction = await sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
  });

  try {
    await usuario.increment("puntos", { by: pointsToAward, transaction });

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
  } catch (transactionError: unknown) {
    await transaction.rollback();
    logger.error(
      `[Chat Message] Transaction error for ${kickUsername}:`,
      toErrorMessage(transactionError)
    );

    try {
      const redis = getRedisClient();
      await redis.del(cooldownKey);
    } catch (redisCleanupError: unknown) {
      logger.error(
        `[REDIS COOLDOWN] Error cleaning cooldown:`,
        toErrorMessage(redisCleanupError)
      );
    }

    throw transactionError;
  }
}

/**
 * Handle chat messages
 */
async function handleChatMessage(
  payload: ChatMessagePayload,
  _metadata: WebhookMetadata
): Promise<void> {
  try {
    const sender = payload.sender;
    const kickUserId = String(sender.user_id);
    const kickUsername = sender.username;

    // PRIORITY 1: Check if it's a Botrix migration
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
      sender.profile_picture ?? null
    );

    // WATCHTIME: Processed on EVERY message (live stream + registered user)
    await processWatchtime(kickUserId, usuario.id);

    // Get points configuration
    const configs = await KickPointsConfig.findAll({
      where: { enabled: true },
    });

    const configMap: Record<string, number> = {};
    configs.forEach((c) => {
      configMap[c.config_key] = c.config_value;
    });

    // Determine if subscriber (validating expiration)
    const { isSubscriber } = await resolveSubscriberStatus(
      kickUserId,
      kickUsername
    );

    const now = new Date();
    const basePoints = isSubscriber
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

    if (pointsToAward <= 0) {
      return;
    }

    // AWARD POINTS (only if passed Redis cooldown)
    await awardChatPoints(usuario, pointsToAward, userType, {
      isVipActive,
      isSubscriber,
      payload,
      kickUserId,
      kickUsername,
    });
  } catch (error: unknown) {
    logger.error("[Chat Message] Error:", toErrorMessage(error));
  }
}

export { handleChatMessage };
