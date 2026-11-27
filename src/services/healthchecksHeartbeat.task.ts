import cron, { type ScheduledTask } from "node-cron";
import config from "../../config";
import { sequelize } from "../models/database";
import logger from "../utils/logger";
import { pingHealthcheck } from "./healthchecks.service";

function databaseErrorCode(error: unknown): string {
  return (
    (error as { parent?: { code?: string }; name?: string })?.parent?.code ||
    (error as { name?: string })?.name ||
    "UNKNOWN_ERROR"
  );
}

/**
 * Scheduled healthchecks.io heartbeat.
 * Reports failure when the database check cannot authenticate.
 */
class HealthchecksHeartbeatTask {
  scheduledTask: ScheduledTask | null = null;
  isRunning = false;

  /**
   * Starts the heartbeat scheduler when a heartbeat URL is configured.
   */
  start() {
    if (!config.monitoring?.healthchecks?.heartbeatUrl) {
      logger.info("[Healthchecks] Heartbeat URL not set, task disabled");
      return;
    }

    if (this.scheduledTask) {
      logger.info("[Healthchecks] Heartbeat already scheduled");
      return;
    }

    this.scheduledTask = cron.schedule("*/5 * * * *", () => {
      void this.run();
    });
    logger.info("[Healthchecks] Scheduled heartbeat every 5 minutes");
  }

  /**
   * Stops the heartbeat scheduler.
   */
  stop() {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
    }
  }

  /**
   * Runs a single database heartbeat check.
   */
  async run() {
    const heartbeatUrl = config.monitoring?.healthchecks?.heartbeatUrl;
    if (!heartbeatUrl) return;

    if (this.isRunning) {
      logger.info("[Healthchecks] Previous heartbeat still running");
      return;
    }

    this.isRunning = true;
    try {
      let databaseHealthy = true;
      try {
        await sequelize.authenticate();
      } catch (error) {
        databaseHealthy = false;
        logger.error(
          `[Healthchecks] Database heartbeat check failed [${databaseErrorCode(error)}]`
        );
      }

      await pingHealthcheck(heartbeatUrl, !databaseHealthy);
    } catch (error) {
      logger.error(
        `[Healthchecks] Heartbeat task error [${databaseErrorCode(error)}]`
      );
    } finally {
      this.isRunning = false;
    }
  }
}

export = new HealthchecksHeartbeatTask();
