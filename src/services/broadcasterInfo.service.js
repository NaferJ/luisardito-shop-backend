const { getRedisClient } = require('../config/redis.config');
const config = require('../../config');
const logger = require('../utils/logger');

/**
 * Servicio para obtener información completa del broadcaster principal
 * Incluye estado del stream, metadata, estadísticas y más
 */
class BroadcasterInfoService {
    /**
     * Obtiene toda la información pública del broadcaster
     * @returns {Promise<Object>} Información completa del broadcaster
     */
    async getBroadcasterInfo() {
        try {
            const redis = getRedisClient();
            
            // Información básica del broadcaster (desde configuración)
            const broadcasterId = config.kick.broadcasterId;
            const broadcasterUsername = 'Luisardito'; // Hardcoded por ahora
            
            // Obtener estado del stream desde Redis
            const isLive = await redis.get('stream:is_live');
            const isOnline = isLive === 'true';
            
            // Obtener información detallada del stream
            let streamInfo = null;
            const streamInfoRaw = await redis.get('stream:current_info');
            if (streamInfoRaw) {
                try {
                    streamInfo = JSON.parse(streamInfoRaw);
                } catch (err) {
                    logger.error('[BroadcasterInfo] Error parseando stream info:', err.message);
                }
            }
            
            // Obtener timestamps relevantes
            const lastStatusUpdate = await redis.get('stream:last_status_update');
            const lastMetadataUpdate = await redis.get('stream:last_metadata_update');
            
            // Calcular tiempo en vivo (si está online)
            let uptimeMinutes = null;
            let startedAt = null;
            if (isOnline && streamInfo?.started_at) {
                startedAt = streamInfo.started_at;
                const startTime = new Date(startedAt);
                const now = new Date();
                uptimeMinutes = Math.floor((now - startTime) / 1000 / 60);
            }
            
            // Calcular tiempo desde último stream (si está offline)
            let lastLiveAgo = null;
            if (!isOnline && lastStatusUpdate) {
                const lastUpdate = new Date(lastStatusUpdate);
                const now = new Date();
                const minutesAgo = Math.floor((now - lastUpdate) / 1000 / 60);
                
                if (minutesAgo < 60) {
                    lastLiveAgo = `Hace ${minutesAgo} minuto${minutesAgo !== 1 ? 's' : ''}`;
                } else if (minutesAgo < 1440) {
                    const hoursAgo = Math.floor(minutesAgo / 60);
                    lastLiveAgo = `Hace ${hoursAgo} hora${hoursAgo !== 1 ? 's' : ''}`;
                } else {
                    const daysAgo = Math.floor(minutesAgo / 1440);
                    lastLiveAgo = `Hace ${daysAgo} día${daysAgo !== 1 ? 's' : ''}`;
                }
            }
            
            // Construir respuesta completa
            const broadcasterInfo = {
                // Información básica
                username: broadcasterUsername,
                user_id: broadcasterId,
                profile_picture: `/logo2.jpg`, // Ruta a la imagen del broadcaster
                channel_url: `https://kick.com/${broadcasterUsername.toLowerCase()}`,
                is_verified: true, // Luisardito está verificado
                
                // Estado del stream
                stream: {
                    is_live: isOnline,
                    status: isOnline ? 'online' : 'offline',
                    title: streamInfo?.title || null,
                    category: streamInfo?.category || null,
                    category_id: streamInfo?.category_id || null,
                    language: streamInfo?.language || 'es',
                    has_mature_content: streamInfo?.has_mature_content || false,
                    started_at: startedAt,
                    uptime_minutes: uptimeMinutes,
                    last_live_ago: lastLiveAgo,
                },
                
                // Timestamps de actualización
                metadata: {
                    last_status_update: lastStatusUpdate,
                    last_metadata_update: lastMetadataUpdate,
                    data_updated_at: new Date().toISOString(),
                }
            };
            
            logger.info(`[BroadcasterInfo] Info obtenida: ${broadcasterUsername} - ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
            
            return broadcasterInfo;
            
        } catch (error) {
            logger.error('[BroadcasterInfo] Error obteniendo información del broadcaster:', error.message);
            
            // Retornar información básica en caso de error
            return {
                username: 'Luisardito',
                user_id: config.kick.broadcasterId,
                profile_picture: `/logo2.jpg`,
                channel_url: `https://kick.com/luisardito`,
                is_verified: true,
                stream: {
                    is_live: false,
                    status: 'unknown',
                    title: null,
                    category: null,
                    category_id: null,
                    language: 'es',
                    has_mature_content: false,
                    started_at: null,
                    uptime_minutes: null,
                    last_live_ago: null,
                },
                metadata: {
                    last_status_update: null,
                    last_metadata_update: null,
                    data_updated_at: new Date().toISOString(),
                    error: 'Error obteniendo datos del servidor'
                }
            };
        }
    }
    
    /**
     * Obtiene solo el estado básico del stream (más rápido)
     * @returns {Promise<Object>} Estado básico del stream
     */
    async getStreamStatus() {
        try {
            const redis = getRedisClient();
            const isLive = await redis.get('stream:is_live');
            
            return {
                is_live: isLive === 'true',
                status: isLive === 'true' ? 'online' : 'offline',
                checked_at: new Date().toISOString()
            };
        } catch (error) {
            logger.error('[BroadcasterInfo] Error obteniendo estado del stream:', error.message);
            return {
                is_live: false,
                status: 'unknown',
                checked_at: new Date().toISOString(),
                error: error.message
            };
        }
    }
}

module.exports = new BroadcasterInfoService();
