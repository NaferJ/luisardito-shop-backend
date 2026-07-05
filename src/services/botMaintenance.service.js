// filepath: c:\Users\NaferJ\Projects\Private\luisardito-shop-backend\src\services\botMaintenance.service.js
const kickBotService = require("./kickBot.service");
const { KickBotToken } = require("../models");
const { Op } = require("sequelize");
const logger = require("../utils/logger");

/**
 * Automatic maintenance service for the Kick bot
 * Runs every hour to keep tokens active
 */
class BotMaintenanceService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.intervalMinutes = parseInt(
      process.env.BOT_MAINTENANCE_INTERVAL_MINUTES || "60",
    ); // Default every 60 minutes
  }

  /**
   * Starts automatic maintenance
   */
  start() {
    if (this.isRunning) {
      logger.info("[BOT-MAINTENANCE] Service is already running");
      return;
    }

    logger.info(
      `[BOT-MAINTENANCE] Starting automatic maintenance every ${this.intervalMinutes} minutes`,
    );

    // Run immediately on start
    this.performMaintenance();

    // Configure interval
    const intervalMs = this.intervalMinutes * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.performMaintenance();
    }, intervalMs);

    this.isRunning = true;

    // Handle termination signals to stop the service correctly
    process.on("SIGINT", () => this.stop());
    process.on("SIGTERM", () => this.stop());
  }

  /**
   * Stops automatic maintenance
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info("[BOT-MAINTENANCE] Service stopped");
  }

  /**
   * Runs bot maintenance
   */
  async performMaintenance() {
    try {
      logger.info("[BOT-MAINTENANCE] Starting scheduled maintenance...");

      // 1. Clean up expired tokens
      await this.cleanupExpiredTokens();

      // 2. Renew all tokens expiring soon
      await this.refreshExpiringTokens();

      // 3. Optional: simulate chat activity
      await this.simulateChatActivity();

      logger.info("[BOT-MAINTENANCE] Maintenance completed successfully");
    } catch (error) {
      logger.error(
        "[BOT-MAINTENANCE] Error in maintenance:",
        error.message,
      );
    }
  }

  /**
   * Cleans up expired tokens
   */
  async cleanupExpiredTokens() {
    try {
      const now = new Date();
      const expiredTokens = await KickBotToken.findAll({
        where: {
          is_active: true,
          token_expires_at: { [Op.lt]: now },
        },
      });

      if (expiredTokens.length > 0) {
        await KickBotToken.update(
          { is_active: false },
          {
            where: {
              is_active: true,
              token_expires_at: { [Op.lt]: now },
            },
          },
        );
        logger.info(
          `[BOT-MAINTENANCE] ${expiredTokens.length} expired tokens marked as inactive`,
        );
      } else {
        logger.info(
          "[BOT-MAINTENANCE] No expired tokens to clean up",
        );
      }
    } catch (error) {
      logger.error(
        "[BOT-MAINTENANCE] Error cleaning tokens:",
        error.message,
      );
    }
  }

  /**
   * Renews all tokens expiring soon
   */
  async refreshExpiringTokens() {
    try {
      logger.info(
        "[BOT-MAINTENANCE] Checking tokens expiring soon...",
      );
      const thresholdDate = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
      const tokens = await KickBotToken.findAll({
        where: {
          is_active: true,
          token_expires_at: { [Op.lt]: thresholdDate },
        },
      });

      for (const token of tokens) {
        await kickBotService.renewAccessToken(token);
      }

      if (tokens.length > 0) {
        logger.info(
          `[BOT-MAINTENANCE] ${tokens.length} tokens renewed successfully`,
        );
      } else {
        logger.info("[BOT-MAINTENANCE] No tokens close to expiry");
      }
    } catch (error) {
      logger.error(
        "[BOT-MAINTENANCE] Error renewing tokens:",
        error.message,
      );
    }
  }

  /**
   * Simulates chat activity to keep the bot active
   */
  async simulateChatActivity() {
    try {
      // Only simulate activity if enabled
      const simulateActivity =
        process.env.BOT_MAINTENANCE_SIMULATE_ACTIVITY === "true";

      if (!simulateActivity) {
        return; // Do not simulate activity
      }

      logger.info("[BOT-MAINTENANCE] Simulating chat activity...");

      // NOTE: We no longer simulate hardcoded commands
      // Commands are now dynamic from the database
      // If you need to simulate activity, use the dynamic !tienda command from the DB
      logger.info(
        "[BOT-MAINTENANCE] Activity simulation disabled - commands are now dynamic",
      );
    } catch (error) {
      logger.error(
        "[BOT-MAINTENANCE] Error in activity simulation:",
        error.message,
      );
    }
  }

  /**
   * Gets service statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.intervalMinutes,
      nextExecution: this.intervalId
        ? new Date(Date.now() + this.intervalMinutes * 60 * 1000)
        : null,
    };
  }
}

// Export singleton instance
const botMaintenanceService = new BotMaintenanceService();
module.exports = botMaintenanceService;
