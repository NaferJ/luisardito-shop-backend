/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass
import leaderboardService from "./leaderboard.service";
import logger from "../utils/logger";
import { Op } from "sequelize";
import LeaderboardSnapshot from "../models/leaderboardSnapshot.model";

class LeaderboardSnapshotTask {
  intervalId: any;
  isRunning: boolean;
  intervalHours: number;
  cleanupDays: number;
  _lastCleanupDate: any;

  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    // Configuration: run every 6 hours by default
    this.intervalHours =
      Number.parseInt(process.env.LEADERBOARD_SNAPSHOT_INTERVAL_HOURS as any) ||
      6;
    this.cleanupDays =
      Number.parseInt(process.env.LEADERBOARD_CLEANUP_DAYS as any) || 30;
  }

  /**
   * Starts the scheduled snapshot task
   */
  start() {
    if (this.isRunning) {
      logger.warn("[LEADERBOARD-SNAPSHOT] Task is already running");
      return;
    }

    logger.info(
      `[LEADERBOARD-SNAPSHOT] Starting scheduled task (every ${this.intervalHours} hours)`
    );

    // Do NOT run immediately on start to avoid accidental cleanup on every restart
    // Only run on the scheduled interval
    // this._executeSnapshot();

    // Schedule periodic execution
    const intervalMs = this.intervalHours * 60 * 60 * 1000;
    this.intervalId = setInterval(() => {
      this._executeSnapshot();
    }, intervalMs);

    this.isRunning = true;

    logger.info(`[LEADERBOARD-SNAPSHOT] Scheduled task started successfully`);
  }

  /**
   * Stops the scheduled task
   */
  stop() {
    if (!this.isRunning) {
      logger.warn("[LEADERBOARD-SNAPSHOT] Task is not running");
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info("[LEADERBOARD-SNAPSHOT] Scheduled task stopped");
  }

  /**
   * Executes the snapshot and cleanup of old data
   * @private
   */
  async _executeSnapshot() {
    try {
      logger.info("[LEADERBOARD-SNAPSHOT] Starting leaderboard snapshot...");

      // 1. Create snapshot of current leaderboard
      const snapshotResult = await leaderboardService.createSnapshot();

      if (snapshotResult.success) {
        logger.info(
          `[LEADERBOARD-SNAPSHOT] Snapshot created: ${snapshotResult.users_count} users registered`
        );
      }

      // 2. Clean old snapshots only if there is data to clean
      const shouldCleanup = await this._shouldCleanup();
      if (shouldCleanup) {
        logger.info(
          `[LEADERBOARD-SNAPSHOT] Starting old snapshot cleanup (>${this.cleanupDays} days)...`
        );

        const cleanupResult = await leaderboardService.cleanOldSnapshots(
          this.cleanupDays
        );

        if (cleanupResult.success) {
          logger.info(
            `[LEADERBOARD-SNAPSHOT] Cleanup completed: ${cleanupResult.deleted_count} records removed`
          );
        }
      } else {
        logger.info("[LEADERBOARD-SNAPSHOT] No old snapshots to clean");
      }
    } catch (error: any) {
      logger.error("[LEADERBOARD-SNAPSHOT] Error executing snapshot:", error);
      // Do not throw the error so the task continues running
    }
  }

  /**
   * Checks if old snapshot cleanup should run
   * Queries the database directly to determine if there are snapshots
   * older than the configured retention period
   * @private
   */
  async _shouldCleanup() {
    try {
      // Calculate retention cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.cleanupDays);

      // Check if there are snapshots older than the cutoff
      const oldSnapshotsCount = await LeaderboardSnapshot.count({
        where: {
          snapshot_date: {
            [Op.lt]: cutoffDate,
          },
        },
      });

      // Only run cleanup if there are old snapshots
      return oldSnapshotsCount > 0;
    } catch (error: any) {
      logger.error(
        "[LEADERBOARD-SNAPSHOT] Error checking cleanup need:",
        error
      );
      return false; // On error, do not run cleanup for safety
    }
  }

  /**
   * Gets the last cleanup date (deprecated - kept for compatibility)
   * @private
   * @deprecated No longer used, logic now queries the DB directly
   */
  _getLastCleanupDate() {
    if (!this._lastCleanupDate) {
      return null;
    }
    return this._lastCleanupDate;
  }

  /**
   * Marks that cleanup was executed (deprecated - kept for compatibility)
   * @private
   * @deprecated No longer used, logic now queries the DB directly
   */
  _markCleanupDone() {
    this._lastCleanupDate = new Date();
  }

  /**
   * Executes a manual snapshot (useful for testing)
   */
  async executeManual() {
    logger.info("[LEADERBOARD-SNAPSHOT] Manual execution requested");
    await this._executeSnapshot();
  }

  /**
   * Gets the current task status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalHours: this.intervalHours,
      cleanupDays: this.cleanupDays,
      lastCleanup: this._lastCleanupDate || null,
      nextSnapshot: this.intervalId
        ? new Date(Date.now() + this.intervalHours * 60 * 60 * 1000)
        : null,
    };
  }
}

export default new LeaderboardSnapshotTask();
