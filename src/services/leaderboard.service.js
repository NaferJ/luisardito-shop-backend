const Usuario = require("../models/usuario.model");
const LeaderboardSnapshot = require("../models/leaderboardSnapshot.model");
const KickUserTracking = require("../models/kickUserTracking.model");
const DiscordUserLink = require("../models/discordUserLink.model");
const { sequelize } = require("../models/database");
const logger = require("../utils/logger");
const { Op } = require("sequelize");

/**
 * Helper function to enrich user info with Discord data
 * @param {Object} user - Usuario model instance
 * @returns {Object} Enriched Discord info
 */
async function enrichUserWithDiscordInfo(user) {
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

class LeaderboardService {
  /**
   * Gets the current leaderboard with position change indicators
   * @param {Object} options - Query options
   * @param {number} options.limit - Number of users to return (default: 100)
   * @param {number} options.offset - Offset for pagination (default: 0)
   * @param {number} options.userId - Specific user ID to find their position
   * @returns {Object} Leaderboard with positions and changes
   */
  async getLeaderboard({ limit = 100, offset = 0, userId = null } = {}) {
    try {
      // 1. Get current ranking
      const currentRanking = await this._getCurrentRanking();

      // 2. Get last snapshot to compare positions
      const lastSnapshot = await this._getLastSnapshot();

      // 3. Combine current data with historical to detect changes
      const leaderboardWithChanges = this._calculatePositionChanges(
        currentRanking,
        lastSnapshot
      );

      // 4. If a specific user is requested, include their position even if outside the top
      let userPosition = null;
      if (userId) {
        userPosition = leaderboardWithChanges.find(
          (u) => u.usuario_id === userId
        );
        if (!userPosition) {
          // User is outside the current ranking, find them manually
          const { UserWatchtime } = require("../models");

          const usuario = await Usuario.findByPk(userId, {
            include: [
              {
                model: UserWatchtime,
                as: "watchtime",
                attributes: ["total_watchtime_minutes", "message_count"],
                required: false,
              },
            ],
          });

          if (usuario) {
            const position =
              currentRanking.findIndex((u) => u.usuario_id === userId) + 1;

            // Get subscriber status from KickUserTracking
            let isSubscriber = false;
            if (usuario.user_id_ext) {
              const userTracking = await KickUserTracking.findOne({
                where: { kick_user_id: usuario.user_id_ext },
                attributes: ["is_subscribed", "subscription_expires_at"],
                raw: true,
              });

              if (userTracking?.is_subscribed) {
                const now = new Date();
                const expiresAt = userTracking.subscription_expires_at
                  ? new Date(userTracking.subscription_expires_at)
                  : null;
                isSubscriber = !expiresAt || expiresAt > now;
              }
            }

            // Enrich with Discord info
            const { discord_info, display_name } =
              await enrichUserWithDiscordInfo(usuario);

            userPosition = {
              usuario_id: usuario.id,
              nickname: usuario.nickname,
              display_name,
              puntos: usuario.puntos,
              max_puntos: usuario.max_puntos || 0,
              watchtime_minutes:
                usuario.watchtime?.total_watchtime_minutes || 0,
              message_count: usuario.watchtime?.message_count || 0,
              position: position || currentRanking.length + 1,
              position_change: 0,
              change_indicator: "neutral",
              is_vip: usuario.is_vip && usuario.isVipActive(),
              is_subscriber: isSubscriber,
              kick_data: usuario.kick_data,
              discord_info,
            };
          }
        }
      }

      // 5. Apply pagination
      const paginatedData = leaderboardWithChanges.slice(
        offset,
        offset + limit
      );

      // 6. Get next reset info
      const resetInfo = await this._getNextResetDate();

      return {
        success: true,
        data: paginatedData,
        meta: {
          total: leaderboardWithChanges.length,
          limit,
          offset,
          last_update: lastSnapshot?.snapshot_date || null,
          next_reset_date: resetInfo.next_reset_date,
          days_until_reset: resetInfo.days_until_reset,
          hours_until_reset: resetInfo.hours_until_reset,
        },
        user_position: userPosition,
      };
    } catch (error) {
      logger.error("Error getting leaderboard:", error);
      throw error;
    }
  }

  /**
   * Gets the current user ranking sorted by points
   * @private
   */
  async _getCurrentRanking() {
    const { UserWatchtime } = require("../models");

    const usuarios = await Usuario.findAll({
      where: {
        puntos: {
          [Op.gt]: 0, // Only users with points
        },
      },
      attributes: [
        "id",
        "nickname",
        "puntos",
        "max_puntos",
        "is_vip",
        "vip_expires_at",
        "kick_data",
        "user_id_ext",
        "discord_username",
      ],
      include: [
        {
          model: UserWatchtime,
          as: "watchtime",
          attributes: ["total_watchtime_minutes", "message_count"],
          required: false,
        },
      ],
      order: [
        ["puntos", "DESC"],
        ["creado", "ASC"], // On tie, oldest first
      ],
      raw: true,
    });

    // Assign positions and get subscriber status from KickUserTracking
    const usuariosConPosicion = await Promise.all(
      usuarios.map(async (usuario, index) => {
        const isVipActive =
          usuario.is_vip &&
          (!usuario.vip_expires_at ||
            new Date(usuario.vip_expires_at) > new Date());

        // Get subscriber status from KickUserTracking
        let isSubscriber = false;
        if (usuario.user_id_ext) {
          const userTracking = await KickUserTracking.findOne({
            where: { kick_user_id: usuario.user_id_ext },
            attributes: ["is_subscribed", "subscription_expires_at"],
            raw: true,
          });

          if (userTracking?.is_subscribed) {
            const now = new Date();
            const expiresAt = userTracking.subscription_expires_at
              ? new Date(userTracking.subscription_expires_at)
              : null;
            isSubscriber = !expiresAt || expiresAt > now;
          }
        }

        // Enrich with Discord info
        const { discord_info, display_name } = await enrichUserWithDiscordInfo({
          id: usuario.id,
          nickname: usuario.nickname,
        });

        return {
          usuario_id: usuario.id,
          nickname: usuario.nickname,
          display_name,
          puntos: usuario.puntos,
          max_puntos: usuario.max_puntos || 0,
          watchtime_minutes: usuario["watchtime.total_watchtime_minutes"] || 0,
          message_count: usuario["watchtime.message_count"] || 0,
          position: index + 1,
          is_vip: isVipActive,
          is_subscriber: isSubscriber,
          kick_data: usuario.kick_data,
          discord_info,
        };
      })
    );

    return usuariosConPosicion;
  }

  /**
   * Gets the last saved snapshot
   * @private
   */
  async _getLastSnapshot() {
    const lastSnapshotDate = await LeaderboardSnapshot.max("snapshot_date");

    if (!lastSnapshotDate) {
      return [];
    }

    const snapshots = await LeaderboardSnapshot.findAll({
      where: {
        snapshot_date: lastSnapshotDate,
      },
      attributes: ["usuario_id", "position", "puntos"],
      raw: true,
    });

    // Create a map for quick access
    return snapshots.reduce((acc, snapshot) => {
      acc[snapshot.usuario_id] = {
        position: snapshot.position,
        puntos: snapshot.puntos,
      };
      return acc;
    }, {});
  }

  /**
   * Calculates the next leaderboard reset date
   * Reset occurs every LEADERBOARD_SNAPSHOT_INTERVAL_HOURS (336 hours = 14 days)
   * @private
   */
  async _getNextResetDate() {
    try {
      const RESET_INTERVAL_HOURS = parseInt(
        process.env.LEADERBOARD_SNAPSHOT_INTERVAL_HOURS || 336
      );

      const lastSnapshotDate = await LeaderboardSnapshot.max("snapshot_date");

      if (!lastSnapshotDate) {
        // If no snapshots, next reset is in 336 hours from now
        const nextReset = new Date();
        nextReset.setHours(nextReset.getHours() + RESET_INTERVAL_HOURS);
        return {
          next_reset_date: nextReset,
          days_until_reset: Math.ceil(RESET_INTERVAL_HOURS / 24),
          hours_until_reset: RESET_INTERVAL_HOURS,
        };
      }

      // Calculate next reset
      const nextReset = new Date(lastSnapshotDate);
      nextReset.setHours(nextReset.getHours() + RESET_INTERVAL_HOURS);

      // Calculate remaining time
      const now = new Date();
      const timeDiff = nextReset - now;
      const hoursUntilReset = Math.ceil(timeDiff / (1000 * 60 * 60));
      const daysUntilReset = Math.ceil(hoursUntilReset / 24);

      return {
        next_reset_date: nextReset,
        days_until_reset: Math.max(0, daysUntilReset),
        hours_until_reset: Math.max(0, hoursUntilReset),
      };
    } catch (error) {
      logger.error("Error calculating next reset:", error);
      return {
        next_reset_date: null,
        days_until_reset: null,
        hours_until_reset: null,
      };
    }
  }

  /**
   * Calculates position changes by comparing current ranking with previous snapshot
   * @private
   */
  _calculatePositionChanges(currentRanking, lastSnapshotMap) {
    return currentRanking.map((current) => {
      const previous = lastSnapshotMap[current.usuario_id];

      let position_change = 0;
      let change_indicator;

      if (!previous) {
        // New user in the ranking
        change_indicator = "new";
      } else {
        position_change = previous.position - current.position;

        if (position_change > 0) {
          change_indicator = "up"; // Moved up (lower number = better)
        } else if (position_change < 0) {
          change_indicator = "down"; // Moved down
        } else {
          change_indicator = "neutral"; // No change
        }
      }

      return {
        ...current,
        position_change: Math.abs(position_change),
        change_indicator,
        previous_position: previous?.position || null,
        previous_points: previous?.puntos || null,
      };
    });
  }

  /**
   * Creates a snapshot of the current leaderboard
   * This method should run periodically (e.g.: every hour, every day)
   */
  async createSnapshot() {
    const transaction = await sequelize.transaction();

    try {
      logger.info("Creating leaderboard snapshot...");

      const currentRanking = await this._getCurrentRanking();
      const snapshotDate = new Date();

      const snapshotRecords = currentRanking.map((user) => ({
        usuario_id: user.usuario_id,
        nickname: user.nickname,
        puntos: user.puntos,
        position: user.position,
        snapshot_date: snapshotDate,
        is_vip: user.is_vip,
        is_subscriber: user.is_subscriber,
        kick_data: user.kick_data,
      }));

      await LeaderboardSnapshot.bulkCreate(snapshotRecords, { transaction });

      await transaction.commit();

      logger.info(
        `Snapshot created successfully: ${snapshotRecords.length} users registered`
      );

      return {
        success: true,
        snapshot_date: snapshotDate,
        users_count: snapshotRecords.length,
      };
    } catch (error) {
      await transaction.rollback();
      logger.error("Error creating leaderboard snapshot:", error);
      throw error;
    }
  }

  /**
   * Cleans old snapshots to keep the database optimized
   * @param {number} daysToKeep - Days of history to keep (default: 30)
   */
  async cleanOldSnapshots(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deleted = await LeaderboardSnapshot.destroy({
        where: {
          snapshot_date: {
            [Op.lt]: cutoffDate,
          },
        },
      });

      logger.info(`Snapshot cleanup: ${deleted} old records removed`);

      return {
        success: true,
        deleted_count: deleted,
      };
    } catch (error) {
      logger.error("Error cleaning old snapshots:", error);
      throw error;
    }
  }

  /**
   * Gets position history for a specific user
   * @param {number} userId - User ID
   * @param {number} days - Days of history to return (default: 7)
   */
  async getUserPositionHistory(userId, days = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const history = await LeaderboardSnapshot.findAll({
        where: {
          usuario_id: userId,
          snapshot_date: {
            [Op.gte]: cutoffDate,
          },
        },
        attributes: ["position", "puntos", "snapshot_date"],
        order: [["snapshot_date", "ASC"]],
        raw: true,
      });

      // Add current position if there is no recent snapshot
      const lastSnapshotDate =
        history.length > 0
          ? new Date(history[history.length - 1].snapshot_date)
          : null;
      const hoursSinceLastSnapshot = lastSnapshotDate
        ? (Date.now() - lastSnapshotDate.getTime()) / (1000 * 60 * 60)
        : Infinity;

      if (hoursSinceLastSnapshot > 1) {
        // If more than 1 hour has passed
        const usuario = await Usuario.findByPk(userId);
        if (usuario) {
          const currentRanking = await this._getCurrentRanking();
          const currentPosition =
            currentRanking.findIndex((u) => u.usuario_id === userId) + 1;

          history.push({
            position: currentPosition || null,
            puntos: usuario.puntos,
            snapshot_date: new Date(),
          });
        }
      }

      return {
        success: true,
        history,
      };
    } catch (error) {
      logger.error(`Error getting history for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Gets general leaderboard statistics
   */
  async getLeaderboardStats() {
    try {
      const totalUsers = await Usuario.count({
        where: {
          puntos: {
            [Op.gt]: 0,
          },
        },
      });

      const totalPoints = await Usuario.sum("puntos");

      const avgPoints =
        totalUsers > 0 ? Math.round(totalPoints / totalUsers) : 0;

      const topUser = await Usuario.findOne({
        where: {
          puntos: {
            [Op.gt]: 0,
          },
        },
        order: [["puntos", "DESC"]],
        attributes: ["nickname", "puntos"],
        raw: true,
      });

      const vipCount = await Usuario.count({
        where: {
          is_vip: true,
          [Op.or]: [
            { vip_expires_at: null },
            { vip_expires_at: { [Op.gt]: new Date() } },
          ],
        },
      });

      return {
        success: true,
        stats: {
          total_users: totalUsers,
          total_points: totalPoints || 0,
          average_points: avgPoints,
          top_user: topUser,
          vip_users: vipCount,
        },
      };
    } catch (error) {
      logger.error("Error getting leaderboard statistics:", error);
      throw error;
    }
  }
}

module.exports = new LeaderboardService();
