import * as _models from "../../../models";
const { KickPointsConfig, KickUserTracking, Usuario, HistorialPunto } =
  _models as any;
import NotificacionService from "../../notificacion.service";
import logger from "../../../utils/logger";
import { syncUserProfileIfNeeded } from "../../../utils/usernameSync.util";

/**
 * Handle new subscriptions
 */
export async function handleNewSubscription(payload: any, _metadata: any) {
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
