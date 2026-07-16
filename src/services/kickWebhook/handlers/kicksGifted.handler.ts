import {
  KickPointsConfig,
  KickUserTracking,
  Usuario,
  HistorialPunto,
  sequelize,
} from "../../../models";
import NotificacionService from "../../notificacion.service";
import { Transaction } from "sequelize";
import logger from "../../../utils/logger";
import { syncUserProfileIfNeeded } from "../../../utils/usernameSync.util";

interface KickSender {
  user_id: string | number;
  username: string;
  profile_picture?: string;
}

interface KickGift {
  amount: number;
  name: string;
  tier: string;
  message?: string;
}

interface KicksGiftedPayload {
  sender: KickSender;
  broadcaster: { username: string };
  gift?: KickGift;
  created_at?: string;
}

interface WebhookMetadata {
  [key: string]: unknown;
}

/**
 * Handle kicks gifts (kicks.gifted)
 * Awards points equivalent to the amount of kicks gifted
 */
async function handleKicksGifted(
  payload: KicksGiftedPayload,
  _metadata: WebhookMetadata
): Promise<void> {
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
      sender.profile_picture ?? null
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
      await usuario.increment("puntos", { by: pointsToAward, transaction });

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
          ) as unknown as number,
        },
        { transaction }
      );

      await transaction.commit();

      logger.info(
        `[Kick Webhook][Kicks Gifted] ${pointsToAward} points awarded to ${kickUsername} for gifting ${kickAmount} kicks`
      );
    } catch (transactionError: unknown) {
      await transaction.rollback();
      const msg =
        transactionError instanceof Error
          ? transactionError.message
          : String(transactionError);
      logger.error(
        `[Kick Webhook][Kicks Gifted] Transaction error for ${kickUsername}:`,
        msg
      );
      throw transactionError;
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[Kick Webhook][Kicks Gifted] Error:", msg);
  }
}

export { handleKicksGifted };
