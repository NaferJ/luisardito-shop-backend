import { getRedisClient } from "../../../config/redis.config";
import logger from "../../../utils/logger";

/** Payload shape for the livestream.metadata.updated event. */
interface LivestreamMetadataPayload {
  broadcaster: { username: string };
  metadata: {
    title: string;
    category?: { name: string; id: number };
    language: string;
    has_mature_content: boolean;
  };
}

/**
 * Handle livestream metadata updates
 * IMPORTANT: This event does NOT indicate if stream is online/offline
 * Only updates stream info (title, category, etc.)
 * Must NOT change stream:is_live state
 */
async function handleLivestreamMetadataUpdated(
  payload: LivestreamMetadataPayload,
  _metadata: unknown
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
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[Kick Webhook][Livestream Metadata] Error:", msg);
  }
}

export { handleLivestreamMetadataUpdated };
