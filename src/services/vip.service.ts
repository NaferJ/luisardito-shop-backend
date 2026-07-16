import {
  Usuario,
  Canje,
  HistorialPunto,
  BotrixMigrationConfig,
} from "../models";
import { sequelize } from "../models/database";
import { Op } from "sequelize";
import logger from "../utils/logger";

interface VipConfig {
  duration_days?: number;
}

interface VipPointsConfig {
  vip_points_enabled: boolean;
  vip_chat_points: number;
  vip_follow_points: number;
  vip_sub_points: number;
}

class VipService {
  /**
   * Grant VIP to a user based on a redemption
   * @param canjeId - Redemption ID
   * @param usuarioId - User ID
   * @param vipConfig - VIP configuration (duration, etc.)
   */
  static async grantVipFromCanje(
    canjeId: number,
    usuarioId: number,
    vipConfig: VipConfig = {}
  ) {
    const transaction = await sequelize.transaction();

    try {
      const usuario = await Usuario.findByPk(usuarioId);
      if (!usuario) {
        throw new Error("User not found");
      }

      const canje = await Canje.findByPk(canjeId);
      if (!canje) {
        throw new Error("Redemption not found");
      }

      // Calculate expiration date
      let vipExpiresAt = null;
      if (vipConfig.duration_days && vipConfig.duration_days > 0) {
        vipExpiresAt = new Date();
        vipExpiresAt.setDate(vipExpiresAt.getDate() + vipConfig.duration_days);
      }
      // If no duration specified, it is permanent (null)

      // Update user as VIP
      await usuario.update(
        {
          is_vip: true,
          vip_granted_at: new Date(),
          vip_expires_at: vipExpiresAt,
          vip_granted_by_canje_id: canjeId,
        },
        { transaction }
      );

      // Create history entry
      await HistorialPunto.create(
        {
          usuario_id: usuarioId,
          puntos: 0, // No points awarded, only the event is logged
          tipo: "ajuste", // Use 'ajuste' which is valid in the ENUM
          concepto: "VIP granted",
          motivo: `VIP granted by redemption #${canjeId}${
            vipExpiresAt
              ? ` (expires: ${vipExpiresAt.toLocaleDateString()})`
              : " (permanent)"
          }`,
          kick_event_data: {
            event_type: "vip_granted",
            canje_id: canjeId,
            expires_at: vipExpiresAt,
            granted_at: new Date().toISOString(),
          },
        },
        { transaction }
      );

      await transaction.commit();

      logger.info(
        `[VIP] VIP granted to ${usuario.nickname} by redemption #${canjeId}`
      );
      return {
        usuario_id: usuarioId,
        nickname: usuario.nickname,
        canje_id: canjeId,
        vip_granted_at: new Date(),
        vip_expires_at: vipExpiresAt,
        is_permanent: !vipExpiresAt,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Remove VIP from a user
   * @param usuarioId - User ID
   * @param reason - Reason for removing VIP
   */
  static async removeVip(usuarioId: number, reason: string = "Manual") {
    const transaction = await sequelize.transaction();

    try {
      const usuario = await Usuario.findByPk(usuarioId);
      if (!usuario) {
        throw new Error("User not found");
      }

      if (!usuario.is_vip) {
        throw new Error("User is not VIP");
      }

      // Remove VIP
      await usuario.update(
        {
          is_vip: false,
          vip_granted_at: null,
          vip_expires_at: null,
          vip_granted_by_canje_id: null,
        },
        { transaction }
      );

      // Create history entry
      await HistorialPunto.create(
        {
          usuario_id: usuarioId,
          puntos: 0,
          tipo: "ajuste", // Use 'ajuste' which is valid in the ENUM
          concepto: "VIP removed",
          motivo: `VIP removed: ${reason}`,
          kick_event_data: {
            event_type: "vip_removed",
            reason: reason,
            removed_at: new Date().toISOString(),
          },
        },
        { transaction }
      );

      await transaction.commit();

      logger.info(
        `[VIP] VIP removed from ${usuario.nickname} - Reason: ${reason}`
      );
      return {
        usuario_id: usuarioId,
        nickname: usuario.nickname,
        reason: reason,
        removed_at: new Date(),
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Check and clean up expired VIPs
   */
  static async cleanupExpiredVips() {
    const expiredVips = await Usuario.findAll({
      where: {
        is_vip: true,
        vip_expires_at: {
          [Op.lt]: new Date(),
        },
      },
    });

    let cleanedCount = 0;
    for (const user of expiredVips) {
      try {
        await this.removeVip(user.id, "Automatic expiration");
        cleanedCount++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(
          `[VIP CLEANUP] Error removing expired VIP for user ${user.id}:`,
          msg
        );
      }
    }

    logger.info(`[VIP CLEANUP] ${cleanedCount} expired VIPs removed`);
    return { cleaned_count: cleanedCount, total_expired: expiredVips.length };
  }

  /**
   * Get VIP points configuration
   */
  static async getVipPointsConfig(): Promise<VipPointsConfig> {
    const config = await BotrixMigrationConfig.getConfig();
    return {
      vip_points_enabled: config.vip_points_enabled,
      vip_chat_points: config.vip_chat_points,
      vip_follow_points: config.vip_follow_points,
      vip_sub_points: config.vip_sub_points,
    };
  }

  /**
   * Update VIP points configuration
   */
  static async updateVipPointsConfig(
    newConfig: Partial<VipPointsConfig>
  ): Promise<BotrixMigrationConfig> {
    const config = await BotrixMigrationConfig.findByPk(1);
    if (!config) {
      throw new Error("Botrix migration config not found");
    }
    const updateData: Record<string, boolean | number> = {};

    if (typeof newConfig.vip_points_enabled === "boolean") {
      updateData.vip_points_enabled = newConfig.vip_points_enabled;
    }
    if (typeof newConfig.vip_chat_points === "number") {
      updateData.vip_chat_points = newConfig.vip_chat_points;
    }
    if (typeof newConfig.vip_follow_points === "number") {
      updateData.vip_follow_points = newConfig.vip_follow_points;
    }
    if (typeof newConfig.vip_sub_points === "number") {
      updateData.vip_sub_points = newConfig.vip_sub_points;
    }

    await config.update(updateData);
    return config;
  }

  /**
   * Calculate points based on user type
   * @param usuario - User
   * @param eventType - Event type ('chat', 'follow', 'sub')
   * @param defaultPoints - Default points
   */
  static async calculatePointsForUser(
    usuario: Usuario,
    eventType: "chat" | "follow" | "sub",
    defaultPoints: number
  ): Promise<number> {
    const config = await this.getVipPointsConfig();

    if (!config.vip_points_enabled || !usuario.isVipActive()) {
      return defaultPoints;
    }

    switch (eventType) {
      case "chat":
        return config.vip_chat_points;
      case "follow":
        return config.vip_follow_points;
      case "sub":
        return config.vip_sub_points;
      default:
        return defaultPoints;
    }
  }

  /**
   * Get VIP statistics
   */
  static async getVipStats() {
    const totalVips = await Usuario.count({ where: { is_vip: true } });
    const permanentVips = await Usuario.count({
      where: {
        is_vip: true,
        vip_expires_at: null,
      },
    });
    const temporaryVips = totalVips - permanentVips;

    const expiredVips = await Usuario.count({
      where: {
        is_vip: true,
        vip_expires_at: {
          [Op.lt]: new Date(),
        },
      },
    });

    return {
      total_vips: totalVips,
      permanent_vips: permanentVips,
      temporary_vips: temporaryVips,
      expired_vips: expiredVips,
      active_vips: totalVips - expiredVips,
    };
  }
}

export default VipService;
