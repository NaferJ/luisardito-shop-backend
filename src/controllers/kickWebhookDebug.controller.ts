/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import asyncHandler from "../utils/asyncHandler";
import AppError from "../utils/AppError";
import { KickPointsConfig } from "../models";
import { getRedisClient } from "../config/redis.config";
import logger from "../utils/logger";

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
