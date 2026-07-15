/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import { getRedisClient } from "../../../config/redis.config";
import logger from "../../../utils/logger";

/**
 * Validate event timestamp — warn if event is too old.
 */
function warnIfStaleTimestamp(timestamp: any) {
  if (!timestamp) return;

  const eventTimestamp = new Date(timestamp);
  const now = new Date();
  const ageMinutes = (now.getTime() - eventTimestamp.getTime()) / 1000 / 60;

  if (ageMinutes > 5) {
    logger.warn(
      `[STREAM STATUS] Event too old (${ageMinutes.toFixed(2)} minutes)`
    );
    logger.warn(`[STREAM STATUS] May be outdated, processing with caution`);
  }
}

/**
 * Handle livestream status changes
 */
async function handleLivestreamStatusUpdated(payload: any, metadata: any) {
  try {
    const isLive = payload.is_live;
    const redis = getRedisClient();

    logger.info("[Kick Webhook][Livestream Status]", {
      broadcaster: payload.broadcaster.username,
      is_live: isLive,
      title: payload.title,
      started_at: payload.started_at,
      ended_at: payload.ended_at,
      event_timestamp: metadata.timestamp,
      current_timestamp: new Date().toISOString(),
    });

    // Validate event timestamp (do not process very old events)
    warnIfStaleTimestamp(metadata.timestamp);

    // Get previous state from Redis
    const previousState = await redis.get("stream:is_live");
    const stateChanged = previousState !== (isLive ? "true" : "false");

    if (stateChanged) {
      logger.info(
        `[STREAM STATUS] CHANGE DETECTED: ${previousState || "unknown"} -> ${isLive ? "true" : "false"}`
      );
    } else {
      logger.info(
        `[STREAM STATUS] State unchanged: ${isLive ? "online" : "offline"}`
      );
    }

    // Update state in Redis with debounce logic
    // Webhooks are a fast source, but offline requires confirmation
    if (isLive) {
      // Stream ONLINE: NO TTL (persists indefinitely)
      await redis.set("stream:is_live", "true");
      await redis.set("stream:last_webhook_status", "online");
      await redis.set("stream:offline_poll_failures", 0); // Reset failure counter
      logger.info("[STREAM STATUS] ONLINE state saved (payload.is_live=true)");
    } else {
      // Stream OFFLINE: Mark directly as offline (without waiting for monitor)
      await redis.set("stream:is_live", "false");
      await redis.set("stream:last_webhook_status", "offline");
      logger.info(
        "[STREAM STATUS] OFFLINE state confirmed directly by webhook"
      );
    }

    // Save last update timestamp (always with TTL for cleanup)
    await redis.set(
      "stream:last_status_update",
      new Date().toISOString(),
      "EX",
      86400
    );

    // Save additional stream info
    if (isLive) {
      const streamInfo = {
        title: payload.title || "Untitled",
        started_at: payload.started_at,
        broadcaster: payload.broadcaster?.username,
        updated_by: "status.updated",
      };
      // Stream info NO TTL while online
      await redis.set("stream:current_info", JSON.stringify(streamInfo));
    } else {
      // When stream ends, clean up info
      await redis.del("stream:current_info");
      logger.info("[STREAM STATUS] Stream info cleaned");
    }

    logger.info(
      isLive
        ? "[STREAM] LIVE - Chat points ACTIVATED"
        : "[STREAM] OFFLINE - Chat points DEACTIVATED"
    );
  } catch (error) {
    logger.error("[Kick Webhook][Livestream Status] Error:", error);
    logger.error("[Kick Webhook][Livestream Status] Stack:", error.stack);
  }
}

export { handleLivestreamStatusUpdated };
