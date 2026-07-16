import type { Request, Response } from "express";
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
import { Op, WhereOptions } from "sequelize";
import logger from "../utils/logger";

/** Type for Canje with eagerly-loaded associations. */
type CanjeWithAssociations = Canje & {
  Usuario?: Usuario | null;
  Producto?: Producto | null;
};

/**
 * Helper to enrich user info with Discord data
 * @param user - Usuario model instance
 * @returns Enriched Discord info
 */
async function enrichUserWithDiscordInfo(user: Usuario) {
  let discordInfo = null;
  const discordLink = await DiscordUserLink.findOne({
    where: { tienda_user_id: user.id },
  });

  if (discordLink) {
    discordInfo = {
      linked: true,
      id: discordLink.discord_user_id,
      username: discordLink.discord_username,
      discriminator: discordLink.discord_discriminator,
      avatar: discordLink.discord_avatar,
      linked_at: discordLink.created_at,
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
const getConfig = async (req: Request, res: Response) => {
  try {
    const config = await BotrixMigrationConfig.getConfig();

    // Get real point migration stats
    const migrationStats = (await Usuario.findAll({
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
    })) as unknown as Array<{
      migrated_users: string;
      total_points_migrated: string;
    }>;

    // Get real watchtime migration stats
    const watchtimeMigrationStats = (await Usuario.findAll({
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
    })) as unknown as Array<{
      migrated_users: string;
      total_minutes_migrated: string;
    }>;

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
            String(migrationStats[0]?.migrated_users ?? 0),
            10
          ),
          total_points_migrated: Number.parseInt(
            String(migrationStats[0]?.total_points_migrated ?? 0),
            10
          ),
        },
      },
      watchtime_migration: {
        enabled: config.watchtime_migration_enabled,
        stats: {
          migrated_users: Number.parseInt(
            String(watchtimeMigrationStats[0]?.migrated_users ?? 0),
            10
          ),
          total_minutes_migrated: Number.parseInt(
            String(watchtimeMigrationStats[0]?.total_minutes_migrated ?? 0),
            10
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
  } catch (error) {
    logger.error("[KICK ADMIN DEBUG] Error fetching configuration:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Update migration configuration
 */
const updateMigrationConfig = async (req: Request, res: Response) => {
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
    let booleanValue: boolean;

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
  } catch (error) {
    logger.error(
      "[KICK ADMIN DEBUG] Error updating migration configuration:",
      error
    );
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Parse a boolean field that may come as string or boolean
 * Returns { value } on success or { error } on failure
 */
function parseBooleanField(
  value: unknown,
  fieldName: string
): { value?: boolean; error?: string } {
  if (typeof value === "boolean") return { value };
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "true") return { value: true };
    if (lower === "false") return { value: false };
  }
  return { error: `${fieldName} must be a boolean` };
}

/**
 * Parse and validate a non-negative number field
 * Returns { value } on success or { error } on failure
 */
function parseNonNegativeNumber(
  value: unknown,
  fieldName: string
): { value?: number; error?: string } {
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) {
    return { error: `${fieldName} must be a non-negative number` };
  }
  return { value: num };
}

/**
 * Update VIP points configuration
 */
const updateVipConfig = async (req: Request, res: Response) => {
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

    const updateData: Record<string, boolean | number> = {};

    // Validate and convert vip_points_enabled
    if (vip_points_enabled !== undefined) {
      const result = parseBooleanField(
        vip_points_enabled,
        "vip_points_enabled"
      );
      if (result.error) {
        return res.status(400).json({ success: false, error: result.error });
      }
      updateData.vip_points_enabled = result.value as boolean;
    }

    // Validate and convert numbers
    const numberFields: Array<[string, unknown]> = [
      ["vip_chat_points", vip_chat_points],
      ["vip_follow_points", vip_follow_points],
      ["vip_sub_points", vip_sub_points],
    ];
    for (const [fieldName, fieldValue] of numberFields) {
      if (fieldValue === undefined) continue;
      const result = parseNonNegativeNumber(fieldValue, fieldName);
      if (result.error) {
        return res.status(400).json({ success: false, error: result.error });
      }
      updateData[fieldName] = result.value as number;
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
  } catch (error) {
    logger.error("[KICK ADMIN DEBUG] Error updating VIP configuration:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Update watchtime migration configuration
 */
const updateWatchtimeMigrationConfig = async (req: Request, res: Response) => {
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
    let booleanValue: boolean;

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
  } catch (error) {
    logger.error(
      "[KICK ADMIN DEBUG] Error updating watchtime migration configuration:",
      error
    );
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Grant VIP from a delivered canje
 */
const grantVipFromCanje = async (req: Request, res: Response) => {
  try {
    const canjeId = req.params.canjeId as string;
    const { duration_days } = req.body;

    // Find the canje
    const canje = (await Canje.findByPk(canjeId, {
      include: [{ model: Usuario }, { model: Producto }],
    })) as CanjeWithAssociations | null;

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
    let vip_expires_at: Date | null = null;
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
      vip_granted_by_canje_id: canjeId as unknown as number,
    });

    res.json({
      success: true,
      message: "VIP granted successfully",
      user_id: canje.Usuario.id,
      duration: duration_days ? `${duration_days} days` : "Permanent",
    });
  } catch (error) {
    logger.error("Error granting VIP from canje:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Grant VIP manually to a user
 */
const grantVipManually = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.params.usuarioId as string;
    const { duration_days } = req.body;

    // Find the user
    const usuario = await Usuario.findByPk(usuarioId);

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
    let vip_expires_at: Date | null = null;
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
  } catch (error) {
    logger.error("Error granting VIP manually:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Remove VIP from a user
 */
const removeVip = async (req: Request, res: Response) => {
  try {
    const usuarioId = req.params.usuarioId as string;
    const { reason } = req.body;

    // Find the user
    const usuario = await Usuario.findByPk(usuarioId);

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
  } catch (error) {
    logger.error("Error removing VIP:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Clean up expired VIPs
 */
const cleanupExpiredVips = async (_req: Request, res: Response) => {
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
      users: expiredVips.map((u) => ({
        id: u.id,
        nickname: u.nickname,
        expired_at: u.vip_expires_at,
      })),
    });
  } catch (error) {
    logger.error("Error cleaning up expired VIPs:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const getUsersWithDetails = async (req: Request, res: Response) => {
  try {
    const { filter = "all" } = req.query;

    const whereClause: WhereOptions = {};
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
      usuarios.map(async (user) => {
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
          const userTracking = await KickUserTracking.findOne({
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
  } catch (error) {
    logger.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const manualBotrixMigration = async (req: Request, res: Response) => {
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
    const usuario = await Usuario.findByPk(usuarioId);

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
  } catch (error) {
    logger.error("[KICK ADMIN DEBUG] Error in manual migration:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Get Kick bot token status
 */
const getBotTokensStatus = async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    // Get all tokens
    const allTokens = await KickBotToken.findAll({
      order: [["updated_at", "DESC"]],
    });

    // Classify tokens
    const activeTokens = allTokens.filter(
      (token) => token.is_active && new Date(token.token_expires_at) > now
    );

    const expiredTokens = allTokens.filter(
      (token) => token.is_active && new Date(token.token_expires_at) <= now
    );

    const expiringSoon = allTokens.filter(
      (token) =>
        token.is_active &&
        new Date(token.token_expires_at) > now &&
        new Date(token.token_expires_at) <= fiveMinutesFromNow
    );

    const inactiveTokens = allTokens.filter((token) => !token.is_active);

    const tokens = allTokens.map((token) => ({
      id: token.id,
      kick_username: token.kick_username,
      kick_user_id: token.kick_user_id,
      is_active: token.is_active,
      token_expires_at: token.token_expires_at,
      has_refresh_token: !!token.refresh_token,
      status: (() => {
        if (!token.is_active) return "inactive";
        if (new Date(token.token_expires_at) <= now) return "expired";
        if (new Date(token.token_expires_at) <= fiveMinutesFromNow)
          return "expiring_soon";
        return "active";
      })(),
      expires_in_minutes: Math.round(
        (new Date(token.token_expires_at).getTime() - now.getTime()) / 1000 / 60
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
  } catch (error) {
    logger.error("[KICK ADMIN DEBUG] Error fetching token status:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Clean up expired bot tokens
 */
const cleanupExpiredBotTokens = async (_req: Request, res: Response) => {
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
      tokens: expiredTokens.map((token) => ({
        id: token.id,
        kick_username: token.kick_username,
        expired_at: token.token_expires_at,
      })),
    });
  } catch (error) {
    logger.error("[KICK ADMIN DEBUG] Error cleaning up expired tokens:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Refresh bot token manually
 */
const refreshBotToken = async (req: Request, res: Response) => {
  try {
    const tokenId = req.params.tokenId as string;

    const token = await KickBotToken.findByPk(tokenId);
    if (!token) {
      return res.status(404).json({
        success: false,
        error: "Token not found",
      });
    }

    const kickBotService = new (
      KickBotService as unknown as new () => {
        refreshToken: (
          token: typeof KickBotToken.prototype
        ) => Promise<typeof KickBotToken.prototype>;
      }
    )();

    try {
      const refreshedToken = await kickBotService.refreshToken(token);

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
    } catch (refreshError) {
      res.status(400).json({
        success: false,
        error: "Could not refresh the token",
        details:
          refreshError instanceof Error
            ? refreshError.message
            : String(refreshError),
        code: (refreshError as { code?: string })?.code || "REFRESH_FAILED",
      });
    }
  } catch (error) {
    logger.error("[KICK ADMIN DEBUG] Error refreshing token:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Deactivate bot token
 */
const deactivateBotToken = async (req: Request, res: Response) => {
  try {
    const tokenId = req.params.tokenId as string;
    const { reason } = req.body;

    const token = await KickBotToken.findByPk(tokenId);
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
  } catch (error) {
    logger.error("[KICK ADMIN DEBUG] Error deactivating token:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Test sending a message with the bot
 */
const testBotMessage = async (req: Request, res: Response) => {
  try {
    const { message = "Test message from the admin panel" } = req.body;

    const kickBotService = new (
      KickBotService as unknown as new () => {
        sendMessage: (message: string) => Promise<{
          ok: boolean;
          status: number;
          data: unknown;
          error: unknown;
        }>;
      }
    )();
    const result = await kickBotService.sendMessage(message);

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
  } catch (error) {
    logger.error("[KICK ADMIN DEBUG] Error sending test message:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
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
