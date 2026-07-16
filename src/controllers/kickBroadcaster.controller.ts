/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import { KickBroadcasterToken, KickEventSubscription } from "../models";
import tokenRefreshService from "../services/tokenRefresh.service";
import config from "../../config";
import logger from "../utils/logger";
import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/AppError";

/**
 * Checks the broadcaster connection status
 */
const getConnectionStatus = asyncHandler(async (req: any, res: any) => {
  try {
    // Get the main broadcaster from configuration
    const mainBroadcasterId = config.kick.broadcasterId;

    if (!mainBroadcasterId) {
      return res.json({
        connected: false,
        message: "No main broadcaster configured",
      });
    }

    // Check active subscriptions (can use App Token or User Token)
    logger.info(
      `[Broadcaster Status] Looking for subscriptions for broadcaster ${mainBroadcasterId}`
    );

    const subscriptions: any = await KickEventSubscription.findAll({
      where: {
        broadcaster_user_id: Number.parseInt(mainBroadcasterId),
        status: "active",
      },
    });

    logger.info(
      `[Broadcaster Status] Subscriptions found: ${subscriptions.length}`
    );

    // If there are active subscriptions, the system is connected (App Token or User Token)
    if (subscriptions.length > 0) {
      logger.debug(
        `[Broadcaster Status] Events:`,
        subscriptions.map((s: any) => s.event_type)
      );

      // Check if it's a permanent system (App Token) or temporary (User Token)
      const appTokenSubscriptions = subscriptions.filter(
        (s: any) => s.app_id === "APP_TOKEN"
      );
      const isPermanent = appTokenSubscriptions.length > 0;

      return res.json({
        connected: true,
        system_type: isPermanent ? "PERMANENT" : "TEMPORARY",
        broadcaster: {
          kick_user_id: mainBroadcasterId,
          kick_username: "Luisardito",
          connected_at: subscriptions[0].created_at,
          last_updated: new Date(),
        },
        token: {
          type: isPermanent
            ? "App Token (Permanent)"
            : "User Token (Temporary)",
          expires_at: isPermanent ? null : "Varies by user token",
          is_expired: false,
          requires_maintenance: !isPermanent,
        },
        subscriptions: {
          auto_subscribed: true,
          total_active: subscriptions.length,
          permanent_webhooks: isPermanent,
          events: subscriptions.map((s: any) => ({
            event_type: s.event_type,
            event_version: s.event_version,
            subscription_id: s.subscription_id,
            token_type: s.app_id === "APP_TOKEN" ? "App Token" : "User Token",
            created_at: s.created_at,
          })),
        },
      });
    }

    // If no subscriptions, check user tokens as fallback
    const broadcasterToken: any = await KickBroadcasterToken.findOne({
      where: { is_active: true },
      order: [["created_at", "DESC"]],
    });

    if (!broadcasterToken) {
      return res.json({
        connected: false,
        system_type: "DISCONNECTED",
        message: "No active tokens or subscriptions available",
      });
    }

    // Check if the token expired
    const now = new Date();
    const isTokenExpired =
      broadcasterToken.token_expires_at &&
      broadcasterToken.token_expires_at < now;

    return res.json({
      connected: true,
      system_type: "TEMPORARY",
      broadcaster: {
        kick_user_id: mainBroadcasterId,
        kick_username: "Luisardito",
        connected_at: broadcasterToken.created_at,
        last_updated: broadcasterToken.updated_at,
      },
      token: {
        type: "User Token (Temporary)",
        expires_at: broadcasterToken.token_expires_at,
        is_expired: isTokenExpired,
        has_refresh_token: !!broadcasterToken.refresh_token,
        provided_by: broadcasterToken.kick_username,
        requires_maintenance: true,
      },
      subscriptions: {
        auto_subscribed: broadcasterToken.auto_subscribed,
        total_active: 0,
        permanent_webhooks: false,
        last_attempt: broadcasterToken.last_subscription_attempt,
        error: broadcasterToken.subscription_error,
        events: [],
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Broadcaster] Error fetching status:", error.message);
    throw new AppError("Internal server error", 500);
  }
});

/**
 * Disconnects the broadcaster (deactivates the token)
 */
const disconnect = asyncHandler(async (req: any, res: any) => {
  try {
    const mainBroadcasterId = config.kick.broadcasterId;

    const broadcasterToken: any = await KickBroadcasterToken.findOne({
      where: { is_active: true },
      order: [["created_at", "DESC"]],
    });

    if (!broadcasterToken) {
      throw new AppError("No broadcaster connected", 404);
    }

    await broadcasterToken.update({
      is_active: false,
    });

    // Deactivate subscriptions for the main broadcaster
    if (mainBroadcasterId) {
      await KickEventSubscription.update(
        { status: "inactive" },
        {
          where: {
            broadcaster_user_id: Number.parseInt(mainBroadcasterId),
            status: "active",
          },
        }
      );
    }

    return res.json({
      message: "Broadcaster disconnected successfully",
      broadcaster: "Luisardito",
      token_provider: broadcasterToken.kick_username,
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Broadcaster] Error disconnecting:", error.message);
    throw new AppError("Internal server error", 500);
  }
});

/**
 * Gets the active broadcaster token (internal/admin use only)
 */
const getActiveToken = asyncHandler(async (req: any, res: any) => {
  try {
    const broadcasterToken: any = await KickBroadcasterToken.findOne({
      where: { is_active: true },
      order: [["created_at", "DESC"]],
    });

    if (!broadcasterToken) {
      throw new AppError("No broadcaster connected", 404);
    }

    // Do not expose the full token for security
    return res.json({
      kick_user_id: broadcasterToken.kick_user_id,
      kick_username: broadcasterToken.kick_username,
      token_preview: broadcasterToken.access_token
        ? `${broadcasterToken.access_token.substring(0, 10)}...`
        : null,
      token_expires_at: broadcasterToken.token_expires_at,
      has_refresh_token: !!broadcasterToken.refresh_token,
      auto_subscribed: broadcasterToken.auto_subscribed,
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Broadcaster] Error fetching token:", error.message);
    throw new AppError("Internal server error", 500);
  }
});

/**
 * Manually refreshes the active broadcaster token
 */
const refreshToken = asyncHandler(async (req: any, res: any) => {
  try {
    const broadcasterToken: any = await KickBroadcasterToken.findOne({
      where: { is_active: true },
      order: [["created_at", "DESC"]],
    });

    if (!broadcasterToken) {
      throw new AppError("No broadcaster connected", 404);
    }

    const result = await tokenRefreshService.forceRefresh(
      broadcasterToken.kick_user_id
    );

    if (result.success) {
      // Reload the updated token
      await broadcasterToken.reload();

      return res.json({
        message: "Token refreshed successfully",
        broadcaster: broadcasterToken.kick_username,
        new_expires_at: broadcasterToken.token_expires_at,
      });
    } else {
      throw new AppError("Could not refresh the token", 400, result.error);
    }
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error("[Kick Broadcaster] Error refreshing token:", error.message);
    throw new AppError("Internal server error", 500);
  }
});

/**
 * Gets the status of the automatic refresh service
 */
const getRefreshServiceStatus = asyncHandler(async (req: any, res: any) => {
  try {
    const status = tokenRefreshService.getStatus();
    return res.json(status);
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error(
      "[Kick Broadcaster] Error fetching service status:",
      error.message
    );
    throw new AppError("Internal server error", 500);
  }
});

/**
 * Debug endpoint to verify configuration
 */
const debugConfig = asyncHandler(async (req: any, res: any) => {
  try {
    return res.json({
      config: {
        broadcasterId: config.kick.broadcasterId,
        hasBroadcasterId: !!config.kick.broadcasterId,
        nodeEnv: process.env.NODE_ENV,
        kickBroadcasterIdEnv: process.env.KICK_BROADCASTER_ID,
      },
      tokenCount: await KickBroadcasterToken.count({
        where: { is_active: true },
      }),
      subscriptionCount: await KickEventSubscription.count({
        where: { status: "active" },
      }),
      subscriptionsByBroadcaster: await KickEventSubscription.count({
        where: {
          broadcaster_user_id: config.kick.broadcasterId
            ? Number.parseInt(config.kick.broadcasterId)
            : null,
          status: "active",
        },
      }),
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message, 500);
  }
});

export {
  getConnectionStatus,
  disconnect,
  getActiveToken,
  refreshToken,
  getRefreshServiceStatus,
  debugConfig,
};

export default {
  getConnectionStatus,
  disconnect,
  getActiveToken,
  refreshToken,
  getRefreshServiceStatus,
  debugConfig,
};
