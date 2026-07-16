/* eslint-disable @typescript-eslint/no-explicit-any */
// TEMPORARY eslint override — to be removed in the typing pass

import Redis from "ioredis";
import logger from "../utils/logger";

let redisClient: any = null;

function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0,
      retryStrategy: (times: any) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    } as any);

    redisClient.on("connect", () => {
      logger.info("[Redis] Connected successfully");
    });

    redisClient.on("error", (err: any) => {
      logger.error("[Redis] Connection error:", err.message);
    });

    redisClient.on("reconnecting", () => {
      logger.info("[Redis] Reconnecting...");
    });
  }

  return redisClient;
}

export { getRedisClient };
