import axios, { type AxiosResponse } from "axios";
import config from "../../config";
import { KickEventSubscription, KickBroadcasterToken } from "../models";
import logger from "../utils/logger";
import toErrorMessage from "../utils/toErrorMessage";

// In-flight refresh promises keyed by broadcaster identity (single-flight guard)
const refreshInFlight = new Map<string, Promise<boolean>>();

interface KickSubscriptionData {
  subscription_id: string;
  name: string;
  version: number;
  error?: string;
}

interface KickSubscriptionResponse {
  data: KickSubscriptionData[];
}

interface SubscriptionResult {
  success: boolean;
  totalSubscribed: number;
  totalErrors: number;
  subscriptions: KickEventSubscription[];
  errors: { event: string; error: string }[];
  kickResponse: KickSubscriptionResponse;
}

interface SubscriptionErrorResult {
  success: false;
  error: unknown;
  status?: number;
  message: string;
}

interface TokenRefreshResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

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
 * @param accessToken - Access token to make the request
 * @param broadcasterUserId - Broadcaster ID to listen events from
 * @param tokenProviderId - ID of the user providing the token (optional, defaults to broadcaster)
 * @returns Subscription result
 */
async function processSubscriptionResults(
  subscriptionsData: KickSubscriptionData[],
  broadcasterUserId: string
) {
  const createdSubscriptions: KickEventSubscription[] = [];
  const errors: { event: string; error: string }[] = [];

  logger.info(
    `[Auto Subscribe] Processing ${subscriptionsData.length} subscriptions received from Kick`
  );

  for (const sub of subscriptionsData) {
    const result = await processSingleSubscription(sub, broadcasterUserId);
    if (result.subscription) {
      createdSubscriptions.push(result.subscription);
    }
    if (result.error) {
      errors.push(result.error);
    }
  }

  return { createdSubscriptions, errors };
}

/**
 * Process a single subscription entry from Kick: upsert it to the database
 * or record an error if Kick reported one or the DB write failed.
 * @param sub - Subscription entry returned by Kick
 * @param broadcasterUserId - Broadcaster ID
 * @returns The created/updated subscription and/or an error entry
 */
async function processSingleSubscription(
  sub: KickSubscriptionData,
  broadcasterUserId: string
): Promise<{
  subscription: KickEventSubscription | null;
  error: { event: string; error: string } | null;
}> {
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

      return { subscription: localSub, error: null };
    } catch (dbError: unknown) {
      const msg = toErrorMessage(dbError);
      logger.error(`[Auto Subscribe] DB error ${sub.name}:`, msg);
      return { subscription: null, error: { event: sub.name, error: msg } };
    }
  }

  if (sub.error) {
    logger.error(`[Auto Subscribe] ${sub.name}:`, sub.error);
    return { subscription: null, error: { event: sub.name, error: sub.error } };
  }

  return { subscription: null, error: null };
}

async function autoSubscribeToEvents(
  accessToken: string,
  broadcasterUserId: string,
  tokenProviderId: string | null = null
): Promise<SubscriptionResult | SubscriptionErrorResult> {
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

    const response: AxiosResponse<KickSubscriptionResponse> = await axios.post(
      apiUrl,
      payload,
      {
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

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

    const result: SubscriptionResult = {
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
  } catch (error: unknown) {
    const msg = toErrorMessage(error);
    logger.error("[Auto Subscribe] Error:", msg);

    // Update the error in the database
    await KickBroadcasterToken.update(
      {
        auto_subscribed: false,
        last_subscription_attempt: new Date(),
        subscription_error: msg,
      },
      {
        where: {
          kick_user_id: broadcasterUserId,
          is_active: true,
        },
      }
    );

    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as {
        response: { status: number; data: unknown };
      };
      logger.error(
        "[Auto Subscribe] API Error:",
        axiosError.response.status,
        axiosError.response.data
      );

      return {
        success: false,
        error: axiosError.response.data,
        status: axiosError.response.status,
        message: "Error communicating with the Kick API",
      };
    }

    return {
      success: false,
      error: msg,
      message: "Network error or timeout",
    };
  }
}

/**
 * Checks if there is already an active subscription for a broadcaster
 * @param broadcasterUserId - Broadcaster ID
 * @returns true if there are active subscriptions
 */
async function hasActiveSubscriptions(
  broadcasterUserId: string
): Promise<boolean> {
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
 * @param broadcasterToken - Broadcaster token instance
 * @returns True if refreshed successfully
 */
async function performBroadcasterRefresh(
  broadcasterToken: KickBroadcasterToken
): Promise<boolean> {
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

    const response: AxiosResponse<TokenRefreshResponse> = await axios.post(
      refreshUrl,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

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
  } catch (error: unknown) {
    logger.error(
      "[Token Refresh] Error renewing token:",
      toErrorMessage(error)
    );
    await handleRefreshError(error, broadcasterToken);
    return false;
  }
}

/**
 * Handle a token refresh error: log the API error details and deactivate
 * the broadcaster token when Kick returns 400 or 401 (expired/invalid token).
 * @param error - The caught error from the refresh attempt
 * @param broadcasterToken - Broadcaster token instance
 */
async function handleRefreshError(
  error: unknown,
  broadcasterToken: KickBroadcasterToken
): Promise<void> {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return;
  }

  const axiosError = error as {
    response: { status: number; data: unknown };
  };
  logger.error(
    "[Token Refresh] API Error:",
    axiosError.response.status,
    axiosError.response.data
  );

  if (
    axiosError.response.status === 400 ||
    axiosError.response.status === 401
  ) {
    try {
      await broadcasterToken.update({
        is_active: false,
        subscription_error: "Token expired and could not be refreshed",
      });
    } catch (dbError: unknown) {
      logger.error(
        "[Token Refresh] Error deactivating token:",
        toErrorMessage(dbError)
      );
    }
  }
}

/**
 * Refreshes the access token using the refresh token.
 * Concurrent calls for the same broadcaster share a single in-flight
 * network request (single-flight) to avoid race conditions caused by
 * Kick's rotating refresh tokens.
 * @param broadcasterToken - Broadcaster token instance
 * @returns True if refreshed successfully
 */
function refreshAccessToken(
  broadcasterToken: KickBroadcasterToken
): Promise<boolean> {
  const key = String(
    broadcasterToken.id ??
      broadcasterToken.kick_user_id ??
      broadcasterToken.kick_username
  );

  if (refreshInFlight.has(key)) {
    return refreshInFlight.get(key)!;
  }

  const promise = performBroadcasterRefresh(broadcasterToken).finally(() => {
    refreshInFlight.delete(key);
  });

  refreshInFlight.set(key, promise);
  return promise;
}

/**
 * Verifies and refreshes the token if necessary
 * @param broadcasterUserId - Broadcaster ID
 * @returns Valid access token or null
 */
async function ensureValidToken(
  broadcasterUserId: string
): Promise<string | null> {
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
    const expiresAt = new Date(broadcasterToken.token_expires_at as Date);

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
  } catch (error: unknown) {
    logger.error("[Token Ensure] Error:", toErrorMessage(error));
    return null;
  }
}

export {
  autoSubscribeToEvents,
  hasActiveSubscriptions,
  refreshAccessToken,
  ensureValidToken,
  DEFAULT_EVENTS,
  refreshInFlight,
};
