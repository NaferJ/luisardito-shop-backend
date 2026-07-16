/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import cron from "node-cron";
import DbCleanupService from "./dbCleanup.service";
import logger from "../utils/logger";
/**
 * Scheduled database cleanup task.
 * Runs daily at 4:30 AM (before the 3:00 AM backup of the following day).
 *
 * Cleans:
 *  - kick_webhook_events processed > 7 days
 *  - historial_puntos: JSON > 30 days, chat records > 90 days
 *  - notificaciones read > 60 days, unread > 120 days
 *  - refresh_tokens revoked and expired > 7 days
 */
class DbCleanupTask {
  scheduledTask: any;
  constructor() {
    this.scheduledTask = null;
  }
  /**
   * Starts the scheduled cleanup task
   */
  start() {
    const cronExpression = "30 4 * * *";
    logger.info("[DB-CLEANUP] Scheduling daily cleanup at 04:30");
    this.scheduledTask = cron.schedule(cronExpression, async () => {
      logger.info("[DB-CLEANUP] Running scheduled cleanup...");
      try {
        const results = await DbCleanupService.runAll();
        logger.info(
          "[DB-CLEANUP] Scheduled cleanup completed:",
          JSON.stringify(results)
        );
      } catch (error: any) {
        logger.error("[DB-CLEANUP] Error in scheduled cleanup:", error);
      }
    });
    logger.info("[DB-CLEANUP] Scheduled cleanup task started");
  }
  /**
   * Stops the scheduled task
   */
  stop() {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      logger.info("[DB-CLEANUP] Cleanup task stopped");
    }
  }
  /**
   * Runs a manual cleanup (useful for testing or immediate execution)
   */
  async runManual() {
    logger.info("[DB-CLEANUP] Manual execution requested");
    return await DbCleanupService.runAll();
  }
}
export default new DbCleanupTask();
