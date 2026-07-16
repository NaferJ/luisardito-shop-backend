import { getRedisClient } from "../config/redis.config";
import config from "../../config";
import logger from "../utils/logger";

interface StreamInfo {
  title?: string;
  category?: string;
  category_id?: number;
  language?: string;
  has_mature_content?: boolean;
  started_at?: string;
  [key: string]: unknown;
}

function parseStreamInfo(raw: string | null): StreamInfo | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StreamInfo;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[BroadcasterInfo] Error parsing stream info:", msg);
    return null;
  }
}

function computeUptime(isOnline: boolean, streamInfo: StreamInfo | null) {
  if (!isOnline || !streamInfo?.started_at) {
    return { startedAt: null, uptimeMinutes: null };
  }
  const startedAt = streamInfo.started_at;
  const startTime = new Date(startedAt);
  const now = new Date();
  const uptimeMinutes = Math.floor(
    (now.getTime() - startTime.getTime()) / 1000 / 60
  );
  return { startedAt, uptimeMinutes };
}

function formatLastLiveAgo(isOnline: boolean, lastStatusUpdate: string | null) {
  if (isOnline || !lastStatusUpdate) return null;
  const lastUpdate = new Date(lastStatusUpdate);
  const now = new Date();
  const minutesAgo = Math.floor(
    (now.getTime() - lastUpdate.getTime()) / 1000 / 60
  );

  if (minutesAgo < 60) {
    return `${minutesAgo} minute${minutesAgo !== 1 ? "s" : ""} ago`;
  }
  if (minutesAgo < 1440) {
    const hoursAgo = Math.floor(minutesAgo / 60);
    return `${hoursAgo} hour${hoursAgo !== 1 ? "s" : ""} ago`;
  }
  const daysAgo = Math.floor(minutesAgo / 1440);
  return `${daysAgo} day${daysAgo !== 1 ? "s" : ""} ago`;
}

/**
 * Service to get complete information about the main broadcaster
 * Includes stream status, metadata, statistics and more
 */
class BroadcasterInfoService {
  /**
   * Gets all public broadcaster info
   * @returns Complete broadcaster info
   */
  async getBroadcasterInfo() {
    try {
      const redis = getRedisClient();

      // Basic broadcaster info (from configuration)
      const broadcasterId = config.kick.broadcasterId;
      const broadcasterUsername = "Luisardito"; // Hardcoded for now

      // Get stream status from Redis
      const isLive = await redis.get("stream:is_live");
      const isOnline = isLive === "true";

      // Get detailed stream info
      const streamInfoRaw = await redis.get("stream:current_info");
      const streamInfo = parseStreamInfo(streamInfoRaw);

      // Get relevant timestamps
      const lastStatusUpdate = await redis.get("stream:last_status_update");
      const lastMetadataUpdate = await redis.get("stream:last_metadata_update");

      // Calculate uptime (if online)
      const { startedAt, uptimeMinutes } = computeUptime(isOnline, streamInfo);

      // Calculate time since last stream (if offline)
      const lastLiveAgo = formatLastLiveAgo(isOnline, lastStatusUpdate);

      // Build complete response
      const broadcasterInfo = {
        // Basic info
        username: broadcasterUsername,
        user_id: broadcasterId,
        profile_picture: `/logo2.jpg`, // Path to broadcaster image
        channel_url: `https://kick.com/${broadcasterUsername.toLowerCase()}`,
        is_verified: true, // Luisardito is verified

        // Stream status
        stream: {
          is_live: isOnline,
          status: isOnline ? "online" : "offline",
          title: streamInfo?.title || null,
          category: streamInfo?.category || null,
          category_id: streamInfo?.category_id || null,
          language: streamInfo?.language || "es",
          has_mature_content: streamInfo?.has_mature_content || false,
          started_at: startedAt,
          uptime_minutes: uptimeMinutes,
          last_live_ago: lastLiveAgo,
        },

        // Update timestamps
        metadata: {
          last_status_update: lastStatusUpdate,
          last_metadata_update: lastMetadataUpdate,
          data_updated_at: new Date().toISOString(),
        },
      };

      logger.info(
        `[BroadcasterInfo] Info retrieved: ${broadcasterUsername} - ${isOnline ? "ONLINE" : "OFFLINE"}`
      );

      return broadcasterInfo;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[BroadcasterInfo] Error getting broadcaster info:", msg);

      // Return basic info on error
      return {
        username: "Luisardito",
        user_id: config.kick.broadcasterId,
        profile_picture: `/logo2.jpg`,
        channel_url: `https://kick.com/luisardito`,
        is_verified: true,
        stream: {
          is_live: false,
          status: "unknown",
          title: null,
          category: null,
          category_id: null,
          language: "es",
          has_mature_content: false,
          started_at: null,
          uptime_minutes: null,
          last_live_ago: null,
        },
        metadata: {
          last_status_update: null,
          last_metadata_update: null,
          data_updated_at: new Date().toISOString(),
          error: "Error getting server data",
        },
      };
    }
  }

  /**
   * Gets only the basic stream status (faster)
   * @returns Basic stream status
   */
  async getStreamStatus() {
    try {
      const redis = getRedisClient();
      const isLive = await redis.get("stream:is_live");

      return {
        is_live: isLive === "true",
        status: isLive === "true" ? "online" : "offline",
        checked_at: new Date().toISOString(),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[BroadcasterInfo] Error getting stream status:", msg);
      return {
        is_live: false,
        status: "unknown",
        checked_at: new Date().toISOString(),
        error: msg,
      };
    }
  }
}

export = new BroadcasterInfoService();
