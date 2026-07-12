const axios = require("axios");
const config = require("../../config");
const { KickEventSubscription, KickBroadcasterToken } = require("../models");
const logger = require("../utils/logger");

// In-flight refresh promises keyed by broadcaster identity (single-flight guard)
const refreshInFlight = new Map();

/**
 * List of events to auto-subscribe to
 */
const DEFAULT_EVENTS = [
  { name: "chat.message.sent", version: 1 },
  { name: "channel.followed", version: 1 },
  { name: "channel.subscription.new", version: 1 },
  { name: "channel.subscription.renewal", version: 1 },
  { name: "channel.subscription.gifts", version: 1 },
  { name: "livestream.status.updated", version: 1 },
  { name: "livestream.metadata.updated", version: 1 },
  { name: "kicks.gifted", version: 1 },
  { name: "channel.reward.redemption.updated", version: 1 },
];

/**
 * Auto-subscribes to all broadcaster events
 * @param {string} accessToken - Access token to make the request
 * @param {string} broadcasterUserId - Broadcaster ID to listen events from
 * @param {string} tokenProviderId - ID of the user providing the token (optional, defaults to broadcaster)
 * @returns {Promise<Object>} Subscription result
 */
async function processSubscriptionResults(
  subscriptionsData,
  broadcasterUserId
) {
  const createdSubscriptions = [];
  const errors = [];

  logger.info(
    `[Auto Subscribe] Processing ${subscriptionsData.length} subscriptions received from Kick`
  );

  for (const sub of subscriptionsData) {
    if (sub.subscription_id && !sub.error) {
      try {
        let localSub = await KickEventSubscription.findOne({
          where: { subscription_id: sub.subscription_id },
        });

        if (localSub) {
          await localSub.update({
            broadcaster_user_id: Number.parseInt(broadcasterUserId),
            event_type: sub.name,
            event_version: sub.version,
            method: "webhook",
            status: "active",
          });
          logger.info(
            `[Auto Subscribe] ${sub.name} updated (ID: ${localSub.id})`
          );
        } else {
          localSub = await KickEventSubscription.create({
            subscription_id: sub.subscription_id,
            broadcaster_user_id: Number.parseInt(broadcasterUserId),
            event_type: sub.name,
            event_version: sub.version,
            method: "webhook",
            status: "active",
          });
          logger.info(
            `[Auto Subscribe] ${sub.name} created (ID: ${localSub.id})`
          );
        }

        createdSubscriptions.push(localSub);
      } catch (dbError) {
        logger.error(`[Auto Subscribe] DB error ${sub.name}:`, dbError.message);
        errors.push({ event: sub.name, error: dbError.message });
      }
    } else if (sub.error) {
      errors.push({ event: sub.name, error: sub.error });
      logger.error(`[Auto Subscribe] ${sub.name}:`, sub.error);
    }
  }

  return { createdSubscriptions, errors };
}

async function autoSubscribeToEvents(
  accessToken,
  broadcasterUserId,
  tokenProviderId = null
) {
  try {
    const actualTokenProvider = tokenProviderId || broadcasterUserId;

    logger.info(
      `[Auto Subscribe] Configuring events for broadcaster ${broadcasterUserId}`
    );

    // Ensure we have a valid token from the token provider
    const validToken = await ensureValidToken(actualTokenProvider);
    if (!validToken) {
      throw new Error(
        `Could not get a valid token from user ${actualTokenProvider}`
      );
    }

    const apiUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;

    const payload = {
      broadcaster_user_id: Number.parseInt(broadcasterUserId),
      events: DEFAULT_EVENTS,
      method: "webhook",
      webhook_url: "https://api.luisardito.com/api/kick-webhook/events",
    };

    const response = await axios.post(apiUrl, payload, {
      headers: {
        Authorization: `Bearer ${validToken}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    const subscriptionsData = response.data.data || [];
    const { createdSubscriptions, errors } = await processSubscriptionResults(
      subscriptionsData,
      broadcasterUserId
    );

    // Update token provider record
    await KickBroadcasterToken.update(
      {
        auto_subscribed: createdSubscriptions.length > 0,
        last_subscription_attempt: new Date(),
        subscription_error: errors.length > 0 ? JSON.stringify(errors) : null,
      },
      {
        where: {
          kick_user_id: actualTokenProvider,
          is_active: true,
        },
      }
    );

    const result = {
      success: createdSubscriptions.length > 0,
      totalSubscribed: createdSubscriptions.length,
      totalErrors: errors.length,
      subscriptions: createdSubscriptions,
      errors,
      kickResponse: response.data,
    };

    logger.info(
      `[Auto Subscribe] Completed: ${result.totalSubscribed} events configured`
    );

    return result;
  } catch (error) {
    logger.error("[Auto Subscribe] Error:", error.message);

    // Update the error in the database
    await KickBroadcasterToken.update(
      {
        auto_subscribed: false,
        last_subscription_attempt: new Date(),
        subscription_error: error.message,
      },
      {
        where: {
          kick_user_id: broadcasterUserId,
          is_active: true,
        },
      }
    );

    if (error.response) {
      logger.error(
        "[Auto Subscribe] API Error:",
        error.response.status,
        error.response.data
      );

      return {
        success: false,
        error: error.response.data,
        status: error.response.status,
        message: "Error communicating with the Kick API",
      };
    }

    return {
      success: false,
      error: error.message,
      message: "Network error or timeout",
    };
  }
}

/**
 * Checks if there is already an active subscription for a broadcaster
 * @param {string} broadcasterUserId - Broadcaster ID
 * @returns {Promise<boolean>}
 */
async function hasActiveSubscriptions(broadcasterUserId) {
  const count = await KickEventSubscription.count({
    where: {
      broadcaster_user_id: Number.parseInt(broadcasterUserId),
      status: "active",
    },
  });

  return count > 0;
}

/**
 * Internal refresh implementation. Callers should use refreshAccessToken()
 * which adds the single-flight guard.
 * @param {Object} broadcasterToken - Broadcaster token instance
 * @returns {Promise<boolean>} True if refreshed successfully
 */
async function performBroadcasterRefresh(broadcasterToken) {
  try {
    if (!broadcasterToken.refresh_token) {
      logger.error("[Token Refresh] No refresh token available");
      return false;
    }

    logger.info(
      `[Token Refresh] Renewing token for ${broadcasterToken.kick_username}`
    );

    const refreshUrl = `${config.kick.apiBaseUrl}/oauth/token`;

    const payload = {
      grant_type: "refresh_token",
      client_id: config.kick.clientId,
      client_secret: config.kick.clientSecret,
      refresh_token: broadcasterToken.refresh_token,
    };

    const response = await axios.post(refreshUrl, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    if (response.data.access_token) {
      const newExpiresAt = new Date(
        Date.now() + response.data.expires_in * 1000
      );

      await broadcasterToken.update({
        access_token: response.data.access_token,
        refresh_token:
          response.data.refresh_token || broadcasterToken.refresh_token,
        token_expires_at: newExpiresAt,
      });

      logger.info(`[Token Refresh] Token renewed successfully`);
      return true;
    }

    return false;
  } catch (error) {
    logger.error("[Token Refresh] Error renewing token:", error.message);
    if (error.response) {
      logger.error(
        "[Token Refresh] API Error:",
        error.response.status,
        error.response.data
      );

      if (error.response.status === 400 || error.response.status === 401) {
        try {
          await broadcasterToken.update({
            is_active: false,
            subscription_error: "Token expired and could not be refreshed",
          });
        } catch (dbError) {
          logger.error(
            "[Token Refresh] Error deactivating token:",
            dbError.message
          );
        }
      }
    }
    return false;
  }
}

/**
 * Refreshes the access token using the refresh token.
 * Concurrent calls for the same broadcaster share a single in-flight
 * network request (single-flight) to avoid race conditions caused by
 * Kick's rotating refresh tokens.
 * @param {Object} broadcasterToken - Broadcaster token instance
 * @returns {Promise<boolean>} True if refreshed successfully
 */
function refreshAccessToken(broadcasterToken) {
  const key =
    broadcasterToken.id ??
    broadcasterToken.kick_user_id ??
    broadcasterToken.kick_username;

  if (refreshInFlight.has(key)) {
    return refreshInFlight.get(key);
  }

  const promise = performBroadcasterRefresh(broadcasterToken).finally(() => {
    refreshInFlight.delete(key);
  });

  refreshInFlight.set(key, promise);
  return promise;
}

/**
 * Verifies and refreshes the token if necessary
 * @param {string} broadcasterUserId - Broadcaster ID
 * @returns {Promise<string|null>} Valid access token or null
 */
async function ensureValidToken(broadcasterUserId) {
  try {
    const broadcasterToken = await KickBroadcasterToken.findOne({
      where: {
        kick_user_id: broadcasterUserId,
        is_active: true,
      },
    });

    if (!broadcasterToken) {
      logger.error(
        "[Token Ensure] No active token found for:",
        broadcasterUserId
      );
      return null;
    }

    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
    const expiresAt = new Date(broadcasterToken.token_expires_at);

    // If the token expires in less than 5 minutes, refresh it
    if (expiresAt.getTime() - now.getTime() < bufferTime) {
      logger.info("[Token Ensure] Renewing token about to expire...");
      const refreshed = await refreshAccessToken(broadcasterToken);

      if (!refreshed) {
        logger.error("[Token Ensure] Could not refresh the token");
        return null;
      }

      // Reload the updated token
      await broadcasterToken.reload();
    }

    return broadcasterToken.access_token;
  } catch (error) {
    logger.error("[Token Ensure] Error:", error.message);
    return null;
  }
}

module.exports = {
  autoSubscribeToEvents,
  hasActiveSubscriptions,
  refreshAccessToken,
  ensureValidToken,
  DEFAULT_EVENTS,
  refreshInFlight,
};
