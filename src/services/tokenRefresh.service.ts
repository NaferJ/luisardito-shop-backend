import { refreshAccessToken } from "./kickAutoSubscribe.service";
import { KickBroadcasterToken } from "../models";
import logger from "../utils/logger";

class TokenRefreshService {
  isRunning: boolean = false;
  intervalId: NodeJS.Timeout | null = null;
  intervalMs: number = 30 * 60 * 1000; // 30 minutes in milliseconds

  /**
   * Starts the automatic token refresh service
   */
  start() {
    if (this.isRunning) {
      logger.info("[Token Refresh Service] Already running");
      return;
    }

    logger.info("[Token Refresh Service] Starting service...");

    // Run immediately on start
    this.checkAndRefreshTokens();

    // Schedule execution every 30 minutes
    this.intervalId = setInterval(() => {
      this.checkAndRefreshTokens();
    }, this.intervalMs);

    this.isRunning = true;

    logger.info(
      "[Token Refresh Service] Service started - will check tokens every 30 minutes"
    );
  }

  /**
   * Stops the service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info("[Token Refresh Service] Service stopped");
  }

  /**
   * Checks and refreshes tokens that are about to expire
   */
  async checkAndRefreshTokens() {
    try {
      logger.info("[Token Refresh Service] Checking tokens...");

      const activeTokens = await KickBroadcasterToken.findAll({
        where: { is_active: true },
      });

      if (activeTokens.length === 0) {
        logger.info("[Token Refresh Service] No active tokens");
        return;
      }

      for (const token of activeTokens) {
        await this.checkTokenExpiration(token);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[Token Refresh Service] Error checking tokens:", msg);
    }
  }

  /**
   * Checks if a specific token needs to be refreshed
   */
  async checkTokenExpiration(broadcasterToken: KickBroadcasterToken) {
    try {
      const now = new Date();
      const bufferTime = 60 * 60 * 1000; // 1 hour buffer
      const expiresAt = new Date(broadcasterToken.token_expires_at as Date);

      logger.info(
        `[Token Refresh Service] Checking token for ${broadcasterToken.kick_username}`
      );
      logger.info(`[Token Refresh Service] Expires: ${expiresAt}, Now: ${now}`);

      // If the token expires in less than 1 hour, refresh it
      if (expiresAt.getTime() - now.getTime() < bufferTime) {
        logger.info(
          `[Token Refresh Service] Token for ${broadcasterToken.kick_username} expiring soon, refreshing...`
        );

        const refreshed = await refreshAccessToken(broadcasterToken);

        if (refreshed) {
          logger.info(
            `[Token Refresh Service] Token for ${broadcasterToken.kick_username} refreshed successfully`
          );
        } else {
          logger.error(
            `[Token Refresh Service] Could not refresh token for ${broadcasterToken.kick_username}`
          );

          // Mark as inactive if it cannot be refreshed
          await broadcasterToken.update({
            is_active: false,
            subscription_error: "Token expired and could not be refreshed",
          });
        }
      } else {
        logger.info(
          `[Token Refresh Service] Token for ${broadcasterToken.kick_username} still valid`
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        `[Token Refresh Service] Error checking token for ${broadcasterToken.kick_username}:`,
        msg
      );
    }
  }

  /**
   * Forces refresh of a specific token
   */
  async forceRefresh(kickUserId: string) {
    try {
      const token = await KickBroadcasterToken.findOne({
        where: {
          kick_user_id: kickUserId,
          is_active: true,
        },
      });

      if (!token) {
        throw new Error("Token not found");
      }

      logger.info(
        `[Token Refresh Service] Forcing refresh of token for ${token.kick_username}`
      );
      const success = await refreshAccessToken(token);

      if (success) {
        logger.info(
          `[Token Refresh Service] Forced refresh successful for ${token.kick_username}`
        );
        return { success: true, message: "Token refreshed successfully" };
      } else {
        throw new Error("Could not refresh the token");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[Token Refresh Service] Error in forced refresh:", msg);
      return { success: false, error: msg };
    }
  }

  /**
   * Gets the service status
   */
  getStatus() {
    const nextExecution = this.isRunning
      ? new Date(Date.now() + this.intervalMs)
      : null;

    return {
      isRunning: this.isRunning,
      intervalMinutes: this.intervalMs / (60 * 1000),
      nextExecution: nextExecution,
      lastCheck: new Date(),
    };
  }
}

// Singleton instance
const tokenRefreshService = new TokenRefreshService();

export = tokenRefreshService;
