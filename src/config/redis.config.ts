import Redis, { type RedisOptions } from "ioredis";
import logger from "../utils/logger";

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    const options: RedisOptions = {
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB || 0),
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    };

    redisClient = new Redis(options);

    redisClient.on("connect", () => {
      logger.info("[Redis] Connected successfully");
    });

    redisClient.on("error", (err: Error) => {
      logger.error("[Redis] Connection error:", err.message);
    });

    redisClient.on("reconnecting", () => {
      logger.info("[Redis] Reconnecting...");
    });
  }

  return redisClient;
}

export { getRedisClient };
