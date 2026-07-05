const cron = require("node-cron");
const VipService = require("../services/vip.service");
const logger = require("../utils/logger");

class VipCleanupTask {
  static start() {
    // Run every day at 3:00 AM
    cron.schedule("0 3 * * *", async () => {
      try {
        logger.info("[VIP CLEANUP] Starting expired VIP cleanup...");
        const result = await VipService.cleanupExpiredVips();
        logger.info(
          `[VIP CLEANUP] Completed: ${result.cleaned_count} expired VIPs removed`
        );
      } catch (error) {
        logger.error("[VIP CLEANUP] Error in automatic cleanup:", error);
      }
    });

    logger.info(
      "[VIP CLEANUP] Automatic task scheduled (every day at 3:00 AM)"
    );
  }

  static async runManually() {
    try {
      logger.info("[VIP CLEANUP] Running manual cleanup...");
      const result = await VipService.cleanupExpiredVips();
      logger.info(
        `[VIP CLEANUP] Manual completed: ${result.cleaned_count} expired VIPs removed`
      );
      return result;
    } catch (error) {
      logger.error("[VIP CLEANUP] Error in manual cleanup:", error);
      throw error;
    }
  }
}

module.exports = VipCleanupTask;
