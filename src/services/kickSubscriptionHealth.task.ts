import cron, { type ScheduledTask } from "node-cron";
import config from "../../config";
import { ensureWebhookSubscriptions } from "./kickAppToken.service";
import logger from "../utils/logger";
import toErrorMessage from "../utils/toErrorMessage";

/**
 * Scheduled Kick webhook subscription health check.
 * Runs on startup and every hour. Kick unsubscribes webhooks that keep
 * failing for over a day, so any dropped event is re-subscribed here.
 */
class KickSubscriptionHealthTask {
  scheduledTask: ScheduledTask | null = null;
  isRunning = false;

  /**
   * Starts the scheduled health check
   */
  start() {
    if (this.scheduledTask) {
      logger.info("[Subscription Health] Already scheduled");
      return;
    }

    if (!config.kick.broadcasterId) {
      logger.warn(
        "[Subscription Health] KICK_BROADCASTER_ID not set, task disabled"
      );
      return;
    }

    void this.run();
    this.scheduledTask = cron.schedule("15 * * * *", () => {
      void this.run();
    });
    logger.info("[Subscription Health] Scheduled hourly check at minute 15");
  }

  /**
   * Stops the scheduled task
   */
  stop() {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
    }
  }

  /**
   * Runs a single health check
   */
  async run() {
    if (this.isRunning) {
      logger.info("[Subscription Health] Previous check still running");
      return null;
    }

    this.isRunning = true;
    try {
      const result = await ensureWebhookSubscriptions(
        String(config.kick.broadcasterId)
      );
      logger.info("[Subscription Health] Check completed:", result);
      return result;
    } catch (error) {
      logger.error("[Subscription Health] Error:", toErrorMessage(error));
      return null;
    } finally {
      this.isRunning = false;
    }
  }
}

export = new KickSubscriptionHealthTask();
