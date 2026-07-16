import {
  Usuario,
  HistorialPunto,
  BotrixMigrationConfig,
  UserWatchtime,
} from "../models";
import { sequelize } from "../models/database";
import { Op } from "sequelize";
import logger from "../utils/logger";

interface ChatMessagePayload {
  sender: { username: string };
  content: string;
}

interface WatchtimeBreakdown {
  days: number;
  hours: number;
  minutes: number;
}

interface MigrationResult {
  processed: boolean;
  reason: string;
  details?: unknown;
  error?: string;
}

class BotrixMigrationService {
  /**
   * Process chat message to detect BotRix response
   * @param chatMessage - Chat message received from the webhook
   */
  static async processChatMessage(
    chatMessage: ChatMessagePayload
  ): Promise<MigrationResult> {
    try {
      const { sender, content } = chatMessage;

      // Verify the message comes from BotRix
      if (sender.username !== "BotRix") {
        return { processed: false, reason: "Not from BotRix" };
      }

      // Check active configuration
      const config = await BotrixMigrationConfig.getConfig();
      if (!config.migration_enabled) {
        return { processed: false, reason: "Migration disabled" };
      }

      // Regex to detect the pattern: "@user has X points."
      const pointsRegex = /@(\w+)\s+tiene\s+(\d+)\s+puntos\./i;
      const match = content.match(pointsRegex);

      if (!match) {
        return { processed: false, reason: "Pattern not matched" };
      }

      const [, targetUsername, botrixPoints] = match;
      const pointsAmount = Number.parseInt(botrixPoints, 10);

      logger.info(
        `[BOTRIX MIGRATION] Detected: @${targetUsername} has ${pointsAmount} points`
      );

      // Find the user by Kick nickname
      const usuario = await Usuario.findOne({
        where: {
          // Search by kick_data.username or nickname
          [Op.or]: [
            sequelize.literal(
              `JSON_EXTRACT(kick_data, '$.username') = '${targetUsername}'`
            ),
            { nickname: targetUsername },
          ],
        },
      });

      if (!usuario) {
        logger.info(
          `[BOTRIX MIGRATION] User ${targetUsername} not found in the database`
        );
        return {
          processed: false,
          reason: "User not found",
          details: { targetUsername, pointsAmount },
        };
      }

      // Check if already migrated
      if (usuario.botrix_migrated) {
        logger.info(
          `[BOTRIX MIGRATION] User ${targetUsername} already migrated points previously`
        );
        return {
          processed: false,
          reason: "Already migrated",
          details: {
            targetUsername,
            pointsAmount,
            migrated_at: usuario.botrix_migrated_at,
            previous_migration: usuario.botrix_points_migrated,
          },
        };
      }

      // Perform the migration
      const result = await this.migrateBotrixPoints(
        usuario,
        pointsAmount,
        targetUsername
      );

      logger.info(
        `[BOTRIX MIGRATION] Migration completed for ${targetUsername}: ${pointsAmount} points`
      );
      return {
        processed: true,
        reason: "Migration successful",
        details: result,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[BOTRIX MIGRATION] Error:", msg);
      return {
        processed: false,
        reason: "Error",
        error: msg,
      };
    }
  }

  /**
   * Perform Botrix points migration
   * @param usuario - Database user
   * @param pointsAmount - Amount of points to migrate
   * @param kickUsername - Kick username for logs
   */
  static async migrateBotrixPoints(
    usuario: Usuario,
    pointsAmount: number,
    kickUsername: string
  ) {
    const transaction = await sequelize.transaction();

    try {
      // Update user points
      const puntosAnteriores = usuario.puntos;
      const nuevosTotal = puntosAnteriores + pointsAmount;

      await usuario.update(
        {
          puntos: nuevosTotal,
          botrix_migrated: true,
          botrix_migrated_at: new Date(),
          botrix_points_migrated: pointsAmount,
        },
        { transaction }
      );

      // Create entry in points history
      await HistorialPunto.create(
        {
          usuario_id: usuario.id,
          puntos: pointsAmount,
          tipo: "ganado",
          concepto: "Migration from Botrix",
          motivo: `Points migrated automatically from Botrix by bot response`,
          kick_event_data: {
            event_type: "botrix_migration",
            kick_username: kickUsername,
            original_points: pointsAmount,
            migration_date: new Date().toISOString(),
          },
        },
        { transaction }
      );

      await transaction.commit();

      return {
        usuario_id: usuario.id,
        nickname: usuario.nickname,
        kick_username: kickUsername,
        puntos_anteriores: puntosAnteriores,
        puntos_migrados: pointsAmount,
        nuevo_total: nuevosTotal,
        migrated_at: new Date(),
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get migration statistics
   */
  static async getMigrationStats() {
    const totalUsers = await Usuario.count();
    const migratedUsers = await Usuario.count({
      where: { botrix_migrated: true },
    });
    const pendingUsers = totalUsers - migratedUsers;

    const totalMigratedPoints =
      (await Usuario.sum("botrix_points_migrated", {
        where: { botrix_migrated: true },
      })) || 0;

    const config = await BotrixMigrationConfig.getConfig();

    return {
      total_users: totalUsers,
      migrated_users: migratedUsers,
      pending_users: pendingUsers,
      migration_percentage:
        totalUsers > 0 ? ((migratedUsers / totalUsers) * 100).toFixed(2) : 0,
      total_migrated_points: totalMigratedPoints,
      migration_enabled: config.migration_enabled,
      last_updated: new Date(),
    };
  }

  /**
   * Process chat message to detect BotRix watchtime
   * Pattern: "@user has spent X days Y hours Z min watching this channel"
   * @param chatMessage - Chat message received from the webhook
   */
  static async processWatchtimeMessage(
    chatMessage: ChatMessagePayload
  ): Promise<MigrationResult> {
    try {
      const { sender, content } = chatMessage;

      // Verify the message comes from BotRix
      if (sender.username !== "BotRix") {
        return { processed: false, reason: "Not from BotRix" };
      }

      // Check active watchtime migration configuration
      const config = await BotrixMigrationConfig.getConfig();
      if (!config.watchtime_migration_enabled) {
        return { processed: false, reason: "Watchtime migration disabled" };
      }

      // Regex to detect watchtime messages from Kick chat (Spanish format: "@user has spent [X days] [Y hours] [Z min] watching [this channel|the stream]")
      // Safe pattern: captures the time part as a sequence of "number + unit"
      const timeUnit = /\d+\s+(?:d[íi]as?|horas?|h|min)\s*/i;
      const watchtimeRegex = new RegExp(
        `@(\\w+)\\s+ha\\s+pasado\\s+((?:${timeUnit.source})+)viendo\\s+(?:este\\s+canal|el\\s+stream)`,
        "i"
      );
      const match = content.match(watchtimeRegex);

      if (!match) {
        return { processed: false, reason: "Pattern not matched" };
      }

      const [, targetUsername, timeStr] = match;

      // Extract time components without regex (avoids backtracking - S5852)
      let days = 0,
        hours = 0,
        minutes = 0;
      const parts = timeStr.trim().split(" ").filter(Boolean);
      for (let i = 0; i < parts.length - 1; i++) {
        const num = Number.parseInt(parts[i], 10);
        if (Number.isNaN(num)) continue;
        const unit = parts[i + 1].toLowerCase();
        if (unit.startsWith("min")) minutes = num;
        else if (unit.startsWith("h")) hours = num;
        else if (unit.startsWith("d")) days = num;
      }

      // Convert everything to minutes: days * 24 * 60 + hours * 60 + minutes
      const totalWatchtimeMinutes = days * 24 * 60 + hours * 60 + minutes;

      logger.info(
        `[BOTRIX WATCHTIME MIGRATION] Detected: @${targetUsername} has ${days}d ${hours}h ${minutes}m = ${totalWatchtimeMinutes} minutes`
      );

      // Find the user by Kick nickname
      const usuario = await Usuario.findOne({
        where: {
          [Op.or]: [
            sequelize.literal(
              `JSON_EXTRACT(kick_data, '$.username') = '${targetUsername}'`
            ),
            { nickname: targetUsername },
          ],
        },
      });

      if (!usuario) {
        logger.info(
          `[BOTRIX WATCHTIME MIGRATION] User ${targetUsername} not found in the database`
        );
        return {
          processed: false,
          reason: "User not found",
          details: { targetUsername, totalWatchtimeMinutes },
        };
      }

      // Check if watchtime was already migrated
      if (usuario.botrix_watchtime_migrated) {
        logger.info(
          `[BOTRIX WATCHTIME MIGRATION] User ${targetUsername} already migrated watchtime previously`
        );
        return {
          processed: false,
          reason: "Already migrated",
          details: {
            targetUsername,
            totalWatchtimeMinutes,
            migrated_at: usuario.botrix_watchtime_migrated_at,
            previous_migration: usuario.botrix_watchtime_minutes_migrated,
          },
        };
      }

      // Perform the migration
      const result = await this.migrateWatchtime(
        usuario,
        totalWatchtimeMinutes,
        targetUsername,
        { days, hours, minutes }
      );

      logger.info(
        `[BOTRIX WATCHTIME MIGRATION] Migration completed for ${targetUsername}: ${totalWatchtimeMinutes} minutes`
      );
      return {
        processed: true,
        reason: "Migration successful",
        details: result,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[BOTRIX WATCHTIME MIGRATION] Error:", msg);
      return {
        processed: false,
        reason: "Error",
        error: msg,
      };
    }
  }

  /**
   * Perform Botrix watchtime migration
   * @param usuario - Database user
   * @param totalWatchtimeMinutes - Total minutes to migrate
   * @param kickUsername - Kick username for logs
   * @param breakdown - Breakdown of days, hours, minutes
   */
  static async migrateWatchtime(
    usuario: Usuario,
    totalWatchtimeMinutes: number,
    kickUsername: string,
    breakdown: WatchtimeBreakdown = { days: 0, hours: 0, minutes: 0 }
  ) {
    const transaction = await sequelize.transaction();

    try {
      // Get or create user watchtime record
      let userWatchtime = await UserWatchtime.findOne({
        where: { usuario_id: usuario.id },
        transaction,
      });

      if (!userWatchtime) {
        // Create new watchtime record
        userWatchtime = await UserWatchtime.create(
          {
            usuario_id: usuario.id,
            kick_user_id: usuario.user_id_ext,
            total_watchtime_minutes: totalWatchtimeMinutes,
            message_count: 0,
            first_message_date: new Date(),
          },
          { transaction }
        );
      } else {
        // Update existing watchtime
        userWatchtime.total_watchtime_minutes += totalWatchtimeMinutes;
        await userWatchtime.save({ transaction });
      }

      // Update user with migration info
      await usuario.update(
        {
          botrix_watchtime_migrated: true,
          botrix_watchtime_migrated_at: new Date(),
          botrix_watchtime_minutes_migrated: totalWatchtimeMinutes,
        },
        { transaction }
      );

      await transaction.commit();

      return {
        usuario_id: usuario.id,
        nickname: usuario.nickname,
        kick_username: kickUsername,
        watchtime_minutes_migrated: totalWatchtimeMinutes,
        watchtime_breakdown: breakdown,
        total_watchtime_after_migration: userWatchtime.total_watchtime_minutes,
        migrated_at: new Date(),
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get watchtime migration statistics
   */
  static async getWatchtimeMigrationStats() {
    const totalUsers = await Usuario.count();
    const migratedUsers = await Usuario.count({
      where: { botrix_watchtime_migrated: true },
    });
    const pendingUsers = totalUsers - migratedUsers;

    const totalMigratedWatchtime =
      (await Usuario.sum("botrix_watchtime_minutes_migrated", {
        where: { botrix_watchtime_migrated: true },
      })) || 0;

    const config = await BotrixMigrationConfig.getConfig();

    return {
      total_users: totalUsers,
      migrated_users: migratedUsers,
      pending_users: pendingUsers,
      migration_percentage:
        totalUsers > 0 ? ((migratedUsers / totalUsers) * 100).toFixed(2) : 0,
      total_migrated_minutes: totalMigratedWatchtime,
      watchtime_migration_enabled: config.watchtime_migration_enabled,
      last_updated: new Date(),
    };
  }

  /**
   * Enable/disable migration
   */
  static async toggleMigration(enabled: boolean) {
    const config = await BotrixMigrationConfig.findByPk(1);
    if (!config) {
      throw new Error("Botrix migration config not found");
    }
    await config.update({ migration_enabled: enabled });
    return config;
  }
}

export default BotrixMigrationService;
