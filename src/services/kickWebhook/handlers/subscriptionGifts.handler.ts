import {
  KickPointsConfig,
  KickUserTracking,
  Usuario,
  HistorialPunto,
} from "../../../models";
import NotificacionService from "../../notificacion.service";
import logger from "../../../utils/logger";
import { syncUserProfileIfNeeded } from "../../../utils/usernameSync.util";

interface KickUser {
  user_id: string | number;
  username: string;
  profile_picture?: string;
  is_anonymous?: boolean;
}

interface SubscriptionGiftsPayload {
  gifter: KickUser;
  giftees: KickUser[];
  broadcaster: { username: string };
  expires_at: string;
}

interface WebhookMetadata {
  [key: string]: unknown;
}

/**
 * Award points to the gifter of subscription gifts.
 */
async function awardGifterPoints(
  gifter: KickUser,
  giftees: KickUser[],
  pointsForGifter: number
): Promise<void> {
  const gifterKickUserId = String(gifter.user_id);
  const gifterUsuario = await Usuario.findOne({
    where: { user_id_ext: gifterKickUserId },
  });

  if (!gifterUsuario) {
    return;
  }

  await syncUserProfileIfNeeded(
    gifterUsuario,
    gifter.username,
    gifterKickUserId,
    true,
    gifter.profile_picture ?? null
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
    ) as unknown as number,
  });

  logger.info(
    `[Kick Webhook][Subscription Gifts] ${totalPoints} points to ${gifter.username} for gifting ${giftees.length} subs`
  );
}

/**
 * Award points to a single giftee of a subscription gift.
 */
async function awardGifteePoints(
  giftee: KickUser,
  gifter: KickUser,
  pointsForGiftee: number,
  expiresAt: Date
): Promise<void> {
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
    giftee.profile_picture ?? null
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
    ) as unknown as number,
    total_subscriptions: KickUserTracking.sequelize.literal(
      "total_subscriptions + 1"
    ) as unknown as number,
  });

  logger.info(
    "[Subscription Gifts]",
    pointsForGiftee,
    "points to",
    gifteeUsername,
    "for receiving gifted sub"
  );
}

/**
 * Handle subscription gifts
 */
async function handleSubscriptionGifts(
  payload: SubscriptionGiftsPayload,
  _metadata: WebhookMetadata
): Promise<void> {
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

    const configMap: Record<string, number> = {};
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[Kick Webhook][Subscription Gifts] Error:", msg);
  }
}

export { handleSubscriptionGifts };
