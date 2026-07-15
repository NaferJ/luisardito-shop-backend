/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import _models from "../../../models";
const { KickPointsConfig, KickUserTracking, Usuario, HistorialPunto } = _models;
import NotificacionService from "../../notificacion.service";
import logger from "../../../utils/logger";
import { syncUserProfileIfNeeded } from "../../../utils/usernameSync.util";

/**
 * Handle new followers
 */
async function handleChannelFollowed(payload: any, _metadata: any) {
  try {
    const follower = payload.follower;
    const kickUserId = String(follower.user_id);
    const kickUsername = follower.username;

    logger.info("[Kick Webhook][Channel Followed]", {
      broadcaster: payload.broadcaster.username,
      follower: kickUsername,
    });

    // Check if user exists in our DB
    const usuario: any = await Usuario.findOne({
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
    const userTracking: any = await KickUserTracking.findOne({
      where: { kick_user_id: kickUserId },
    });

    if (userTracking?.follow_points_awarded) {
      logger.info(
        `[Kick Webhook][Channel Followed] User ${kickUsername} already received follow points previously`
      );
      return;
    }

    // Get follow points configuration
    const config: any = await KickPointsConfig.findOne({
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
      await KickUserTracking.create({
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

export { handleChannelFollowed };
