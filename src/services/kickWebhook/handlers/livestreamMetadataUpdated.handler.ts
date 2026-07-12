import { getRedisClient } from "../../../config/redis.config";
import logger from "../../../utils/logger";

/**
 * Handle livestream metadata updates
 * IMPORTANT: This event does NOT indicate if stream is online/offline
 * Only updates stream info (title, category, etc.)
 * Must NOT change stream:is_live state
 */
export async function handleLivestreamMetadataUpdated(
  payload: any,
  _metadata: any
) {
  try {
    const redis = getRedisClient();

    logger.info("[Kick Webhook][Livestream Metadata]", {
      broadcaster: payload.broadcaster.username,
      title: payload.metadata.title,
      category: payload.metadata.category?.name,
      language: payload.metadata.language,
      has_mature_content: payload.metadata.has_mature_content,
    });

    // Get current state (do NOT modify here)
    const currentState = await redis.get("stream:is_live");

    // Update only metadata info
    const streamInfo = {
      title: payload.metadata.title || "Untitled",
      category: payload.metadata.category?.name || "Uncategorized",
      category_id: payload.metadata.category?.id,
      language: payload.metadata.language || "en",
      has_mature_content: payload.metadata.has_mature_content || false,
      broadcaster: payload.broadcaster?.username,
      updated_by: "metadata.updated",
      last_update: new Date().toISOString(),
    };

    // Stream info NO TTL
    await redis.set("stream:current_info", JSON.stringify(streamInfo));

    logger.info(
      `[STREAM METADATA] Metadata updated: "${streamInfo.title}" - ${streamInfo.category}`
    );
    logger.info(
      `[STREAM METADATA] Current stream state: ${currentState === "true" ? "ONLINE" : "OFFLINE"} (unchanged)`
    );
  } catch (error) {
    logger.error("[Kick Webhook][Livestream Metadata] Error:", error.message);
  }
}
