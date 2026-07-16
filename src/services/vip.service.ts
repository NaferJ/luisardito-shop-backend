/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass
import {
  Usuario,
  Canje,
  HistorialPunto,
  BotrixMigrationConfig,
} from "../models";
import { sequelize } from "../models/database";
import { Op } from "sequelize";
import logger from "../utils/logger";

class VipService {
  /**
   * Grant VIP to a user based on a redemption
   * @param {number} canjeId - Redemption ID
   * @param {number} usuarioId - User ID
   * @param {Object} vipConfig - VIP configuration (duration, etc.)
   */
  static async grantVipFromCanje(
    canjeId: any,
    usuarioId: any,
    vipConfig: any = {}
  ) {
    const transaction = await sequelize.transaction();

    try {
      const usuario: any = await Usuario.findByPk(usuarioId);
      if (!usuario) {
        throw new Error("User not found");
      }

      const canje: any = await Canje.findByPk(canjeId);
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
    } catch (error: any) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Remove VIP from a user
   * @param {number} usuarioId - User ID
   * @param {string} reason - Reason for removing VIP
   */
  static async removeVip(usuarioId: any, reason: any = "Manual") {
    const transaction = await sequelize.transaction();

    try {
      const usuario: any = await Usuario.findByPk(usuarioId);
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
    } catch (error: any) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Check and clean up expired VIPs
   */
  static async cleanupExpiredVips() {
    const expiredVips: any = await Usuario.findAll({
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
      } catch (error: any) {
        logger.error(
          `[VIP CLEANUP] Error removing expired VIP for user ${user.id}:`,
          error
        );
      }
    }

    logger.info(`[VIP CLEANUP] ${cleanedCount} expired VIPs removed`);
    return { cleaned_count: cleanedCount, total_expired: expiredVips.length };
  }

  /**
   * Get VIP points configuration
   */
  static async getVipPointsConfig() {
    const config: any = await BotrixMigrationConfig.getConfig();
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
  static async updateVipPointsConfig(newConfig: any) {
    const config: any = await BotrixMigrationConfig.getConfig();
    const updateData: any = {};

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
   * @param {Object} usuario - User
   * @param {string} eventType - Event type ('chat', 'follow', 'sub')
   * @param {number} defaultPoints - Default points
   */
  static async calculatePointsForUser(
    usuario: any,
    eventType: any,
    defaultPoints: any
  ) {
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
