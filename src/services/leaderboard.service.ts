import Usuario from "../models/usuario.model";
import LeaderboardSnapshot from "../models/leaderboardSnapshot.model";
import KickUserTracking from "../models/kickUserTracking.model";
import DiscordUserLink from "../models/discordUserLink.model";
import { UserWatchtime } from "../models";
import { sequelize } from "../models/database";
import logger from "../utils/logger";
import { Op } from "sequelize";
import type { Transaction } from "sequelize";

interface DiscordInfo {
  linked: boolean;
  id: string;
  username: string | null;
  discriminator: string | null;
  avatar: string | null;
  linked_at: Date | null;
  display_name: string;
}

interface LeaderboardEntry {
  usuario_id: number;
  nickname: string;
  display_name: string;
  puntos: number;
  max_puntos: number;
  watchtime_minutes: number;
  message_count: number;
  position: number;
  position_change?: number;
  change_indicator?: string;
  previous_position?: number | null;
  previous_points?: number | null;
  is_vip: boolean;
  is_subscriber: boolean;
  kick_data: Record<string, unknown> | null;
  discord_info: DiscordInfo | null;
}

interface SnapshotMap {
  [key: number]: { position: number; puntos: number };
}

interface ResetInfo {
  next_reset_date: Date | null;
  days_until_reset: number | null;
  hours_until_reset: number | null;
}

interface LeaderboardOptions {
  limit?: number;
  offset?: number;
  userId?: number | null;
}

interface LeaderboardResult {
  success: boolean;
  data: LeaderboardEntry[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    last_update: Date | null;
    next_reset_date: Date | null;
    days_until_reset: number | null;
    hours_until_reset: number | null;
  };
  user_position: LeaderboardEntry | null | undefined;
}

interface SnapshotResult {
  success: boolean;
  snapshot_date: Date;
  users_count: number;
}

interface CleanupResult {
  success: boolean;
  deleted_count: number;
}

interface HistoryEntry {
  position: number | null;
  puntos: number;
  snapshot_date: Date;
}

interface HistoryResult {
  success: boolean;
  history: HistoryEntry[];
}

interface StatsResult {
  success: boolean;
  stats: {
    total_users: number;
    total_points: number;
    average_points: number;
    top_user: { nickname: string; puntos: number } | null;
    vip_users: number;
  };
}

/**
 * Resolves whether a user is an active subscriber based on KickUserTracking
 * @param userIdExt - Kick user ID
 * @returns true if actively subscribed
 */
async function resolveSubscriberStatus(
  userIdExt: string | null
): Promise<boolean> {
  if (!userIdExt) return false;

  const userTracking = await KickUserTracking.findOne({
    where: { kick_user_id: userIdExt },
    attributes: ["is_subscribed", "subscription_expires_at"],
    raw: true,
  });

  if (!userTracking?.is_subscribed) return false;

  const expiresAt = userTracking.subscription_expires_at
    ? new Date(userTracking.subscription_expires_at)
    : null;
  return !expiresAt || expiresAt > new Date();
}

/**
 * Builds a userPosition object for a user outside the current ranking
 * @param userId - Usuario ID
 * @param currentRanking - Current ranking array
 * @returns userPosition object or undefined if user not found
 */
async function buildUserPositionOutsideRanking(
  userId: number,
  currentRanking: LeaderboardEntry[]
): Promise<LeaderboardEntry | undefined> {
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

  if (!usuario) return undefined;

  const position = currentRanking.findIndex((u) => u.usuario_id === userId) + 1;

  const isSubscriber = await resolveSubscriberStatus(usuario.user_id_ext);

  const { discord_info, display_name } =
    await enrichUserWithDiscordInfo(usuario);

  return {
    usuario_id: usuario.id,
    nickname: usuario.nickname,
    display_name,
    puntos: usuario.puntos,
    max_puntos: usuario.max_puntos || 0,
    watchtime_minutes: usuario.watchtime?.total_watchtime_minutes || 0,
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

/**
 * Helper function to enrich user info with Discord data
 * @param user - Usuario model instance
 * @returns Enriched Discord info
 */
async function enrichUserWithDiscordInfo(
  user: Usuario | { id: number; nickname: string }
): Promise<{ discord_info: DiscordInfo | null; display_name: string }> {
  let discordInfo: DiscordInfo | null = null;
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
      linked_at: (discordLink as unknown as { createdAt: Date }).createdAt,
      display_name:
        discordLink.discord_discriminator &&
        discordLink.discord_discriminator !== "0"
          ? `${discordLink.discord_username}#${discordLink.discord_discriminator}`
          : (discordLink.discord_username as string),
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
   * @param options - Query options
   * @param options.limit - Number of users to return (default: 100)
   * @param options.offset - Offset for pagination (default: 0)
   * @param options.userId - Specific user ID to find their position
   * @returns Leaderboard with positions and changes
   */
  async getLeaderboard({
    limit = 100,
    offset = 0,
    userId = null,
  }: LeaderboardOptions = {}): Promise<LeaderboardResult> {
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
      let userPosition: LeaderboardEntry | null | undefined = null;
      if (userId) {
        userPosition = leaderboardWithChanges.find(
          (u) => u.usuario_id === userId
        );
        if (!userPosition) {
          userPosition = await buildUserPositionOutsideRanking(
            userId,
            currentRanking
          );
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
          last_update:
            (lastSnapshot as unknown as { snapshot_date?: Date | null })
              ?.snapshot_date || null,
          next_reset_date: resetInfo.next_reset_date,
          days_until_reset: resetInfo.days_until_reset,
          hours_until_reset: resetInfo.hours_until_reset,
        },
        user_position: userPosition,
      };
    } catch (error: unknown) {
      logger.error("Error getting leaderboard:", error);
      throw error;
    }
  }

  /**
   * Gets the current user ranking sorted by points
   * @private
   */
  async _getCurrentRanking(): Promise<LeaderboardEntry[]> {
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

        // Get subscriber status
        const isSubscriber = await resolveSubscriberStatus(usuario.user_id_ext);

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
          watchtime_minutes:
            ((usuario as unknown as Record<string, unknown>)[
              "watchtime.total_watchtime_minutes"
            ] as number) || 0,
          message_count:
            ((usuario as unknown as Record<string, unknown>)[
              "watchtime.message_count"
            ] as number) || 0,
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
  async _getLastSnapshot(): Promise<SnapshotMap> {
    const lastSnapshotDate = await LeaderboardSnapshot.max("snapshot_date");

    if (!lastSnapshotDate) {
      return {};
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
    }, {} as SnapshotMap);
  }

  /**
   * Calculates the next leaderboard reset date
   * Reset occurs every LEADERBOARD_SNAPSHOT_INTERVAL_HOURS (336 hours = 14 days)
   * @private
   */
  async _getNextResetDate(): Promise<ResetInfo> {
    try {
      const RESET_INTERVAL_HOURS = Number.parseInt(
        process.env.LEADERBOARD_SNAPSHOT_INTERVAL_HOURS || "336"
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
      const nextReset = new Date(lastSnapshotDate as string | number | Date);
      nextReset.setHours(nextReset.getHours() + RESET_INTERVAL_HOURS);

      // Calculate remaining time
      const now = new Date();
      const timeDiff = nextReset.getTime() - now.getTime();
      const hoursUntilReset = Math.ceil(timeDiff / (1000 * 60 * 60));
      const daysUntilReset = Math.ceil(hoursUntilReset / 24);

      return {
        next_reset_date: nextReset,
        days_until_reset: Math.max(0, daysUntilReset),
        hours_until_reset: Math.max(0, hoursUntilReset),
      };
    } catch (error: unknown) {
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
  _calculatePositionChanges(
    currentRanking: LeaderboardEntry[],
    lastSnapshotMap: SnapshotMap
  ): LeaderboardEntry[] {
    return currentRanking.map((current) => {
      const previous = lastSnapshotMap[current.usuario_id];

      let position_change = 0;
      let change_indicator: string;

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
  async createSnapshot(): Promise<SnapshotResult> {
    const transaction: Transaction = await sequelize.transaction();

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
    } catch (error: unknown) {
      await transaction.rollback();
      logger.error("Error creating leaderboard snapshot:", error);
      throw error;
    }
  }

  /**
   * Cleans old snapshots to keep the database optimized
   * @param daysToKeep - Days of history to keep (default: 30)
   */
  async cleanOldSnapshots(daysToKeep: number = 30): Promise<CleanupResult> {
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
    } catch (error: unknown) {
      logger.error("Error cleaning old snapshots:", error);
      throw error;
    }
  }

  /**
   * Gets position history for a specific user
   * @param userId - User ID
   * @param days - Days of history to return (default: 7)
   */
  async getUserPositionHistory(
    userId: number,
    days: number = 7
  ): Promise<HistoryResult> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const history: HistoryEntry[] = await LeaderboardSnapshot.findAll({
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
        history.length > 0 ? new Date(history.at(-1)!.snapshot_date) : null;
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
    } catch (error: unknown) {
      logger.error(`Error getting history for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Gets general leaderboard statistics
   */
  async getLeaderboardStats(): Promise<StatsResult> {
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
    } catch (error: unknown) {
      logger.error("Error getting leaderboard statistics:", error);
      throw error;
    }
  }
}

const leaderboardService = new LeaderboardService();
export = leaderboardService;
