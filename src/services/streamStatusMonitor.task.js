const cron = require('node-cron');
const { getRedisClient } = require('../config/redis.config');
const logger = require('../utils/logger');

/**
 * 🔍 Monitor de estado del stream
 * 
 * Verifica cada 5 minutos si el stream debería estar offline
 * basándose en la ausencia de metadata.updated
 * 
 * LÓGICA:
 * - metadata.updated SOLO se envía cuando el stream está EN VIVO
 * - Si pasan más de 15 minutos sin metadata.updated, el stream está offline
 * - Esto detecta casos donde Kick no envió el webhook de status.updated
 */

const METADATA_TIMEOUT_MINUTES = 15; // Timeout en minutos
const CHECK_INTERVAL_MINUTES = 5;     // Frecuencia de verificación

/**
 * Verifica si el stream está realmente online basado en metadata.updated
 */
async function checkStreamTimeout() {
    try {
        const redis = getRedisClient();
        
        // Obtener estado actual
        const isLive = await redis.get('stream:is_live');
        const lastMetadataUpdate = await redis.get('stream:last_metadata_update');
        
        // Solo verificar si está marcado como online
        if (isLive !== 'true') {
            logger.debug('🔍 [STREAM MONITOR] Stream ya está offline, no hay nada que verificar');
            return;
        }
        
        // Si no hay metadata, no podemos determinar nada
        if (!lastMetadataUpdate) {
            logger.debug('🔍 [STREAM MONITOR] No hay historial de metadata.updated');
            return;
        }
        
        // Calcular tiempo transcurrido desde el último metadata.updated
        const lastMetadataTime = new Date(lastMetadataUpdate);
        const now = new Date();
        const minutesSinceMetadata = (now - lastMetadataTime) / 1000 / 60;
        
        logger.debug(
            `🔍 [STREAM MONITOR] Verificación: ${minutesSinceMetadata.toFixed(2)} minutos sin metadata.updated (límite: ${METADATA_TIMEOUT_MINUTES} min)`
        );
        
        // Si pasó el timeout, marcar como offline
        if (minutesSinceMetadata > METADATA_TIMEOUT_MINUTES) {
            logger.warn(
                '⚠️ [STREAM MONITOR] =========================================='
            );
            logger.warn(
                '⚠️ [STREAM MONITOR] TIMEOUT DETECTADO - Stream probablemente offline'
            );
            logger.warn(
                `⚠️ [STREAM MONITOR] Han pasado ${minutesSinceMetadata.toFixed(2)} minutos sin metadata.updated`
            );
            logger.warn(
                `⚠️ [STREAM MONITOR] Límite de timeout: ${METADATA_TIMEOUT_MINUTES} minutos`
            );
            logger.warn(
                '⚠️ [STREAM MONITOR] Causa probable: Kick no envió webhook de status.updated'
            );
            logger.warn(
                '⚠️ [STREAM MONITOR] Marcando stream como OFFLINE automáticamente'
            );
            logger.warn(
                '⚠️ [STREAM MONITOR] =========================================='
            );
            
            // Marcar como offline con TTL de 24 horas
            await redis.set('stream:is_live', 'false', 'EX', 86400);
            
            // Actualizar timestamp de última actualización de status
            await redis.set(
                'stream:last_status_update',
                new Date().toISOString(),
                'EX',
                86400
            );
            
            // Limpiar información del stream
            await redis.del('stream:current_info');
            
            // Registrar el timeout automático
            await redis.set(
                'stream:last_auto_timeout',
                JSON.stringify({
                    timestamp: new Date().toISOString(),
                    minutes_since_metadata: minutesSinceMetadata.toFixed(2),
                    reason: 'No metadata.updated received - webhook probably failed',
                    last_metadata_update: lastMetadataUpdate
                }),
                'EX',
                86400 * 7 // 7 días para debugging
            );
            
            logger.info(
                '✅ [STREAM MONITOR] Stream marcado como OFFLINE automáticamente'
            );
            logger.info(
                '🔴 [STREAM] OFFLINE - Puntos por chat DESACTIVADOS (timeout automático)'
            );
            
        } else {
            // Todo está bien, el stream sigue recibiendo metadata.updated
            logger.debug(
                `✅ [STREAM MONITOR] Stream online confirmado (${minutesSinceMetadata.toFixed(2)} min desde último metadata)`
            );
        }
        
    } catch (error) {
        logger.error('❌ [STREAM MONITOR] Error verificando timeout:', error.message);
        logger.error('❌ [STREAM MONITOR] Stack:', error.stack);
    }
}

/**
 * Inicia el monitor de estado del stream
 */
function startStreamMonitor() {
    // Ejecutar cada 5 minutos
    const cronExpression = `*/${CHECK_INTERVAL_MINUTES} * * * *`;
    
    logger.info('🔍 [STREAM MONITOR] ==========================================');
    logger.info('🔍 [STREAM MONITOR] Iniciando monitor de estado del stream');
    logger.info(`🔍 [STREAM MONITOR] Frecuencia: cada ${CHECK_INTERVAL_MINUTES} minutos`);
    logger.info(`🔍 [STREAM MONITOR] Timeout de metadata: ${METADATA_TIMEOUT_MINUTES} minutos`);
    logger.info('🔍 [STREAM MONITOR] Expresión cron:', cronExpression);
    logger.info('🔍 [STREAM MONITOR] ==========================================');
    
    // Programar tarea
    cron.schedule(cronExpression, async () => {
        logger.debug('🔍 [STREAM MONITOR] Ejecutando verificación periódica...');
        await checkStreamTimeout();
    });
    
    // Ejecutar primera verificación inmediatamente
    logger.info('🔍 [STREAM MONITOR] Ejecutando verificación inicial...');
    setTimeout(() => {
        checkStreamTimeout();
    }, 5000); // Esperar 5 segundos después del inicio
    
    logger.info('✅ [STREAM MONITOR] Monitor iniciado correctamente');
}

/**
 * Verificación manual del estado (para debugging)
 */
async function manualCheck() {
    logger.info('🔧 [STREAM MONITOR] Verificación manual solicitada');
    await checkStreamTimeout();
}

module.exports = {
    startStreamMonitor,
    checkStreamTimeout,
    manualCheck
};
