const { getRedisClient } = require("../../../config/redis.config");
const logger = require("../../../utils/logger");

/**
 * Handle livestream metadata updates
 * IMPORTANT: This event does NOT indicate if stream is online/offline
 * Only updates stream info (title, category, etc.)
 * Must NOT change stream:is_live state
 */
async function handleLivestreamMetadataUpdated(payload, _metadata) {
  try {
    const redis = getRedisClient();

    logger.info("[Kick Webhook][Livestream Metadata]", {
      broadcaster: payload.broadcaster.username,
      title: payload.metadata.title,
      category: payload.metadata.category?.name,
      language: payload.metadata.language,
      has_mature_content: payload.metadata.has_mature_content,
    });

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
  } catch (error) {
    logger.error("[Kick Webhook][Livestream Metadata] Error:", error.message);
  }
}

module.exports = { handleLivestreamMetadataUpdated };
