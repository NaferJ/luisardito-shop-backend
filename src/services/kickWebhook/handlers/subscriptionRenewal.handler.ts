import * as _models from "../../../models";
const { KickPointsConfig, KickUserTracking, Usuario, HistorialPunto } =
  _models as any;
import logger from "../../../utils/logger";
import { syncUserProfileIfNeeded } from "../../../utils/usernameSync.util";

/**
 * Handle subscription renewals
 */
export async function handleSubscriptionRenewal(payload: any, _metadata: any) {
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
