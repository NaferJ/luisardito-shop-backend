const Redis = require('ioredis');

let redisClient = null;

function getRedisClient() {
    if (!redisClient) {
        redisClient = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            db: process.env.REDIS_DB || 0,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: false
        });

        redisClient.on('connect', () => {
            console.log('✅ [Redis] Conectado exitosamente');
        });

        redisClient.on('error', (err) => {
            console.error('❌ [Redis] Error de conexión:', err.message);
        });

        redisClient.on('reconnecting', () => {
            console.log('🔄 [Redis] Reconectando...');
        });
    }

    return redisClient;
}

module.exports = { getRedisClient };