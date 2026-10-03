import axios, { type AxiosResponse } from "axios";
import config from "../../config";
import { KickEventSubscription } from "../models";
import logger from "../utils/logger";
import { Op } from "sequelize";
import { DEFAULT_EVENTS } from "./kickAutoSubscribe.service";

/**
 * Service to handle Kick App Access Tokens (permanent tokens)
 * App Tokens do not expire and allow permanent webhooks without user re-authentication
 */

interface KickSubscriptionData {
  subscription_id: string;
  name: string;
  version: number;
  error?: string;
}

interface KickSubscriptionResponse {
  data: KickSubscriptionData[];
}

interface SubscribeResult {
  success: boolean;
  totalSubscribed: number;
  totalErrors: number;
  subscriptions: KickEventSubscription[];
  errors: { event: string; error: string }[];
  kickResponse: KickSubscriptionResponse;
  tokenType: string;
  permanent: boolean;
  error?: string;
  status?: number;
  message?: string;
}

interface KickRemoteSubscription {
  id: string;
  event: string;
  version: number;
  method: string;
}

interface SubscriptionHealthResult {
  remoteCount: number;
  missing: string[];
  resubscribed: number;
  errors: { event: string; error: string }[];
}

interface WebhookStatus {
  app_token_subscriptions: number;
  user_token_subscriptions: number;
  total_subscriptions: number;
  is_permanent: boolean;
  requires_user_auth: boolean;
  error?: string;
}

/**
 * Get App Access Token using Client Credentials Grant
 * @returns Access token or null on failure
 */
async function getAppAccessToken(): Promise<string | null> {
  try {
    logger.info(
      "[App Token] Getting App Access Token with Client Credentials..."
    );

    const tokenUrl = config.kick.oauthToken;

    const payload = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: String(config.kick.clientId || ""),
      client_secret: String(config.kick.clientSecret || ""),
    });

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
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[App Token] Error getting App Access Token:", msg);

    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as { response: { status: number } };
      logger.error("[App Token] Status:", axiosError.response.status);
    }

    return null;
  }
}

/**
 * Upsert a single Kick event subscription (update if exists, create otherwise)
 */
async function upsertSubscription(
  sub: KickSubscriptionData,
  broadcasterUserId: string
): Promise<KickEventSubscription> {
  const existing = await KickEventSubscription.findOne({
    where: { subscription_id: sub.subscription_id },
  });

  const data = {
    broadcaster_user_id: Number.parseInt(broadcasterUserId),
    event_type: sub.name,
    event_version: sub.version,
    method: "webhook" as const,
    status: "active" as const,
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
 * Process the subscription response from Kick, upserting each valid
 * subscription to the database and collecting errors.
 * @param subscriptionsData - Subscription entries returned by Kick
 * @param broadcasterUserId - Broadcaster ID
 * @returns Created subscriptions and errors
 */
async function processAppSubscriptions(
  subscriptionsData: KickSubscriptionData[],
  broadcasterUserId: string
): Promise<{
  createdSubscriptions: KickEventSubscription[];
  errors: { event: string; error: string }[];
}> {
  const results = await Promise.all(
    subscriptionsData.map((sub) =>
      processAppSubscription(sub, broadcasterUserId)
    )
  );

  return {
    createdSubscriptions: results
      .map((r) => r.subscription)
      .filter((s): s is KickEventSubscription => s !== null),
    errors: results
      .map((r) => r.error)
      .filter((e): e is { event: string; error: string } => e !== null),
  };
}

/**
 * Process a single subscription entry from Kick: upsert it to the database
 * or record an error if Kick reported one or the DB write failed.
 * @param sub - Subscription entry returned by Kick
 * @param broadcasterUserId - Broadcaster ID
 * @returns The created/updated subscription and/or an error entry
 */
async function processAppSubscription(
  sub: KickSubscriptionData,
  broadcasterUserId: string
): Promise<{
  subscription: KickEventSubscription | null;
  error: { event: string; error: string } | null;
}> {
  if (!sub.subscription_id || sub.error) {
    if (sub.error) {
      logger.error(`[App Webhook] ${sub.name}:`, sub.error);
      return {
        subscription: null,
        error: { event: sub.name, error: sub.error },
      };
    }
    return { subscription: null, error: null };
  }

  try {
    const subscription = await upsertSubscription(sub, broadcasterUserId);
    return { subscription, error: null };
  } catch (dbError) {
    const msg = dbError instanceof Error ? dbError.message : String(dbError);
    logger.error(`[App Webhook] DB error ${sub.name}:`, msg);
    return { subscription: null, error: { event: sub.name, error: msg } };
  }
}

/**
 * Reactivate or create the local row for a webhook Kick still reports,
 * so connection status reflects the real remote state. Existing rows
 * keep their original app_id; only created rows are marked APP_TOKEN.
 * @param sub - Remote webhook subscription returned by Kick
 * @param broadcasterUserId - Broadcaster ID
 * @returns An error entry, or null when reconciled
 */
async function reconcileRemoteSubscription(
  sub: KickRemoteSubscription,
  broadcasterUserId: string
): Promise<{ event: string; error: string } | null> {
  try {
    const existing = await KickEventSubscription.findOne({
      where: { subscription_id: sub.id },
    });

    if (existing) {
      await existing.update({
        broadcaster_user_id: Number.parseInt(broadcasterUserId),
        event_type: sub.event,
        event_version: sub.version,
        method: "webhook",
        status: "active",
      });
      return null;
    }

    await KickEventSubscription.create({
      subscription_id: sub.id,
      broadcaster_user_id: Number.parseInt(broadcasterUserId),
      event_type: sub.event,
      event_version: sub.version,
      method: "webhook",
      status: "active",
      app_id: "APP_TOKEN",
    });
    return null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[Subscription Health] Reconcile error ${sub.event}:`, msg);
    return { event: sub.event, error: msg };
  }
}

/**
 * Subscribe to all events using App Access Token
 * @param broadcasterUserId - Broadcaster ID
 * @returns Subscription result
 */
async function subscribeToEventsWithAppToken(
  broadcasterUserId: string,
  events: { name: string; version: number }[] = DEFAULT_EVENTS,
  existingAppToken: string | null = null
): Promise<SubscribeResult> {
  try {
    logger.info(
      "[App Webhook] Starting subscription with App Token for broadcaster:",
      broadcasterUserId
    );

    // 1. Get App Access Token
    const appToken = existingAppToken ?? (await getAppAccessToken());
    if (!appToken) {
      throw new Error("Could not get App Access Token");
    }

    // 2. Subscribe to events
    const subscribeUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;

    const payload = {
      broadcaster_user_id: Number.parseInt(broadcasterUserId),
      events: events,
      method: "webhook",
      webhook_url: "https://api.luisardito.com/api/kick-webhook/events",
    };

    logger.info("[App Webhook] Payload:", JSON.stringify(payload, null, 2));

    const response: AxiosResponse<KickSubscriptionResponse> = await axios.post(
      subscribeUrl,
      payload,
      {
        headers: {
          Authorization: `Bearer ${appToken}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    logger.info(
      "[App Webhook] Kick response:",
      JSON.stringify(response.data, null, 2)
    );

    // 3. Process response and save subscriptions
    const subscriptionsData = response.data.data || [];
    const { createdSubscriptions, errors } = await processAppSubscriptions(
      subscriptionsData,
      broadcasterUserId
    );

    const result: SubscribeResult = {
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
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[App Webhook] Error:", msg);

    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as {
        response: { status: number; data: unknown };
      };
      logger.error(
        "[App Webhook] API Error:",
        axiosError.response.status,
        axiosError.response.data
      );
    }

    return {
      success: false,
      error: msg,
      tokenType: "APP_TOKEN",
      permanent: false,
      totalSubscribed: 0,
      totalErrors: 0,
      subscriptions: [],
      errors: [],
      kickResponse: { data: [] },
    };
  }
}

/**
 * Compare Kick's real subscription list with DEFAULT_EVENTS, re-subscribe
 * any events missing a webhook, reactivate or create local rows for
 * webhooks Kick still reports, and mark local webhook rows Kick no
 * longer has as inactive. Websocket subscriptions do not count.
 * @param broadcasterUserId - Broadcaster ID
 * @returns Health check result
 */
async function ensureWebhookSubscriptions(
  broadcasterUserId: string
): Promise<SubscriptionHealthResult> {
  const appToken = await getAppAccessToken();
  if (!appToken) {
    throw new Error("Could not get App Access Token");
  }

  const broadcasterId = Number.parseInt(broadcasterUserId);
  const response: AxiosResponse<{ data?: KickRemoteSubscription[] }> =
    await axios.get(
      `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`,
      {
        params: { broadcaster_user_id: broadcasterId },
        headers: { Authorization: `Bearer ${appToken}` },
        timeout: 15000,
      }
    );

  const remote = response.data?.data;
  if (!Array.isArray(remote)) {
    throw new TypeError("Unexpected Kick subscription list response");
  }

  // Only webhook subscriptions deliver events to this API; entries with
  // other methods (e.g. websocket) must not count as coverage.
  const remoteWebhooks = remote.filter((s) => s.method === "webhook");

  const present = new Set(remoteWebhooks.map((s) => `${s.event}:${s.version}`));
  const missingEvents = DEFAULT_EVENTS.filter(
    (e) => !present.has(`${e.name}:${e.version}`)
  );

  const remoteIds = remoteWebhooks.map((s) => s.id);
  await KickEventSubscription.update(
    { status: "inactive" },
    {
      where: {
        broadcaster_user_id: broadcasterId,
        method: "webhook",
        status: "active",
        ...(remoteIds.length > 0 && {
          subscription_id: { [Op.notIn]: remoteIds },
        }),
      },
    }
  );

  const result: SubscriptionHealthResult = {
    remoteCount: remote.length,
    missing: missingEvents.map((e) => e.name),
    resubscribed: 0,
    errors: [],
  };

  // Reactivate or recreate local rows for webhooks Kick still reports,
  // so a local disconnect does not hide subscriptions that still exist.
  const reconcileErrors = await Promise.all(
    remoteWebhooks.map((sub) =>
      reconcileRemoteSubscription(sub, broadcasterUserId)
    )
  );
  for (const reconcileError of reconcileErrors) {
    if (reconcileError) {
      result.errors.push(reconcileError);
    }
  }

  if (missingEvents.length === 0) {
    return result;
  }

  logger.error(
    "[Subscription Health] Kick dropped subscriptions, re-subscribing:",
    result.missing
  );

  const subscribeResult = await subscribeToEventsWithAppToken(
    broadcasterUserId,
    missingEvents,
    appToken
  );
  result.resubscribed = subscribeResult.totalSubscribed;
  result.errors.push(
    ...(subscribeResult.error
      ? [{ event: "*", error: subscribeResult.error }]
      : subscribeResult.errors)
  );

  return result;
}

/**
 * Check if App Token webhooks are working
 * @param broadcasterUserId - Broadcaster ID
 * @returns Webhook status
 */
async function checkAppTokenWebhooksStatus(
  broadcasterUserId: string
): Promise<WebhookStatus> {
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
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[App Webhook Status] Error:", msg);
    return {
      error: msg,
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
  ensureWebhookSubscriptions,
  checkAppTokenWebhooksStatus,
};
