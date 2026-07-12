import * as _models from "../../../models";
const { KickPointsConfig, KickUserTracking, Usuario, HistorialPunto } =
  _models as any;
import NotificacionService from "../../notificacion.service";
import logger from "../../../utils/logger";
import { syncUserProfileIfNeeded } from "../../../utils/usernameSync.util";

interface SubscriptionHandlerConfig {
  logLabel: string;
  configKey: string;
  eventType: string;
  conceptPrefix: string;
  logVerb: string;
  includeUserType: boolean;
  sendNotification: boolean;
}

export async function processSubscriptionEvent(
  payload: any,
  _metadata: any,
  opts: SubscriptionHandlerConfig
) {
  try {
    const subscriber = payload.subscriber;
    const kickUserId = String(subscriber.user_id);
    const kickUsername = subscriber.username;
    const duration = payload.duration;
    const expiresAt = new Date(payload.expires_at);

    logger.info(`[Kick Webhook][${opts.logLabel}]`, {
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
        `[Kick Webhook][${opts.logLabel}] User ${kickUsername} not registered in DB`
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

    // Get points configuration
    const config = await KickPointsConfig.findOne({
      where: {
        config_key: opts.configKey,
        enabled: true,
      },
    });

    const basePoints = config?.config_value || 0;

    // Calculate points considering VIP (TEMPORARY: Disabled)
    const pointsToAward = basePoints; // await VipService.calculatePointsForUser(usuario, 'sub', basePoints);

    if (pointsToAward > 0) {
      // Award points
      await usuario.increment("puntos", { by: pointsToAward });

      const durationStr = `${duration} ${duration === 1 ? "month" : "months"}`;

      // Determine user type
      const userType = "sub"; // usuario.getUserType();

      const concepto = opts.includeUserType
        ? `${opts.conceptPrefix} (${durationStr}) - ${userType}`
        : `${opts.conceptPrefix} (${durationStr})`;

      const kickEventData: any = {
        event_type: opts.eventType,
        kick_user_id: kickUserId,
        kick_username: kickUsername,
        duration,
        expires_at: expiresAt,
      };

      if (opts.includeUserType) {
        kickEventData.user_type = userType;
        kickEventData.is_vip = false; // usuario.isVipActive()
      }

      // Register in history
      await HistorialPunto.create({
        usuario_id: usuario.id,
        puntos: pointsToAward,
        tipo: "ganado",
        concepto,
        kick_event_data: kickEventData,
      });

      // Create notification for subscription points earned
      if (opts.sendNotification) {
        await NotificacionService.crearNotificacionPuntosGanados(usuario.id, {
          cantidad: pointsToAward,
          concepto: `${opts.conceptPrefix} (${durationStr})`,
          tipo_evento: opts.eventType,
          duracion_meses: duration,
        });
      }
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
      `[Kick Webhook][${opts.logLabel}] ${pointsToAward} points awarded to ${kickUsername}, ${opts.logVerb} ${expiresAt}`
    );
  } catch (error) {
    logger.error(`[Kick Webhook][${opts.logLabel}] Error:`, error.message);
  }
}
