import cron from "node-cron";
import VipService from "../services/vip.service";
import logger from "../utils/logger";

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
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("[VIP CLEANUP] Error in automatic cleanup:", msg);
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
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[VIP CLEANUP] Error in manual cleanup:", msg);
      throw error;
    }
  }
}

export = VipCleanupTask;
