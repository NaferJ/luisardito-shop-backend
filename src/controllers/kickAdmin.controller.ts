/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass
import {
  Usuario,
  Canje,
  Producto,
  BotrixMigrationConfig,
  KickBotToken,
  sequelize,
  KickUserTracking,
  DiscordUserLink,
} from "../models";
import BotrixMigrationService from "../services/botrixMigration.service";
import KickBotService from "../services/kickBot.service";
import { Op } from "sequelize";
import logger from "../utils/logger";

/**
 * Helper to enrich user info with Discord data
 * @param {Object} user - Usuario model instance
 * @returns {Object} Enriched Discord info
 */
async function enrichUserWithDiscordInfo(user: any) {
  let discordInfo = null;
  const discordLink: any = await DiscordUserLink.findOne({
    where: { tienda_user_id: user.id },
  });

  if (discordLink) {
    discordInfo = {
      linked: true,
      id: discordLink.discord_user_id,
      username: discordLink.discord_username,
      discriminator: discordLink.discord_discriminator,
      avatar: discordLink.discord_avatar,
      linked_at: discordLink.createdAt,
      display_name:
        discordLink.discord_discriminator &&
        discordLink.discord_discriminator !== "0"
          ? `${discordLink.discord_username}#${discordLink.discord_discriminator}`
          : discordLink.discord_username,
    };
  }

  return {
    discord_info: discordInfo,
    display_name: discordInfo?.display_name || user.nickname,
  };
}

/**
 * Get migration and VIP configuration
 */
const getConfig = async (req: any, res: any) => {
  try {
    const config: any = await BotrixMigrationConfig.getConfig();

    // Get real point migration stats
    const migrationStats = await Usuario.findAll({
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "migrated_users"],
        [
          sequelize.fn("SUM", sequelize.col("botrix_points_migrated")),
          "total_points_migrated",
        ],
      ],
      where: {
        botrix_migrated: true,
        botrix_points_migrated: { [Op.gt]: 0 },
      },
      raw: true,
    });

    // Get real watchtime migration stats
    const watchtimeMigrationStats = await Usuario.findAll({
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "migrated_users"],
        [
          sequelize.fn(
            "SUM",
            sequelize.col("botrix_watchtime_minutes_migrated")
          ),
          "total_minutes_migrated",
        ],
      ],
      where: {
        botrix_watchtime_migrated: true,
        botrix_watchtime_minutes_migrated: { [Op.gt]: 0 },
      },
      raw: true,
    });

    // Get real VIP stats
    const now = new Date();

    const activeVips = await Usuario.count({
      where: {
        is_vip: true,
        [Op.or]: [
          { vip_expires_at: null }, // Permanent VIP
          { vip_expires_at: { [Op.gt]: now } }, // Non-expired VIP
        ],
      },
    });

    const expiredVips = await Usuario.count({
      where: {
        is_vip: true,
        vip_expires_at: { [Op.lt]: now }, // Expired VIP
      },
    });

    logger.debug("[KICK ADMIN DEBUG] Calculated stats:", {
      migration: migrationStats[0],
      watchtimeMigration: watchtimeMigrationStats[0],
      vip: { activeVips, expiredVips },
    });

    res.json({
      success: true,
      migration: {
        enabled: config.migration_enabled,
        stats: {
          migrated_users: Number.parseInt(
            migrationStats[0]?.migrated_users || 0
          ),
          total_points_migrated: Number.parseInt(
            migrationStats[0]?.total_points_migrated || 0
          ),
        },
      },
      watchtime_migration: {
        enabled: config.watchtime_migration_enabled,
        stats: {
          migrated_users: Number.parseInt(
            watchtimeMigrationStats[0]?.migrated_users || 0
          ),
          total_minutes_migrated: Number.parseInt(
            watchtimeMigrationStats[0]?.total_minutes_migrated || 0
          ),
        },
      },
      vip: {
        points_enabled: config.vip_points_enabled,
        chat_points: config.vip_chat_points,
        follow_points: config.vip_follow_points,
        sub_points: config.vip_sub_points,
        stats: {
          active_vips: activeVips,
          expired_vips: expiredVips,
        },
      },
    });
  } catch (error: any) {
    logger.error("[KICK ADMIN DEBUG] Error fetching configuration:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Update migration configuration
 */
const updateMigrationConfig = async (req: any, res: any) => {
  try {
    logger.debug("[KICK ADMIN DEBUG] Data received in migration config:", {
      body: req.body,
      bodyKeys: Object.keys(req.body),
      migration_enabled_value: req.body.migration_enabled,
      migration_enabled_type: typeof req.body.migration_enabled,
      headers: {
        "content-type": req.headers["content-type"],
        "user-agent": req.headers["user-agent"],
      },
    });

    const { migration_enabled } = req.body;

    // More flexible validation to handle "true"/"false" strings
    let booleanValue: any;

    if (typeof migration_enabled === "boolean") {
      booleanValue = migration_enabled;
    } else if (typeof migration_enabled === "string") {
      if (migration_enabled.toLowerCase() === "true") {
        booleanValue = true;
      } else if (migration_enabled.toLowerCase() === "false") {
        booleanValue = false;
      } else {
        logger.debug(
          "[KICK ADMIN DEBUG] Invalid string value:",
          migration_enabled
        );
        return res.status(400).json({
          success: false,
          error: 'migration_enabled must be a boolean or "true"/"false"',
        });
      }
    } else {
      logger.debug(
        "[KICK ADMIN DEBUG] Invalid type:",
        typeof migration_enabled,
        "value:",
        migration_enabled
      );
      return res.status(400).json({
        success: false,
        error: "migration_enabled must be a boolean",
      });
    }

    logger.debug("[KICK ADMIN DEBUG] Processed value:", booleanValue);

    await BotrixMigrationConfig.setConfig("migration_enabled", booleanValue);

    res.json({
      success: true,
      message: `Botrix migration ${booleanValue ? "enabled" : "disabled"}`,
      config: {
        migration_enabled: booleanValue,
      },
    });
  } catch (error: any) {
    logger.error(
      "[KICK ADMIN DEBUG] Error updating migration configuration:",
      error
    );
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Update VIP points configuration
 */
const updateVipConfig = async (req: any, res: any) => {
  try {
    logger.debug("[KICK ADMIN DEBUG] Data received in VIP config:", {
      body: req.body,
      bodyKeys: Object.keys(req.body),
      types: {
        vip_points_enabled: typeof req.body.vip_points_enabled,
        vip_chat_points: typeof req.body.vip_chat_points,
        vip_follow_points: typeof req.body.vip_follow_points,
        vip_sub_points: typeof req.body.vip_sub_points,
      },
    });

    const {
      vip_points_enabled,
      vip_chat_points,
      vip_follow_points,
      vip_sub_points,
    } = req.body;

    const updateData: any = {};

    // Validate and convert vip_points_enabled
    if (vip_points_enabled !== undefined) {
      if (typeof vip_points_enabled === "boolean") {
        updateData.vip_points_enabled = vip_points_enabled;
      } else if (typeof vip_points_enabled === "string") {
        if (vip_points_enabled.toLowerCase() === "true") {
          updateData.vip_points_enabled = true;
        } else if (vip_points_enabled.toLowerCase() === "false") {
          updateData.vip_points_enabled = false;
        } else {
          return res.status(400).json({
            success: false,
            error: "vip_points_enabled must be a boolean",
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          error: "vip_points_enabled must be a boolean",
        });
      }
    }

    // Validate and convert numbers
    if (vip_chat_points !== undefined) {
      const num = Number(vip_chat_points);
      if (Number.isNaN(num) || num < 0) {
        return res.status(400).json({
          success: false,
          error: "vip_chat_points must be a non-negative number",
        });
      }
      updateData.vip_chat_points = num;
    }

    if (vip_follow_points !== undefined) {
      const num = Number(vip_follow_points);
      if (Number.isNaN(num) || num < 0) {
        return res.status(400).json({
          success: false,
          error: "vip_follow_points must be a non-negative number",
        });
      }
      updateData.vip_follow_points = num;
    }

    if (vip_sub_points !== undefined) {
      const num = Number(vip_sub_points);
      if (Number.isNaN(num) || num < 0) {
        return res.status(400).json({
          success: false,
          error: "vip_sub_points must be a non-negative number",
        });
      }
      updateData.vip_sub_points = num;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid data provided to update",
      });
    }

    logger.debug("[KICK ADMIN DEBUG] Data to update:", updateData);

    // Update each configuration
    for (const [key, value] of Object.entries(updateData)) {
      await BotrixMigrationConfig.setConfig(key, value);
    }

    res.json({
      success: true,
      message: "VIP configuration updated",
      config: updateData,
    });
  } catch (error: any) {
    logger.error("[KICK ADMIN DEBUG] Error updating VIP configuration:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Update watchtime migration configuration
 */
const updateWatchtimeMigrationConfig = async (req: any, res: any) => {
  try {
    logger.debug(
      "[KICK ADMIN DEBUG] Data received in watchtime migration config:",
      {
        body: req.body,
        bodyKeys: Object.keys(req.body),
        watchtime_migration_enabled_value: req.body.watchtime_migration_enabled,
        watchtime_migration_enabled_type:
          typeof req.body.watchtime_migration_enabled,
      }
    );

    const { watchtime_migration_enabled } = req.body;

    // More flexible validation to handle "true"/"false" strings
    let booleanValue: any;

    if (typeof watchtime_migration_enabled === "boolean") {
      booleanValue = watchtime_migration_enabled;
    } else if (typeof watchtime_migration_enabled === "string") {
      if (watchtime_migration_enabled.toLowerCase() === "true") {
        booleanValue = true;
      } else if (watchtime_migration_enabled.toLowerCase() === "false") {
        booleanValue = false;
      } else {
        logger.debug(
          "[KICK ADMIN DEBUG] Invalid string value:",
          watchtime_migration_enabled
        );
        return res.status(400).json({
          success: false,
          error:
            'watchtime_migration_enabled must be a boolean or "true"/"false"',
        });
      }
    } else {
      logger.debug(
        "[KICK ADMIN DEBUG] Invalid type:",
        typeof watchtime_migration_enabled,
        "value:",
        watchtime_migration_enabled
      );
      return res.status(400).json({
        success: false,
        error: "watchtime_migration_enabled must be a boolean",
      });
    }

    logger.debug("[KICK ADMIN DEBUG] Processed value:", booleanValue);

    await BotrixMigrationConfig.setConfig(
      "watchtime_migration_enabled",
      booleanValue
    );

    res.json({
      success: true,
      message: `Watchtime migration ${booleanValue ? "enabled" : "disabled"}`,
      config: {
        watchtime_migration_enabled: booleanValue,
      },
    });
  } catch (error: any) {
    logger.error(
      "[KICK ADMIN DEBUG] Error updating watchtime migration configuration:",
      error
    );
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Grant VIP from a delivered canje
 */
const grantVipFromCanje = async (req: any, res: any) => {
  try {
    const { canjeId } = req.params;
    const { duration_days } = req.body;

    // Find the canje
    const canje: any = await Canje.findByPk(canjeId, {
      include: [{ model: Usuario }, { model: Producto }],
    });

    if (!canje) {
      return res.status(404).json({
        success: false,
        error: "Canje not found",
      });
    }

    if (canje.estado !== "entregado") {
      return res.status(400).json({
        success: false,
        error: 'The canje must be in "entregado" state to grant VIP',
      });
    }

    // Check if the product grants VIP
    if (!canje.Producto.nombre.toLowerCase().includes("vip")) {
      return res.status(400).json({
        success: false,
        error: "This product does not grant VIP",
      });
    }

    // Calculate expiration date
    let vip_expires_at: any = null;
    if (duration_days && duration_days > 0) {
      vip_expires_at = new Date(
        Date.now() + duration_days * 24 * 60 * 60 * 1000
      );
    }

    // Grant VIP to the user
    await canje.Usuario.update({
      is_vip: true,
      vip_granted_at: new Date(),
      vip_expires_at,
      vip_granted_by_canje_id: canjeId,
    });

    res.json({
      success: true,
      message: "VIP granted successfully",
      user_id: canje.Usuario.id,
      duration: duration_days ? `${duration_days} days` : "Permanent",
    });
  } catch (error: any) {
    logger.error("Error granting VIP from canje:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Grant VIP manually to a user
 */
const grantVipManually = async (req: any, res: any) => {
  try {
    const { usuarioId } = req.params;
    const { duration_days } = req.body;

    // Find the user
    const usuario: any = await Usuario.findByPk(usuarioId);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Check if already an active VIP
    if (
      usuario.is_vip &&
      (!usuario.vip_expires_at || new Date(usuario.vip_expires_at) > new Date())
    ) {
      return res.status(400).json({
        success: false,
        error: "User already has active VIP",
      });
    }

    // Calculate expiration date
    let vip_expires_at: any = null;
    if (duration_days && duration_days > 0) {
      vip_expires_at = new Date(
        Date.now() + duration_days * 24 * 60 * 60 * 1000
      );
    }

    // Grant VIP
    await usuario.update({
      is_vip: true,
      vip_granted_at: new Date(),
      vip_expires_at,
      vip_granted_by_canje_id: null,
    });

    res.json({
      success: true,
      message: "VIP granted successfully",
      user: {
        id: usuario.id,
        nickname: usuario.nickname,
        vip_granted_at: new Date(),
        vip_expires_at,
        duration: duration_days ? `${duration_days} days` : "Permanent",
      },
    });
  } catch (error: any) {
    logger.error("Error granting VIP manually:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Remove VIP from a user
 */
const removeVip = async (req: any, res: any) => {
  try {
    const { usuarioId } = req.params;
    const { reason } = req.body;

    // Find the user
    const usuario: any = await Usuario.findByPk(usuarioId);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (!usuario.is_vip) {
      return res.status(400).json({
        success: false,
        error: "User does not have VIP",
      });
    }

    // Remove VIP
    await usuario.update({
      is_vip: false,
      vip_granted_at: null,
      vip_expires_at: null,
      vip_granted_by_canje_id: null,
    });

    res.json({
      success: true,
      message: "VIP removed successfully",
      user: {
        id: usuario.id,
        nickname: usuario.nickname,
        vip_removed_at: new Date(),
        reason: reason || "Removed manually",
      },
    });
  } catch (error: any) {
    logger.error("Error removing VIP:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Clean up expired VIPs
 */
const cleanupExpiredVips = async (req: any, res: any) => {
  try {
    const now = new Date();

    // Find users with expired VIP
    const expiredVips = await Usuario.findAll({
      where: {
        is_vip: true,
        vip_expires_at: {
          [Op.lt]: now,
        },
      },
    });

    if (expiredVips.length === 0) {
      return res.json({
        success: true,
        message: "No expired VIPs to clean up",
        cleaned: 0,
      });
    }

    // Update expired users
    await Usuario.update(
      {
        is_vip: false,
        vip_granted_at: null,
        vip_expires_at: null,
        vip_granted_by_canje_id: null,
      },
      {
        where: {
          is_vip: true,
          vip_expires_at: {
            [Op.lt]: now,
          },
        },
      }
    );

    res.json({
      success: true,
      message: `${expiredVips.length} expired VIPs cleaned up successfully`,
      cleaned: expiredVips.length,
      users: expiredVips.map((u: any) => ({
        id: u.id,
        nickname: u.nickname,
        expired_at: u.vip_expires_at,
      })),
    });
  } catch (error: any) {
    logger.error("Error cleaning up expired VIPs:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getUsersWithDetails = async (req: any, res: any) => {
  try {
    const { filter = "all" } = req.query;

    const whereClause: any = {};
    switch (filter) {
      case "vip":
        whereClause.is_vip = true;
        break;
      case "migrated":
        whereClause.botrix_migrated = true;
        break;
      case "pending_migration":
        whereClause.botrix_migrated = false;
        break;
    }

    // Calculate the total number of users
    const total = await Usuario.count({ where: whereClause });

    // Get users with canje count
    const usuarios = await Usuario.findAll({
      where: whereClause,
      order: [["actualizado", "DESC"]],
      attributes: [
        "id",
        "nickname",
        "puntos",
        "user_id_ext",
        "discord_username",
        "is_vip",
        "vip_granted_at",
        "vip_expires_at",
        "vip_granted_by_canje_id",
        "botrix_migrated",
        "botrix_migrated_at",
        "botrix_points_migrated",
        "kick_data",
        "creado",
        "actualizado",
        [sequelize.fn("COUNT", sequelize.col("Canjes.id")), "total_canjes"],
        [
          sequelize.fn(
            "COUNT",
            sequelize.literal(
              'CASE WHEN Canjes.estado = "pendiente" THEN 1 END'
            )
          ),
          "canjes_pendientes",
        ],
      ],
      include: [
        {
          model: Canje,
          attributes: [],
        },
      ],
      group: ["Usuario.id"],
    });

    const enrichedUsers = await Promise.all(
      usuarios.map(async (user: any) => {
        const userJson = user.toJSON();

        // Discord info
        const { discord_info, display_name } =
          await enrichUserWithDiscordInfo(user);

        // Calculate subscriber info
        let subscriberStatus = {
          is_active: false,
          expires_soon: false,
        };

        if (userJson.user_id_ext) {
          const userTracking: any = await KickUserTracking.findOne({
            where: { kick_user_id: userJson.user_id_ext },
          });

          if (userTracking?.is_subscribed) {
            const now = new Date();
            const expiresAt = userTracking.subscription_expires_at
              ? new Date(userTracking.subscription_expires_at)
              : null;
            subscriberStatus = {
              is_active: !expiresAt || expiresAt > now,
              expires_soon:
                expiresAt &&
                expiresAt <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            };
          }
        }

        return {
          ...userJson,
          kick_data: userJson.kick_data,
          display_name,
          discord_info,
          vip_status: {
            is_active:
              userJson.is_vip &&
              (!userJson.vip_expires_at ||
                new Date(userJson.vip_expires_at) > new Date()),
            is_permanent: userJson.is_vip && !userJson.vip_expires_at,
            expires_soon:
              userJson.vip_expires_at &&
              new Date(userJson.vip_expires_at) <=
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
          migration_status: {
            can_migrate: !userJson.botrix_migrated,
            points_migrated: userJson.botrix_points_migrated || 0,
          },
          subscriber_status: subscriberStatus,
        };
      })
    );

    res.json({
      success: true,
      users: enrichedUsers,
      total,
    });
  } catch (error: any) {
    logger.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const manualBotrixMigration = async (req: any, res: any) => {
  try {
    const rawUsuarioId =
      req.params?.usuarioId ?? req.body?.usuario_id ?? req.body?.usuarioId;
    const rawPoints =
      req.body?.points ?? req.body?.points_amount ?? req.body?.pointsAmount;

    if (!rawUsuarioId || !rawPoints) {
      return res.status(400).json({
        success: false,
        error: "usuarioId and points are required",
      });
    }

    const usuarioId = Number.parseInt(rawUsuarioId, 10);
    const points = Number.parseInt(rawPoints, 10);

    if (Number.isNaN(usuarioId) || Number.isNaN(points)) {
      return res.status(400).json({
        success: false,
        error: "usuarioId and points must be valid numbers",
      });
    }

    // Find the user
    const usuario: any = await Usuario.findByPk(usuarioId);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Check if already migrated
    if (usuario.botrix_migrated) {
      return res.status(400).json({
        success: false,
        error: "User already has migrated Botrix points",
        details: {
          migrated_at: usuario.botrix_migrated_at,
          points_migrated: usuario.botrix_points_migrated,
        },
      });
    }

    // Perform manual migration using the service
    const result = await BotrixMigrationService.migrateBotrixPoints(
      usuario,
      points,
      usuario.nickname || `Manual-${usuario.id}`
    );

    res.json({
      success: true,
      message: "Manual migration completed successfully",
      migration: result,
    });
  } catch (error: any) {
    logger.error("[KICK ADMIN DEBUG] Error in manual migration:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get Kick bot token status
 */
const getBotTokensStatus = async (req: any, res: any) => {
  try {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    // Get all tokens
    const allTokens = await KickBotToken.findAll({
      order: [["updated_at", "DESC"]],
    });

    // Classify tokens
    const activeTokens = allTokens.filter(
      (token: any) => token.is_active && new Date(token.token_expires_at) > now
    );

    const expiredTokens = allTokens.filter(
      (token: any) => token.is_active && new Date(token.token_expires_at) <= now
    );

    const expiringSoon = allTokens.filter(
      (token: any) =>
        token.is_active &&
        new Date(token.token_expires_at) > now &&
        new Date(token.token_expires_at) <= fiveMinutesFromNow
    );

    const inactiveTokens = allTokens.filter((token: any) => !token.is_active);

    const tokens = allTokens.map((token: any) => ({
      id: token.id,
      kick_username: token.kick_username,
      kick_user_id: token.kick_user_id,
      is_active: token.is_active,
      token_expires_at: token.token_expires_at,
      has_refresh_token: !!token.refresh_token,
      status: token.is_active
        ? new Date(token.token_expires_at) <= now
          ? "expired"
          : new Date(token.token_expires_at) <= fiveMinutesFromNow
            ? "expiring_soon"
            : "active"
        : "inactive",
      expires_in_minutes: Math.round(
        ((new Date(token.token_expires_at) as any) - (now as any)) / 1000 / 60
      ),
      created_at: token.created_at,
      updated_at: token.updated_at,
    }));

    res.json({
      success: true,
      summary: {
        total: allTokens.length,
        active: activeTokens.length,
        expired: expiredTokens.length,
        expiring_soon: expiringSoon.length,
        inactive: inactiveTokens.length,
      },
      tokens,
    });
  } catch (error: any) {
    logger.error("[KICK ADMIN DEBUG] Error fetching token status:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Clean up expired bot tokens
 */
const cleanupExpiredBotTokens = async (req: any, res: any) => {
  try {
    const now = new Date();

    // Find expired active tokens
    const expiredTokens = await KickBotToken.findAll({
      where: {
        is_active: true,
        token_expires_at: {
          [Op.lt]: now,
        },
      },
    });

    if (expiredTokens.length === 0) {
      return res.json({
        success: true,
        message: "No expired tokens to clean up",
        cleaned: 0,
      });
    }

    // Mark as inactive
    await KickBotToken.update(
      { is_active: false },
      {
        where: {
          is_active: true,
          token_expires_at: {
            [Op.lt]: now,
          },
        },
      }
    );

    res.json({
      success: true,
      message: `${expiredTokens.length} expired tokens marked as inactive`,
      cleaned: expiredTokens.length,
      tokens: expiredTokens.map((token: any) => ({
        id: token.id,
        kick_username: token.kick_username,
        expired_at: token.token_expires_at,
      })),
    });
  } catch (error: any) {
    logger.error("[KICK ADMIN DEBUG] Error cleaning up expired tokens:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Refresh bot token manually
 */
const refreshBotToken = async (req: any, res: any) => {
  try {
    const { tokenId } = req.params;

    const token: any = await KickBotToken.findByPk(tokenId);
    if (!token) {
      return res.status(404).json({
        success: false,
        error: "Token not found",
      });
    }

    const kickBotService = new (KickBotService as any)();

    try {
      const refreshedToken: any = await kickBotService.refreshToken(token);

      res.json({
        success: true,
        message: "Token refreshed successfully",
        token: {
          id: refreshedToken.id,
          kick_username: refreshedToken.kick_username,
          expires_at: refreshedToken.token_expires_at,
          is_active: refreshedToken.is_active,
        },
      });
    } catch (refreshError: any) {
      res.status(400).json({
        success: false,
        error: "Could not refresh the token",
        details: refreshError.message,
        code: refreshError.code || "REFRESH_FAILED",
      });
    }
  } catch (error: any) {
    logger.error("[KICK ADMIN DEBUG] Error refreshing token:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Deactivate bot token
 */
const deactivateBotToken = async (req: any, res: any) => {
  try {
    const { tokenId } = req.params;
    const { reason } = req.body;

    const token: any = await KickBotToken.findByPk(tokenId);
    if (!token) {
      return res.status(404).json({
        success: false,
        error: "Token not found",
      });
    }

    await token.update({
      is_active: false,
      updated_at: new Date(),
    });

    res.json({
      success: true,
      message: "Token deactivated successfully",
      token: {
        id: token.id,
        kick_username: token.kick_username,
        reason: reason || "Deactivated manually",
      },
    });
  } catch (error: any) {
    logger.error("[KICK ADMIN DEBUG] Error deactivating token:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Test sending a message with the bot
 */
const testBotMessage = async (req: any, res: any) => {
  try {
    const { message = "Test message from the admin panel" } = req.body;

    const kickBotService = new (KickBotService as any)();
    const result: any = await kickBotService.sendMessage(message);

    res.json({
      success: result.ok,
      message: result.ok
        ? "Message sent successfully"
        : "Error sending message",
      details: {
        status: result.status,
        data: result.data,
        error: result.error,
      },
    });
  } catch (error: any) {
    logger.error("[KICK ADMIN DEBUG] Error sending test message:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export = {
  getConfig,
  updateMigrationConfig,
  updateVipConfig,
  updateWatchtimeMigrationConfig,
  grantVipFromCanje,
  grantVipManually,
  removeVip,
  cleanupExpiredVips,
  getUsersWithDetails,
  manualBotrixMigration,
  getBotTokensStatus,
  cleanupExpiredBotTokens,
  refreshBotToken,
  deactivateBotToken,
  testBotMessage,
};
