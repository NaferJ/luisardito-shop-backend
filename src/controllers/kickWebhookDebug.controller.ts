/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
// TEMPORARY eslint override — to be removed in the typing pass

import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/AppError";
import { KickPointsConfig } from "../models";
import BotrixMigrationService from "../services/botrixMigration.service";
import VipService from "../services/vip.service";
import { getRedisClient } from "../config/redis.config";
import logger from "../utils/logger";
import { processWebhookEvent } from "../services/kickWebhook/processor.service";

const kickWebhookCtrl = require("./kickWebhook.controller");

/**
 * DIAGNOSTIC: monitor Redis
 */

export const debugRedisCooldowns = asyncHandler(async (req: any, res: any) => {
  try {
    const { getRedisClient } = require("../config/redis.config");
    const redis = getRedisClient();

    // Get all cooldown keys
    const keys = await redis.keys("chat_cooldown:*");

    const cooldowns = [];
    for (const key of keys) {
      const ttl = await redis.pttl(key);
      const value = await redis.get(key);
      const userId = key.replace("chat_cooldown:", "");

      cooldowns.push({
        kick_user_id: userId,
        created_at: value,
        expires_in_seconds: Math.ceil(ttl / 1000),
        expires_in_minutes: Math.ceil(ttl / 60000),
      });
    }

    const sortedCooldowns = [...cooldowns].sort(
      (a, b) => a.expires_in_seconds - b.expires_in_seconds
    );

    res.json({
      success: true,
      total_active_cooldowns: cooldowns.length,
      cooldowns: sortedCooldowns,
      redis_status: redis.status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Debug Redis] Error:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * DIAGNOSTIC: Check tokens stored in DB
 */
export const diagnosticTokensDB = asyncHandler(async (req: any, res: any) => {
  try {
    const {
      KickBroadcasterToken,
      KickEventSubscription,
    } = require("../models");
    const config = require("../../config");

    logger.info("[DIAGNOSTIC DB] Querying tokens in database...");

    // 1. Get ALL stored tokens (active and inactive)
    const allTokens = await KickBroadcasterToken.findAll({
      attributes: [
        "id",
        "kick_user_id",
        "kick_username",
        "token_expires_at",
        "is_active",
        "auto_subscribed",
        "last_subscription_attempt",
        "subscription_error",
        "created_at",
        "updated_at",
      ],
      order: [["updated_at", "DESC"]],
    });
    logger.info("[DIAGNOSTIC DB] Tokens found:", allTokens.length);
    logger.info("[DIAGNOSTIC DB] Tokens found:", allTokens.length);

    // 2. Check main broadcaster specifically
    const broadcasterPrincipal = await KickBroadcasterToken.findOne({
      where: {
        kick_user_id: config.kick.broadcasterId,
        is_active: true,
      },
    });

    // 3. Check main broadcaster subscriptions
    const suscripciones = await KickEventSubscription.findAll({
      where: {
        broadcaster_user_id: Number.parseInt(config.kick.broadcasterId),
      },
      attributes: [
        "id",
        "subscription_id",
        "event_type",
        "status",
        "created_at",
      ],
    });

    // 4. Token analysis
    const tokensActivos = allTokens.filter((t: any) => t.is_active);
    const tokensExpirados = allTokens.filter((t: any) => {
      if (!t.token_expires_at) return false;
      return new Date(t.token_expires_at) < new Date();
    });

    const diagnostico = {
      resumen: {
        total_tokens: allTokens.length,
        tokens_activos: tokensActivos.length,
        tokens_expirados: tokensExpirados.length,
        broadcaster_principal_id: config.kick.broadcasterId,
        broadcaster_principal_tiene_token: !!broadcasterPrincipal,
        total_suscripciones: suscripciones.length,
      },
      broadcaster_principal: broadcasterPrincipal
        ? {
            id: broadcasterPrincipal.id,
            kick_user_id: broadcasterPrincipal.kick_user_id,
            kick_username: broadcasterPrincipal.kick_username,
            token_expires_at: broadcasterPrincipal.token_expires_at,
            auto_subscribed: broadcasterPrincipal.auto_subscribed,
            last_subscription_attempt:
              broadcasterPrincipal.last_subscription_attempt,
            subscription_error: broadcasterPrincipal.subscription_error,
            created_at: broadcasterPrincipal.created_at,
            updated_at: broadcasterPrincipal.updated_at,
            token_valido: broadcasterPrincipal.token_expires_at
              ? new Date(broadcasterPrincipal.token_expires_at) > new Date()
              : "UNKNOWN",
          }
        : null,
      todos_los_tokens: allTokens.map((t: any) => ({
        id: t.id,
        kick_user_id: t.kick_user_id,
        kick_username: t.kick_username,
        is_active: t.is_active,
        auto_subscribed: t.auto_subscribed,
        token_expires_at: t.token_expires_at,
        token_valido: t.token_expires_at
          ? new Date(t.token_expires_at) > new Date()
          : "UNKNOWN",
        created_at: t.created_at,
        updated_at: t.updated_at,
      })),
      suscripciones: suscripciones.map((s: any) => ({
        id: s.id,
        subscription_id: s.subscription_id,
        event_type: s.event_type,
        status: s.status,
        created_at: s.created_at,
      })),
      estado: {
        problema_identificado: (() => {
          if (!broadcasterPrincipal) {
            return (
              "Main broadcaster (ID: " +
              config.kick.broadcasterId +
              ") has NO stored token"
            );
          }
          if (suscripciones.length === 0) {
            return "Main broadcaster has token but NO subscriptions";
          }
          return "Token and subscriptions present - should work";
        })(),
        accion_requerida: (() => {
          if (!broadcasterPrincipal) {
            return "Luisardito needs to authenticate at: https://luisardito.com/auth/login";
          }
          if (suscripciones.length === 0) {
            return "Re-authentication needed to create subscriptions";
          }
          return "Test webhook by sending a message in Luisardito's chat";
        })(),
      },
    };

    logger.info(
      "[DIAGNOSTIC DB] RESULT:",
      JSON.stringify(diagnostico.resumen, null, 2)
    );

    res.json({
      success: true,
      diagnostico,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[DIAGNOSTIC DB] Error:", error);
    throw new AppError(error.message, 500);
  }
});
export const diagnosticTokens = asyncHandler(async (req: any, res: any) => {
  try {
    const {
      KickBroadcasterToken,
      KickEventSubscription,
    } = require("../models");
    const config = require("../../config");

    logger.info("[DIAGNOSTIC] Starting verification...");

    // 1. Check configured main broadcaster
    const broadcasterPrincipal = config.kick.broadcasterId;
    logger.info(
      "[DIAGNOSTIC] Main broadcaster configured:",
      broadcasterPrincipal
    );

    // 2. Get all available tokens
    const allTokens = await KickBroadcasterToken.findAll({
      where: { is_active: true },
      attributes: [
        "kick_user_id",
        "auto_subscribed",
        "last_subscription_attempt",
        "subscription_error",
      ],
    });

    logger.info(
      "[DIAGNOSTIC] Available tokens:",
      allTokens.map((t: any) => ({
        kick_user_id: t.kick_user_id,
        auto_subscribed: t.auto_subscribed,
        last_attempt: t.last_subscription_attempt,
      }))
    );

    // 3. Check if main broadcaster has a token
    const hasBroadcasterToken = allTokens.some(
      (t: any) => t.kick_user_id.toString() === broadcasterPrincipal.toString()
    );
    logger.info(
      "[DIAGNOSTIC] Main broadcaster has token?",
      hasBroadcasterToken
    );

    // 4. Check current subscriptions
    const suscripciones = await KickEventSubscription.findAll({
      where: {
        broadcaster_user_id: Number.parseInt(broadcasterPrincipal),
      },
      attributes: ["event_type", "subscription_id", "status"],
    });

    logger.info(
      "[DIAGNOSTIC] Main broadcaster subscriptions:",
      suscripciones.length
    );

    // 5. Check which user is NaferJ (ID 33112734)
    const hasNaferToken = allTokens.some(
      (t: any) => t.kick_user_id.toString() === "33112734"
    );
    logger.info("[DIAGNOSTIC] NaferJ (33112734) has token?", hasNaferToken);
    logger.info(
      "[DIAGNOSTIC] Is NaferJ the main broadcaster?",
      broadcasterPrincipal.toString() === "33112734"
    );

    const diagnostico = {
      broadcaster_principal_config: broadcasterPrincipal,
      broadcaster_principal_tiene_token: hasBroadcasterToken,
      nafer_user_id: "33112734",
      nafer_tiene_token: hasNaferToken,
      nafer_es_broadcaster_principal:
        broadcasterPrincipal.toString() === "33112734",
      total_tokens_activos: allTokens.length,
      total_suscripciones: suscripciones.length,
      tokens_disponibles: allTokens.map((t: any) => t.kick_user_id),
      posible_problema:
        broadcasterPrincipal.toString() !== "33112734"
          ? "Main broadcaster is NOT NaferJ, but NaferJ is trying to subscribe to another broadcaster's events"
          : "NaferJ IS the main broadcaster, should work",
      recomendacion:
        broadcasterPrincipal.toString() !== "33112734"
          ? "The main broadcaster (ID: " +
            broadcasterPrincipal +
            ") needs to authenticate and use THEIR token"
          : "Setup should be correct, the issue may be network or configuration",
    };

    logger.info("[DIAGNOSTIC] SUMMARY:", diagnostico);

    res.json({
      success: true,
      diagnostico,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[DIAGNOSTIC] Error:", error);
    throw new AppError(error.message, 500);
  }
});
export const testCors = asyncHandler(async (req: any, res: any) => {
  logger.info("[CORS Test] ==========================================");
  logger.info("[CORS Test] Method:", req.method);
  logger.info("[CORS Test] Origin:", req.headers.origin || "NO ORIGIN");
  logger.info("[CORS Test] User-Agent:", req.headers["user-agent"]);
  logger.info("[CORS Test] Headers:", Object.keys(req.headers));
  logger.info("[CORS Test] ==========================================");

  res.status(200).json({
    message: "CORS working correctly for webhooks",
    timestamp: new Date().toISOString(),
    method: req.method,
    origin: req.headers.origin || "No origin",
    headers: req.headers,
    corsEnabled: true,
  });
});

/**
 * Simple endpoint to verify Kick can reach the server
 * GET /webhook/test
 */
export const testWebhook = asyncHandler(async (req: any, res: any) => {
  logger.info("[Kick Webhook] Test endpoint reached");
  logger.info("[Kick Webhook] Headers:", req.headers);
  logger.info("[Kick Webhook] IP:", req.ip);
  logger.info("[Kick Webhook] User-Agent:", req.headers["user-agent"]);

  return res.json({
    status: "success",
    message: "Webhook endpoint is reachable",
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });
});

/**
 * Endpoint to verify webhook configuration
 * GET /webhook/debug
 */
export const debugWebhook = asyncHandler(async (req: any, res: any) => {
  try {
    const { KickEventSubscription } = require("../models");

    const subscriptions = await KickEventSubscription.findAll({
      where: { status: "active" },
      attributes: [
        "id",
        "subscription_id",
        "broadcaster_user_id",
        "event_type",
        "created_at",
      ],
    });

    return res.json({
      activeSubscriptions: subscriptions.length,
      subscriptions: subscriptions,
      webhookUrl: "https://api.luisardito.com/api/webhook/kick",
      expectedHeaders: [
        "kick-event-message-id",
        "kick-event-subscription-id",
        "kick-event-signature",
        "kick-event-message-timestamp",
        "kick-event-type",
        "kick-event-version",
      ],
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message, 500);
  }
});

/**
 * Temporary endpoint to simulate a chat event and verify processing works
 * POST /api/kick-webhook/simulate-chat
 */
export const simulateChat = asyncHandler(async (req: any, res: any) => {
  try {
    logger.info("[Webhook Simulator] Simulating chat event...");

    // Simulate chat message payload
    const simulatedPayload = {
      message_id: "sim_" + Date.now(),
      content: "Mensaje de prueba simulado",
      sender: {
        user_id: 33112734, // Your user_id
        username: "NaferJ",
      },
      broadcaster: {
        user_id: 2771761,
        username: "Luisardito",
      },
      sent_at: new Date().toISOString(),
    };

    const metadata = {
      messageId: simulatedPayload.message_id,
      subscriptionId: "sim_subscription",
      timestamp: Date.now(),
    };

    logger.info("[Webhook Simulator] Processing simulated event...");

    // Process the event as if it were real
    await processWebhookEvent(
      "chat.message.sent",
      1 as any,
      simulatedPayload,
      metadata
    );

    return res.json({
      status: "success",
      message: "Simulated chat event processed",
      payload: simulatedPayload,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Webhook Simulator] Error:", error.message);
    throw new AppError(error.message, 500);
  }
});

/**
 * Endpoint to simulate a REAL Kick webhook (with headers and all)
 * POST /api/kick-webhook/test-real-webhook
 */
export const testRealWebhook = asyncHandler(async (req: any, res: any) => {
  try {
    logger.info(
      "[Test Real Webhook] Simulating REAL Kick webhook with headers..."
    );

    // Simulate exact headers sent by Kick
    const mockHeaders = {
      "kick-event-message-id": "test_" + Date.now(),
      "kick-event-subscription-id": "01K7JPFW2HYW4GCBQN85DVB9WG",
      "kick-event-signature": "test_signature_" + Date.now(),
      "kick-event-message-timestamp": Date.now().toString(),
      "kick-event-type": "chat.message.sent",
      "kick-event-version": "1",
      "content-type": "application/json",
      "user-agent": "Kick-Webhooks/1.0",
    };

    // Simulate real Kick payload
    const mockPayload = {
      message_id: "real_test_" + Date.now(),
      content: "7",
      sender: {
        user_id: 33112734,
        username: "NaferJ",
      },
      broadcaster: {
        user_id: 2771761,
        username: "Luisardito",
      },
      sent_at: new Date().toISOString(),
    };

    // Modify request to simulate coming from Kick
    req.headers = { ...req.headers, ...mockHeaders };
    req.body = mockPayload;

    logger.info("[Test Real Webhook] Simulated headers:", mockHeaders);
    logger.info("[Test Real Webhook] Simulated payload:", mockPayload);

    // Call main handler as if it were a real webhook
    await kickWebhookCtrl.handleWebhook(req, res);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Test Real Webhook] Error:", error.message);
    throw new AppError(error.message, 500);
  }
});

/**
 * Renew an expired broadcaster token if possible.
 * Throws AppError on failure.
 */
async function renewBroadcasterTokenIfNeeded(broadcasterToken: any) {
  const now = new Date();
  const expiresAt = new Date(broadcasterToken.token_expires_at);
  const isExpired = expiresAt <= now;

  logger.info("[REACTIVATE] Token status:", {
    expires_at: expiresAt,
    now: now,
    is_expired: isExpired,
    has_refresh_token: !!broadcasterToken.refresh_token,
  });

  if (!isExpired) {
    return;
  }

  logger.info(
    "[REACTIVATE] Token expired, attempting renewal with refresh_token..."
  );

  if (!broadcasterToken.refresh_token) {
    throw new AppError("Token expired and no refresh_token available", 400);
  }

  try {
    const {
      refreshAccessToken,
    } = require("../services/kickAutoSubscribe.service");
    logger.info("[REACTIVATE] Attempting token renewal...");

    const renewed = await refreshAccessToken(broadcasterToken);

    if (!renewed) {
      throw new AppError("Could not renew expired token", 400);
    }

    logger.info("[REACTIVATE] Token renewed successfully");
    await broadcasterToken.reload();
  } catch (refreshError) {
    logger.error("[REACTIVATE] Error renewing token:", refreshError.message);
    throw new AppError("Error renewing token: " + refreshError.message, 400);
  }
}

/**
 * REACTIVATE: Main broadcaster token
 */
export const reactivateBroadcasterToken = asyncHandler(
  async (req: any, res: any) => {
    try {
      const { KickBroadcasterToken } = require("../models");
      const {
        autoSubscribeToEvents,
      } = require("../services/kickAutoSubscribe.service");
      const config = require("../../config");

      logger.info("[REACTIVATE] Looking for main broadcaster token...");

      const broadcasterToken = await KickBroadcasterToken.findOne({
        where: { kick_user_id: config.kick.broadcasterId },
      });

      if (!broadcasterToken) {
        throw new AppError("Main broadcaster token not found", 404);
      }

      logger.info("[REACTIVATE] Token found, checking expiration...");

      await renewBroadcasterTokenIfNeeded(broadcasterToken);

      logger.info("[REACTIVATE] Reactivating token...");

      // Reactivate token
      await broadcasterToken.update({
        is_active: true,
        auto_subscribed: false,
        subscription_error: null,
      });

      logger.info(
        "[REACTIVATE] Attempting auto-subscription with broadcaster token..."
      );

      // Attempt auto-subscription using ITS own token
      try {
        const autoSubscribeResult = await autoSubscribeToEvents(
          broadcasterToken.access_token,
          config.kick.broadcasterId,
          config.kick.broadcasterId
        );

        await broadcasterToken.update({
          auto_subscribed: autoSubscribeResult.success,
          last_subscription_attempt: new Date(),
          subscription_error: autoSubscribeResult.success
            ? null
            : JSON.stringify(autoSubscribeResult.error),
        });

        logger.info(
          "[REACTIVATE] Subscription result:",
          autoSubscribeResult.success ? "SUCCESS" : "FAILURE"
        );

        res.json({
          success: true,
          token_reactivated: true,
          auto_subscribed: autoSubscribeResult.success,
          broadcaster_id: config.kick.broadcasterId,
          broadcaster_username: broadcasterToken.kick_username,
          subscriptions_created: autoSubscribeResult.totalSubscribed || 0,
          subscriptions_errors: autoSubscribeResult.totalErrors || 0,
          message: autoSubscribeResult.success
            ? "Token reactivated and subscriptions created. Webhooks should work!"
            : "Token reactivated but subscription failed",
          next_step: autoSubscribeResult.success
            ? "Test by sending a message in Luisardito's chat"
            : "Check subscription error logs",
        });
      } catch (subscribeError) {
        logger.error(
          "[REACTIVATE] Subscription error:",
          subscribeError.message
        );

        await broadcasterToken.update({
          auto_subscribed: false,
          subscription_error: subscribeError.message,
        });

        res.json({
          success: true,
          token_reactivated: true,
          auto_subscribed: false,
          error: subscribeError.message,
          message: "Token reactivated but subscription failed",
          next_step: "Check error logs",
        });
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("[REACTIVATE] General error:", error);
      throw new AppError(error.message, 500);
    }
  }
);

/**
 * Simplified webhook system status
 */
export const systemStatus = asyncHandler(async (req: any, res: any) => {
  try {
    const {
      KickBroadcasterToken,
      KickEventSubscription,
    } = require("../models");
    const config = require("../../config");

    // Check main broadcaster
    const broadcasterToken = await KickBroadcasterToken.findOne({
      where: {
        kick_user_id: config.kick.broadcasterId,
        is_active: true,
      },
    });

    // Count active subscriptions
    const subscriptions = await KickEventSubscription.count({
      where: {
        broadcaster_user_id: Number.parseInt(config.kick.broadcasterId),
        status: "active",
      },
    });

    const now = new Date();
    const tokenValid =
      broadcasterToken && new Date(broadcasterToken.token_expires_at) > now;

    const status: any = {
      system_ready: broadcasterToken && tokenValid && subscriptions > 0,
      broadcaster_authenticated: !!broadcasterToken,
      token_valid: tokenValid,
      subscriptions_active: subscriptions,
      webhook_url: "https://api.luisardito.com/api/kick-webhook/events",
      last_check: now.toISOString(),
    };

    if (broadcasterToken) {
      status.broadcaster_username = broadcasterToken.kick_username;
      status.token_expires_at = broadcasterToken.token_expires_at;
      status.auto_subscribed = broadcasterToken.auto_subscribed;
    }

    const statusCode = status.system_ready ? 200 : 503;

    res.status(statusCode).json({
      success: status.system_ready,
      status,
      message: status.system_ready
        ? "Webhook system operational"
        : "System needs configuration",
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[System Status] Error:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * Save a single subscription from Kick API response and return a debug result entry.
 */
async function saveSubscriptionDebugResult(sub: any, broadcasterId: any) {
  if (!sub.subscription_id || sub.error) {
    return {
      event: sub.name || "UNKNOWN",
      success: false,
      kick_error: sub.error || "No subscription_id in response",
    };
  }

  const { KickEventSubscription } = require("../models");
  const dataToSave = {
    subscription_id: sub.subscription_id,
    broadcaster_user_id: Number.parseInt(broadcasterId),
    event_type: sub.name,
    event_version: sub.version,
    method: "webhook",
    status: "active",
  };

  logger.info("[DEBUG SUB] Data to save:", JSON.stringify(dataToSave, null, 2));

  try {
    const localSub = await KickEventSubscription.findOne({
      where: { subscription_id: sub.subscription_id },
    });

    if (localSub) {
      await localSub.update(dataToSave);
      logger.info("[DEBUG SUB] Update successful for:", sub.name);
      return {
        event: sub.name,
        success: true,
        action: "updated",
        subscription_id: sub.subscription_id,
        db_id: localSub.id,
      };
    }

    const newSubscription = await KickEventSubscription.create(dataToSave);
    logger.info("[DEBUG SUB] Create successful for:", sub.name);
    return {
      event: sub.name,
      success: true,
      action: "created",
      subscription_id: sub.subscription_id,
      db_id: newSubscription.id,
    };
  } catch (dbError) {
    logger.error("[DEBUG SUB] Detailed DB error:", {
      message: dbError.message,
      name: dbError.name,
      errors: dbError.errors,
      sql: dbError.sql,
      stack: dbError.stack,
    });

    return {
      event: sub.name || "UNKNOWN",
      success: false,
      error: {
        message: dbError.message,
        name: dbError.name,
        errors: dbError.errors
          ? dbError.errors.map((e: any) => ({
              message: e.message,
              type: e.type,
              path: e.path,
              value: e.value,
            }))
          : null,
        sql: dbError.sql,
      },
      attempted_data: dataToSave,
    };
  }
}

/**
 * DEBUG: Temporary endpoint to debug the subscription process
 */
export const debugSubscriptionProcess = asyncHandler(
  async (req: any, res: any) => {
    try {
      const {
        KickBroadcasterToken,
        KickEventSubscription,
      } = require("../models");
      const config = require("../../config");
      const axios = require("axios");

      logger.info("[DEBUG SUB] Starting subscription process debugging...");

      // 1. Check active token
      const broadcasterToken = await KickBroadcasterToken.findOne({
        where: {
          kick_user_id: config.kick.broadcasterId,
          is_active: true,
        },
      });

      if (!broadcasterToken) {
        throw new AppError("No active token for main broadcaster", 500);
      }

      logger.info(
        "[DEBUG SUB] Token found for:",
        broadcasterToken.kick_username
      );

      // 2. Simulate Kick API call (single event for testing)
      const apiUrl = `${config.kick.apiBaseUrl}/public/v1/events/subscriptions`;
      const testPayload = {
        broadcaster_user_id: Number.parseInt(config.kick.broadcasterId),
        events: [{ name: "chat.message.sent", version: 1 }],
        method: "webhook",
        webhook_url: "https://api.luisardito.com/api/kick-webhook/events",
      };

      logger.info(
        "[DEBUG SUB] Payload sent to Kick:",
        JSON.stringify(testPayload, null, 2)
      );

      let kickResponse;
      try {
        const response = await axios.post(apiUrl, testPayload, {
          headers: {
            Authorization: `Bearer ${broadcasterToken.access_token}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        });
        kickResponse = response.data;
        logger.info(
          "[DEBUG SUB] Kick response:",
          JSON.stringify(kickResponse, null, 2)
        );
      } catch (apiError) {
        logger.error("[DEBUG SUB] Kick API error:", apiError.message);
        throw new AppError("Error communicating with Kick API", 500);
      }

      // 3. Try saving each subscription and capture detailed errors
      const subscriptionsData = kickResponse.data || [];
      const debugResults = [];

      for (const sub of subscriptionsData) {
        logger.info(
          "[DEBUG SUB] Processing subscription:",
          JSON.stringify(sub, null, 2)
        );

        debugResults.push(
          await saveSubscriptionDebugResult(sub, config.kick.broadcasterId)
        );
      }

      // 4. Clean up any subscription created during testing
      await KickEventSubscription.destroy({
        where: {
          broadcaster_user_id: Number.parseInt(config.kick.broadcasterId),
          event_type: "chat.message.sent",
        },
      });
      logger.info("[DEBUG SUB] Cleanup completed");

      res.json({
        success: true,
        debug_info: {
          broadcaster_id: config.kick.broadcasterId,
          broadcaster_username: broadcasterToken.kick_username,
          token_expires_at: broadcasterToken.token_expires_at,
          kick_api_payload: testPayload,
          kick_api_response: kickResponse,
          db_save_results: debugResults,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("[DEBUG SUB] General error:", error);
      throw new AppError(error.message, 500);
    }
  }
);

/**
 * DEBUG: Verify KickEventSubscription table structure
 */
export const debugTableStructure = asyncHandler(async (req: any, res: any) => {
  try {
    const { KickEventSubscription } = require("../models");
    const { sequelize } = require("../models/database");

    logger.info("[DEBUG TABLE] Checking table structure...");

    // 1. Describe table directly in DB
    const [tableDescription] = await sequelize.query(
      `DESCRIBE kick_event_subscriptions`
    );

    // 2. Get constraints and indexes
    const [constraints] = await sequelize.query(`
            SELECT
                COLUMN_NAME,
                IS_NULLABLE,
                DATA_TYPE,
                COLUMN_DEFAULT,
                COLUMN_KEY,
                EXTRA
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'kick_event_subscriptions'
            AND TABLE_SCHEMA = DATABASE()
        `);

    // 3. Check unique indexes
    const [uniqueIndexes] = await sequelize.query(`
            SELECT
                INDEX_NAME,
                COLUMN_NAME,
                NON_UNIQUE
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_NAME = 'kick_event_subscriptions'
            AND TABLE_SCHEMA = DATABASE()
            AND NON_UNIQUE = 0
        `);

    // 4. Check foreign keys
    const [foreignKeys] = await sequelize.query(`
            SELECT
                COLUMN_NAME,
                CONSTRAINT_NAME,
                REFERENCED_TABLE_NAME,
                REFERENCED_COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_NAME = 'kick_event_subscriptions'
            AND TABLE_SCHEMA = DATABASE()
            AND REFERENCED_TABLE_NAME IS NOT NULL
        `);

    // 5. Test simple insert to capture error
    let insertTestResult = null;
    try {
      // Minimal test data
      const testData = {
        subscription_id: "test_debug_" + Date.now(),
        broadcaster_user_id: 33112734,
        event_type: "chat.message.sent",
        event_version: 1,
        method: "webhook",
        status: "active",
      };

      logger.info("[DEBUG TABLE] Testing insert with data:", testData);

      const testRecord = await KickEventSubscription.create(testData);

      // If it works, delete immediately
      await testRecord.destroy();

      insertTestResult = {
        success: true,
        message: "Test insert successful",
        test_data: testData,
      };
    } catch (insertError) {
      logger.error("[DEBUG TABLE] Test insert error:", insertError);

      insertTestResult = {
        success: false,
        error: {
          message: insertError.message,
          name: insertError.name,
          errors: insertError.errors
            ? insertError.errors.map((e: any) => ({
                message: e.message,
                type: e.type,
                path: e.path,
                value: e.value,
                validatorKey: e.validatorKey,
                validatorName: e.validatorName,
              }))
            : null,
          sql: insertError.sql,
        },
      };
    }

    res.json({
      success: true,
      table_info: {
        table_description: tableDescription,
        column_constraints: constraints,
        unique_indexes: uniqueIndexes,
        foreign_keys: foreignKeys,
        insert_test: insertTestResult,
      },
      sequelize_model_attributes: Object.keys(
        KickEventSubscription.rawAttributes
      ).map((key: any) => ({
        name: key,
        type: KickEventSubscription.rawAttributes[key].type.constructor.name,
        allowNull: KickEventSubscription.rawAttributes[key].allowNull,
        defaultValue: KickEventSubscription.rawAttributes[key].defaultValue,
        unique: KickEventSubscription.rawAttributes[key].unique,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[DEBUG TABLE] General error:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * APP TOKEN: Configure permanent webhooks with App Access Token
 */
export const setupPermanentWebhooks = asyncHandler(
  async (req: any, res: any) => {
    try {
      const {
        subscribeToEventsWithAppToken,
      } = require("../services/kickAppToken.service");
      const config = require("../../config");

      logger.info(
        "[Setup Permanent] Starting permanent webhooks configuration..."
      );

      const result = await subscribeToEventsWithAppToken(
        config.kick.broadcasterId
      );

      if (result.success) {
        res.json({
          success: true,
          message: "Permanent webhooks configured successfully!",
          permanent: true,
          token_type: "APP_TOKEN",
          no_user_auth_required: true,
          broadcaster_id: config.kick.broadcasterId,
          subscriptions_created: result.totalSubscribed,
          subscriptions_errors: result.totalErrors,
          webhook_url: "https://api.luisardito.com/api/kick-webhook/events",
          benefits: [
            "No user re-authentication required",
            "Works 24/7 without manual intervention",
            "Does not expire every 2 hours",
            "No refresh tokens that expire",
            "Completely autonomous",
          ],
          next_steps: [
            "Webhooks are ready",
            "Test by sending a message in chat",
            "Check server logs",
          ],
        });
      } else {
        throw new AppError("Error configuring permanent webhooks", 500);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("[Setup Permanent] General error:", error);
      throw new AppError(error.message, 500);
    }
  }
);

/**
 * APP TOKEN: Debug and status of permanent webhooks
 */
export const debugAppTokenWebhooks = asyncHandler(
  async (req: any, res: any) => {
    try {
      const {
        getAppAccessToken,
        checkAppTokenWebhooksStatus,
      } = require("../services/kickAppToken.service");
      const config = require("../../config");

      logger.info(
        "[Debug App Token] Starting permanent webhooks diagnostics..."
      );

      // 1. Test App Token retrieval
      logger.info("[Debug App Token] Testing App Access Token retrieval...");
      const appToken = await getAppAccessToken();

      // 2. Check subscription status
      logger.info("[Debug App Token] Checking subscription status...");
      const webhooksStatus = await checkAppTokenWebhooksStatus(
        config.kick.broadcasterId
      );

      // 3. Check all subscriptions in DB
      const { KickEventSubscription } = require("../models");
      const allSubscriptions = await KickEventSubscription.findAll({
        where: {
          broadcaster_user_id: Number.parseInt(config.kick.broadcasterId),
        },
        attributes: [
          "id",
          "subscription_id",
          "event_type",
          "app_id",
          "status",
          "created_at",
        ],
        order: [["created_at", "DESC"]],
      });

      const debug_info = {
        app_token_test: {
          success: !!appToken,
          token_obtained: !!appToken,
          token_length: appToken ? appToken.length : 0,
          message: appToken
            ? "App Token obtained successfully"
            : "Error obtaining App Token",
        },
        webhooks_status: webhooksStatus,
        broadcaster_config: {
          broadcaster_id: config.kick.broadcasterId,
          webhook_url: "https://api.luisardito.com/api/kick-webhook/events",
          client_id: config.kick.clientId,
          client_secret_configured: !!config.kick.clientSecret,
        },
        subscriptions_breakdown: {
          app_token_subs: allSubscriptions.filter(
            (s: any) => s.app_id === "APP_TOKEN"
          ),
          user_token_subs: allSubscriptions.filter(
            (s: any) => s.app_id !== "APP_TOKEN"
          ),
          all_subscriptions: allSubscriptions,
        },
        system_assessment: {
          is_permanent: webhooksStatus.is_permanent,
          requires_maintenance: !webhooksStatus.is_permanent,
          user_dependency: webhooksStatus.requires_user_auth,
          recommendation: webhooksStatus.is_permanent
            ? "System running with permanent webhooks"
            : "Recommended to configure permanent webhooks with App Token",
        },
      };

      res.json({
        success: true,
        debug_info,
        summary: {
          app_token_working: !!appToken,
          permanent_webhooks_active: webhooksStatus.is_permanent,
          total_active_subscriptions: webhooksStatus.total_subscriptions,
          system_status: webhooksStatus.is_permanent
            ? "PERMANENT"
            : "TEMPORARY",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("[Debug App Token] Error:", error);
      throw new AppError(error.message, 500);
    }
  }
);

/**
 * APP TOKEN: Comparative status between User Token vs App Token
 */
export const compareTokenTypes = asyncHandler(async (req: any, res: any) => {
  try {
    const {
      checkAppTokenWebhooksStatus,
    } = require("../services/kickAppToken.service");
    const { KickBroadcasterToken } = require("../models");
    const config = require("../../config");

    logger.info("[Compare Tokens] Comparing User Token vs App Token...");

    // Webhooks status
    const webhooksStatus = await checkAppTokenWebhooksStatus(
      config.kick.broadcasterId
    );

    // User Tokens status
    const userTokens = await KickBroadcasterToken.findAll({
      where: { kick_user_id: config.kick.broadcasterId },
      attributes: [
        "id",
        "kick_username",
        "is_active",
        "token_expires_at",
        "auto_subscribed",
      ],
      order: [["updated_at", "DESC"]],
    });

    const now = new Date();
    const activeUserTokens = userTokens.filter(
      (t: any) =>
        t.is_active && t.token_expires_at && new Date(t.token_expires_at) > now
    );

    const comparison = {
      user_tokens: {
        total: userTokens.length,
        active: activeUserTokens.length,
        expires:
          activeUserTokens.length > 0
            ? activeUserTokens[0].token_expires_at
            : null,
        requires_user_interaction: true,
        maintenance_required: true,
        duration: "2 hours (with refresh up to ~30-90 days)",
        webhooks_count: webhooksStatus.user_token_subscriptions,
      },
      app_tokens: {
        total: "N/A (no DB state)",
        active: webhooksStatus.app_token_subscriptions > 0 ? 1 : 0,
        expires: "NEVER (permanent)",
        requires_user_interaction: false,
        maintenance_required: false,
        duration: "PERMANENT (until manual credential change)",
        webhooks_count: webhooksStatus.app_token_subscriptions,
      },
      recommendation: {
        current_status: webhooksStatus.is_permanent
          ? "USING_APP_TOKEN"
          : "USING_USER_TOKEN",
        should_migrate: !webhooksStatus.is_permanent,
        benefits_migration: [
          "Eliminates user dependency",
          "No re-authentication required",
          "Works 24/7 without maintenance",
          "Eliminates token expiration",
          "Fully autonomous system",
        ],
      },
    };

    res.json({
      success: true,
      comparison,
      summary: {
        current_system: webhooksStatus.is_permanent
          ? "PERMANENT (App Token)"
          : "TEMPORARY (User Token)",
        recommendation: webhooksStatus.is_permanent
          ? "Already optimized"
          : "Migrate to App Token",
        action_needed: !webhooksStatus.is_permanent,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Compare Tokens] Error:", error);
    throw new AppError(error.message, 500);
  }
});

// ============================================================================
// DEBUG ENDPOINTS FOR NEW FEATURES
// ============================================================================

/**
 * DEBUG: Simulate Botrix migration
 */
export const debugBotrixMigration = asyncHandler(async (req: any, res: any) => {
  try {
    const { kick_username, points_amount } = req.body;

    if (!kick_username || !points_amount) {
      throw new AppError(
        "Missing parameters: kick_username, points_amount",
        400
      );
    }

    logger.info(
      `[DEBUG BOTRIX] Simulating migration: ${kick_username} with ${points_amount} points`
    );

    // Create simulated BotRix message
    const mockMessage = {
      sender: {
        username: "BotRix",
        user_id: "debug_botrix",
      },
      content: `@${kick_username} tiene ${points_amount} puntos.`,
      broadcaster: {
        user_id: Number.parseInt(process.env.KICK_BROADCASTER_ID || "2771761"),
      },
    };

    // Process with the real service
    const result = await BotrixMigrationService.processChatMessage(mockMessage);

    res.json({
      success: true,
      message: "Migration simulation completed",
      input: { kick_username, points_amount },
      result: result,
      mock_message: mockMessage.content,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[DEBUG BOTRIX] Simulation error:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * DEBUG: VIP configuration and migration info
 */
export const debugSystemInfo = asyncHandler(async (req: any, res: any) => {
  try {
    const { BotrixMigrationConfig } = require("../models");
    const config = await BotrixMigrationConfig.getConfig();

    // Get real migration stats
    const migrationStats = await BotrixMigrationService.getMigrationStats();

    // Get real VIP stats using imported service
    const vipStats = await VipService.getVipStats();

    res.json({
      success: true,
      system_info: {
        migration: {
          enabled: config.migration_enabled,
          stats: {
            migrated_users: migrationStats.migrated_users,
            total_points_migrated: migrationStats.total_migrated_points,
            pending_users: migrationStats.pending_users,
            migration_percentage: migrationStats.migration_percentage,
          },
        },
        vip: {
          points_enabled: config.vip_points_enabled,
          config: {
            chat_points: config.vip_chat_points,
            follow_points: config.vip_follow_points,
            sub_points: config.vip_sub_points,
          },
          stats: {
            total_vips: vipStats.total_vips,
            active_vips: vipStats.active_vips,
            expired_vips: vipStats.expired_vips,
            permanent_vips: vipStats.permanent_vips,
            temporary_vips: vipStats.temporary_vips,
          },
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("Error getting system info:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * Format a Redis TTL value for display.
 */
function formatTtl(ttl: any) {
  if (ttl === -1) return "no_expiration";
  if (ttl === -2) return "not_found";
  return `${ttl}s (${Math.floor(ttl / 60)} min)`;
}

/**
 * Calculate minutes since a given timestamp string.
 */
function minutesSince(timestampStr: any) {
  if (!timestampStr) return null;
  const lastUpdate = new Date(timestampStr);
  const now = new Date();
  return (now.getTime() - lastUpdate.getTime()) / 1000 / 60;
}

/**
 * Build stream health warnings based on Redis state.
 */
function buildStreamWarnings(
  isLive: any,
  ttlIsLive: any,
  minutesSinceStatus: any,
  streamInfo: any
) {
  const warnings = [];

  if (isLive === "true" && ttlIsLive < 3600) {
    warnings.push(`Low TTL: expires in ${Math.floor(ttlIsLive / 60)} minutes`);
  }

  if (isLive === "true" && minutesSinceStatus && minutesSinceStatus > 120) {
    warnings.push(
      `No status updates for ${minutesSinceStatus.toFixed(1)} minutes`
    );
  }

  if (isLive === "true" && !streamInfo) {
    warnings.push("Stream online but no info in Redis");
  }

  if (ttlIsLive === -1) {
    warnings.push("Key without TTL (permanent)");
  }

  return warnings;
}

/**
 * DEBUG: Check stream status
 */
export const debugStreamStatus = asyncHandler(async (req: any, res: any) => {
  try {
    const redis = getRedisClient();

    // Get all stream-related keys
    const isLive = await redis.get("stream:is_live");
    const currentInfo = await redis.get("stream:current_info");
    const lastStatusUpdate = await redis.get("stream:last_status_update");
    const lastMetadataUpdate = await redis.get("stream:last_metadata_update");

    // Get TTL of keys
    const ttlIsLive = await redis.ttl("stream:is_live");
    const ttlCurrentInfo = await redis.ttl("stream:current_info");

    // Parse stream info if exists
    let streamInfo = null;
    if (currentInfo) {
      try {
        streamInfo = JSON.parse(currentInfo);
      } catch (parseError) {
        logger.warn(
          "[Stream Status] Error parsing stream:current_info:",
          parseError.message
        );
      }
    }

    // Calculate time since last updates
    const minutesSinceStatusUpdate = minutesSince(lastStatusUpdate);
    const minutesSinceMetadataUpdate = minutesSince(lastMetadataUpdate);

    // Detect inconsistencies
    const warnings = buildStreamWarnings(
      isLive,
      ttlIsLive,
      minutesSinceStatusUpdate,
      streamInfo
    );

    res.json({
      success: true,
      stream: {
        is_live: isLive === "true",
        redis_value: isLive || "not_set",
        points_enabled: isLive === "true",
        message:
          isLive === "true"
            ? "Stream LIVE - Points activated"
            : "Stream OFFLINE - Points deactivated",
      },
      stream_info: streamInfo,
      redis_metadata: {
        ttl_is_live: formatTtl(ttlIsLive),
        ttl_current_info: formatTtl(ttlCurrentInfo),
        last_status_update: lastStatusUpdate || "never",
        last_metadata_update: lastMetadataUpdate || "never",
        minutes_since_status_update: minutesSinceStatusUpdate
          ? minutesSinceStatusUpdate.toFixed(1)
          : "n/a",
        minutes_since_metadata_update: minutesSinceMetadataUpdate
          ? minutesSinceMetadataUpdate.toFixed(1)
          : "n/a",
      },
      health_check: {
        status: warnings.length === 0 ? "Healthy" : "Warnings",
        warnings: warnings,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[Stream Status] Error:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * EMERGENCY: Manually set stream status
 * POST /api/kick-webhook/debug/force-stream-state
 * Body: { "is_live": true/false, "reason": "explanation" }
 */
export const forceStreamState = asyncHandler(async (req: any, res: any) => {
  try {
    const { is_live, reason } = req.body;

    if (typeof is_live !== "boolean") {
      throw new AppError("Parameter is_live must be boolean (true/false)", 400);
    }

    const redis = getRedisClient();
    const previousState = await redis.get("stream:is_live");

    logger.warn(
      "[FORCE STREAM STATE] =========================================="
    );
    logger.warn("[FORCE STREAM STATE] MANUAL STATE CHANGE DETECTED");
    logger.warn(
      `[FORCE STREAM STATE] Previous state: ${previousState || "unknown"}`
    );
    logger.warn(
      `[FORCE STREAM STATE] New state: ${is_live ? "true" : "false"}`
    );
    logger.warn(`[FORCE STREAM STATE] Reason: ${reason || "Not specified"}`);
    logger.warn(`[FORCE STREAM STATE] Timestamp: ${new Date().toISOString()}`);
    logger.warn(
      "[FORCE STREAM STATE] =========================================="
    );

    // Update state with consistent logic: NO TTL if online, WITH TTL if offline
    if (is_live) {
      await redis.set("stream:is_live", "true");
      logger.warn(
        "[FORCE STREAM STATE] State forced to ONLINE (persistent, no TTL)"
      );
    } else {
      await redis.set("stream:is_live", "false");
      await redis.set("stream:last_webhook_status", "offline");
      logger.info(
        "[FORCE STREAM STATE] OFFLINE state confirmed directly by webhook"
      );
    }

    await redis.set(
      "stream:last_status_update",
      new Date().toISOString(),
      "EX",
      86400
    );

    // Mark as manual change
    await redis.set(
      "stream:last_manual_override",
      JSON.stringify({
        previous_state: previousState || "unknown",
        new_state: is_live ? "true" : "false",
        reason: reason || "Not specified",
        timestamp: new Date().toISOString(),
      }),
      "EX",
      86400
    ); // 24 hours

    if (is_live) {
      // If forced online, create basic info (NO TTL)
      const streamInfo = {
        title: "Stream manual override",
        broadcaster: "Manual",
        updated_by: "manual_override",
        last_update: new Date().toISOString(),
      };
      await redis.set("stream:current_info", JSON.stringify(streamInfo));
    } else {
      // If forced offline, clean up info
      await redis.del("stream:current_info");
    }

    res.json({
      success: true,
      message: "Stream state updated manually",
      previous_state: previousState || "unknown",
      new_state: is_live ? "true" : "false",
      reason: reason || "Not specified",
      warning: "This change will be reverted if a Kick webhook arrives",
      ttl_hours: 2,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[FORCE STREAM STATE] Error:", error);
    throw new AppError(error.message, 500);
  }
});

/**
 * PUBLIC ENDPOINT: Get public Kick points configuration
 * GET /api/kick/public/points-config
 */
export const getPublicPointsConfig = asyncHandler(
  async (req: any, res: any) => {
    try {
      const configs = await KickPointsConfig.findAll({
        order: [["id", "ASC"]],
      });

      const total = configs.length;
      const initialized = total > 0;

      res.json({
        config: configs.map((c: any) => ({
          id: c.id,
          config_key: c.config_key,
          config_value: c.config_value,
          enabled: c.enabled,
          description: c.description || null,
        })),
        total,
        initialized,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("[Public Points Config] Error:", error.message);
      throw new AppError("Internal server error", 500);
    }
  }
);
