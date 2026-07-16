import cron, { type ScheduledTask } from "node-cron";
import backupService from "./backup.service";
import logger from "../utils/logger";

class BackupScheduler {
  scheduledTask: ScheduledTask | null = null;

  /**
   * Starts the automatic backup scheduler
   */
  start() {
    const backupTime = process.env.BACKUP_TIME || "03:00";
    const enabled = process.env.BACKUP_ENABLED === "true";

    if (!enabled) {
      logger.info("Backup scheduler disabled");
      return;
    }

    // Parse time (HH:mm format)
    const [hour, minute] = backupTime.split(":");

    // Cron expression: "minute hour * * *"
    const cronExpression = `${minute} ${hour} * * *`;

    logger.info(`Scheduling daily backup at ${backupTime}`);

    this.scheduledTask = cron.schedule(cronExpression, async () => {
      logger.info("Running scheduled backup...");

      try {
        const result = await backupService.createBackup();

        if (result.success) {
          logger.info(`Scheduled backup completed: ${result.filename}`);
        } else {
          logger.error(
            `Scheduled backup failed: ${result.error || result.reason}`
          );
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("Error in scheduled backup:", msg);
      }
    });

    logger.info(`Backup scheduler started (${cronExpression})`);
  }

  /**
   * Stops the scheduler
   */
  stop() {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      logger.info("Backup scheduler stopped");
    }
  }

  /**
   * Runs a manual backup immediately
   */
  async runManualBackup() {
    logger.info("Running manual backup...");
    return await backupService.createBackup();
  }
}

export = new BackupScheduler();
