/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass
import axios from "axios";
import config from "../../config";
import { KickEventSubscription } from "../models";
import logger from "../utils/logger";
import { Op } from "sequelize";

/**
 * Service to handle Kick App Access Tokens (permanent tokens)
 * App Tokens do not expire and allow permanent webhooks without user re-authentication
 */

/**
 * Get App Access Token using Client Credentials Grant
 * @returns {Promise<string|null>} Access token or null on failure
 */
async function getAppAccessToken() {
  try {
    logger.info(
      "[App Token] Getting App Access Token with Client Credentials..."
    );

    const tokenUrl = `${config.kick.apiBaseUrl}/oauth/token`;

    const payload = {
      grant_type: "client_credentials",
      client_id: config.kick.clientId,
      client_secret: config.kick.clientSecret,
    };

    logger.info("[App Token] Sending request to:", tokenUrl);
    logger.info("[App Token] Client ID:", config.kick.clientId);

    const response = await axios.post(tokenUrl, payload, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      timeout: 15000,
    });

    if (response.data.access_token) {
      logger.info("[App Token] App Access Token obtained successfully");
      logger.info("[App Token] Token type:", response.data.token_type);
      logger.info(
        "[App Token] Expires in:",
        response.data.expires_in || "Not specified (permanent)"
      );

      return response.data.access_token;
    } else {
      logger.error("[App Token] No access_token received in the response");
      return null;
    }
  } catch (error: any) {
    logger.error("[App Token] Error getting App Access Token:", error.message);

    if (error.response) {
      logger.error("[App Token] Status:", error.response.status);
      logger.error("[App Token] Response:", error.response.data);
    }

    return null;
  }
}

/**
 * Upsert a single Kick event subscription (update if exists, create otherwise)
 */
async function upsertSubscription(sub: any, broadcasterUserId: any) {
  const existing = await KickEventSubscription.findOne({
    where: { subscription_id: sub.subscription_id },
  });

  const data = {
    broadcaster_user_id: Number.parseInt(broadcasterUserId),
    event_type: sub.name,
    event_version: sub.version,
    method: "webhook",
    status: "active",
    app_id: "APP_TOKEN",
  };

  if (existing) {
    await existing.update(data);
    logger.info(`[App Webhook] ${sub.name} updated (App Token)`);
    return existing;
  }

  const created = await KickEventSubscription.create({
    subscription_id: sub.subscription_id,
    ...data,
  });
  logger.info(`[App Webhook] ${sub.name} created (App Token)`);
  return created;
}

/**
 * Subscribe to all events using App Access Token
 * @param {string} broadcasterUserId - Broadcaster ID
 * @returns {Promise<Object>} Subscription result
 */
async function subscribeToEventsWithAppToken(broadcasterUserId: any) {
  try {
    logger.info(
      "[App Webhook] Starting subscription with App Token for broadcaster:",
      broadcasterUserId
    );

    // 1. Get App Access Token
    const appToken = await getAppAccessToken();
    if (!appToken) {
      throw new Error("Could not get App Access Token");
    }

    // 2. List of events to subscribe
    const events = [
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

    // 3. Subscribe to events
    const subscribeUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;

    const payload = {
      broadcaster_user_id: Number.parseInt(broadcasterUserId),
      events: events,
      method: "webhook",
      webhook_url: "https://api.luisardito.com/api/kick-webhook/events",
    };

    logger.info("[App Webhook] Payload:", JSON.stringify(payload, null, 2));

    const response = await axios.post(subscribeUrl, payload, {
      headers: {
        Authorization: `Bearer ${appToken}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    logger.info(
      "[App Webhook] Kick response:",
      JSON.stringify(response.data, null, 2)
    );

    // 4. Process response and save subscriptions
    const subscriptionsData = response.data.data || [];
    const createdSubscriptions = [];
    const errors = [];

    for (const sub of subscriptionsData) {
      if (!sub.subscription_id || sub.error) {
        if (sub.error) {
          errors.push({ event: sub.name, error: sub.error });
          logger.error(`[App Webhook] ${sub.name}:`, sub.error);
        }
        continue;
      }
      try {
        const localSub = await upsertSubscription(sub, broadcasterUserId);
        createdSubscriptions.push(localSub);
      } catch (dbError: any) {
        logger.error(`[App Webhook] DB error ${sub.name}:`, dbError.message);
        errors.push({ event: sub.name, error: dbError.message });
      }
    }

    const result = {
      success: createdSubscriptions.length > 0,
      totalSubscribed: createdSubscriptions.length,
      totalErrors: errors.length,
      subscriptions: createdSubscriptions,
      errors,
      kickResponse: response.data,
      tokenType: "APP_TOKEN",
      permanent: true,
    };

    logger.info(
      `[App Webhook] Completed: ${result.totalSubscribed} events configured with App Token`
    );
    logger.info(
      "[App Webhook] Permanent webhooks activated! No re-authentication required."
    );

    return result;
  } catch (error: any) {
    logger.error("[App Webhook] Error:", error.message);

    if (error.response) {
      logger.error(
        "[App Webhook] API Error:",
        error.response.status,
        error.response.data
      );
    }

    return {
      success: false,
      error: error.message,
      tokenType: "APP_TOKEN",
      permanent: false,
    };
  }
}

/**
 * Check if App Token webhooks are working
 * @param {string} broadcasterUserId - Broadcaster ID
 * @returns {Promise<Object>} Webhook status
 */
async function checkAppTokenWebhooksStatus(broadcasterUserId: any) {
  try {
    // Count App Token subscriptions
    const appTokenSubs = await KickEventSubscription.count({
      where: {
        broadcaster_user_id: Number.parseInt(broadcasterUserId),
        app_id: "APP_TOKEN",
        status: "active",
      },
    });

    // Count User Token subscriptions
    const userTokenSubs = await KickEventSubscription.count({
      where: {
        broadcaster_user_id: Number.parseInt(broadcasterUserId),
        app_id: { [Op.ne]: "APP_TOKEN" },
        status: "active",
      },
    });

    return {
      app_token_subscriptions: appTokenSubs,
      user_token_subscriptions: userTokenSubs,
      total_subscriptions: appTokenSubs + userTokenSubs,
      is_permanent: appTokenSubs > 0,
      requires_user_auth: appTokenSubs === 0 && userTokenSubs > 0,
    };
  } catch (error: any) {
    logger.error("[App Webhook Status] Error:", error.message);
    return {
      error: error.message,
      app_token_subscriptions: 0,
      user_token_subscriptions: 0,
      total_subscriptions: 0,
      is_permanent: false,
      requires_user_auth: true,
    };
  }
}

export {
  getAppAccessToken,
  subscribeToEventsWithAppToken,
  checkAppTokenWebhooksStatus,
};
