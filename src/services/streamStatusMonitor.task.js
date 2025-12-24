const cron = require('node-cron');
const axios = require('axios');
const { getRedisClient } = require('../config/redis.config');
const logger = require('../utils/logger');

/**
 * 🔍 Monitor de estado del stream mediante API oficial de Kick
 * 
 * Problema: Kick no siempre envía el webhook livestream.status.updated con is_live=false
 * cuando un stream termina.
 * 
 * Solución OFICIAL: Consultar periódicamente la API pública de Kick para verificar
 * el estado real del stream y sincronizar con Redis.
 * 
 * API: GET https://kick.com/api/v2/channels/{username}/livestream
 * - Retorna datos del stream si está online
 * - Retorna null o 404 si está offline
 */

const CHECK_INTERVAL_MINUTES = 2; // Verificar cada 2 minutos
const OFFLINE_CONFIRMATION_THRESHOLD = 2; // Número de polls fallidos seguidos para confirmar offline

/**
 * Obtiene el username del broadcaster desde la configuración
 */
async function getBroadcasterUsername() {
    // Intentar obtener desde Redis cache primero
    const redis = getRedisClient();
    const cachedUsername = await redis.get('broadcaster:username');
    
    if (cachedUsername) {
        return cachedUsername;
    }
    
    // Si no está en cache, usar el servicio de broadcasterInfo
    try {
        const broadcasterInfo = require('./broadcasterInfo.service');
        const info = await broadcasterInfo.getBroadcasterInfo();
        
        if (info && info.username) {
            // Cachear por 24 horas
            await redis.set('broadcaster:username', info.username, 'EX', 86400);
            return info.username;
        }
    } catch (error) {
        logger.error('❌ [STREAM MONITOR] Error obteniendo username del broadcaster:', error.message);
    }
    
    // Fallback: usar 'luisardito' (hardcoded como último recurso)
    logger.warn('⚠️  [STREAM MONITOR] Usando username hardcoded: luisardito');
    return 'luisardito';
}

/**
 * Consulta la API oficial de Kick para obtener el estado real del stream
 */
async function checkStreamStatusViaAPI() {
    try {
        const username = await getBroadcasterUsername();
        const apiUrl = `https://kick.com/api/v2/channels/${username}/livestream`;
        
        logger.debug(`🔍 [STREAM MONITOR] Consultando API de Kick: ${apiUrl}`);
        
        const response = await axios.get(apiUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'LuisarditoBot/1.0'
            }
        });
        
        const livestreamData = response.data;
        
        // Si hay datos de livestream, el stream está online
        if (livestreamData && livestreamData.id) {
            logger.info(`✅ [STREAM MONITOR] API confirma: Stream ONLINE`);
            logger.debug(`📺 [STREAM MONITOR] Stream ID: ${livestreamData.id}`);
            logger.debug(`📺 [STREAM MONITOR] Título: "${livestreamData.session_title || 'Sin título'}"`);
            
            return {
                is_live: true,
                stream_data: {
                    id: livestreamData.id,
                    title: livestreamData.session_title,
                    started_at: livestreamData.created_at,
                    category: livestreamData.categories?.[0]?.name || null,
                    viewers: livestreamData.viewer_count || 0
                }
            };
        } else {
            logger.info(`🔴 [STREAM MONITOR] API confirma: Stream OFFLINE (sin datos de livestream)`);
            return {
                is_live: false,
                stream_data: null
            };
        }
        
    } catch (error) {
        // 404 o error de red significa que el stream está offline
        if (error.response?.status === 404) {
            logger.info(`🔴 [STREAM MONITOR] API confirma: Stream OFFLINE (404)`);
            return {
                is_live: false,
                stream_data: null
            };
        }
        
        logger.error('❌ [STREAM MONITOR] Error consultando API de Kick:', error.message);
        
        // En caso de error, retornar estado desconocido
        return {
            is_live: null,
            error: error.message
        };
    }
}

/**
 * Sincroniza el estado del stream en Redis con el estado real de la API
 */
async function syncStreamStatus() {
    try {
        const redis = getRedisClient();
        
        // 1. Obtener estado actual en Redis
        const currentRedisState = await redis.get('stream:is_live');
        
        // 2. Consultar estado real desde la API de Kick
        const apiStatus = await checkStreamStatusViaAPI();
        
        // 3. Si hubo error en la API, no hacer nada
        if (apiStatus.is_live === null) {
            logger.warn('⚠️  [STREAM MONITOR] No se pudo verificar estado - manteniendo estado actual');
            return {
                action: 'none',
                reason: 'api_error',
                current_redis_state: currentRedisState || 'not_set'
            };
        }
        
        // 4. Lógica de debounce y sincronización
        const now = new Date();
        
        if (apiStatus.is_live) {
            // Stream está ONLINE según API - actualizar inmediatamente
            await redis.set('stream:is_live', 'true');
            await redis.set('stream:last_status_update', now.toISOString(), 'EX', 86400);
            await redis.set('stream:offline_poll_failures', 0); // Resetear contador de fallos

            // Guardar información del stream
            const streamInfo = {
                title: apiStatus.stream_data.title || 'Sin título',
                category: apiStatus.stream_data.category || 'Sin categoría',
                started_at: apiStatus.stream_data.started_at,
                viewers: apiStatus.stream_data.viewers,
                updated_by: 'api_sync',
                last_update: now.toISOString()
            };
            await redis.set('stream:current_info', JSON.stringify(streamInfo));
            
            logger.info('✅ [STREAM MONITOR] Estado corregido a ONLINE');
            logger.info('🟢 [STREAM] EN VIVO - Puntos por chat ACTIVADOS');
            
            return {
                action: 'corrected',
                previous_state: currentRedisState || 'not_set',
                new_state: 'true',
                method: 'api_sync',
                stream_data: apiStatus.stream_data
            };

        } else {
            // Stream está OFFLINE según API - aplicar debounce
            const currentFailures = parseInt(await redis.get('stream:offline_poll_failures') || '0');
            const newFailures = currentFailures + 1;
            await redis.set('stream:offline_poll_failures', newFailures);

            const lastWebhookStatus = await redis.get('stream:last_webhook_status');
            const shouldConfirmOffline = newFailures >= OFFLINE_CONFIRMATION_THRESHOLD || lastWebhookStatus === 'offline';

            if (shouldConfirmOffline) {
                // Confirmar offline
                await redis.set('stream:is_live', 'false', 'EX', 86400);
                await redis.set('stream:last_status_update', now.toISOString(), 'EX', 86400);
                await redis.del('stream:current_info');
                await redis.set('stream:offline_poll_failures', 0); // Resetear contador

                // Registrar corrección automática
                await redis.set('stream:last_auto_correction', JSON.stringify({
                    corrected_at: now.toISOString(),
                    previous_redis_state: currentRedisState || 'not_set',
                    api_state: 'offline',
                    reason: 'api_sync_with_debounce',
                    failures_count: newFailures
                }), 'EX', 86400);

                logger.info('✅ [STREAM MONITOR] Estado corregido a OFFLINE (con debounce)');
                logger.info('🔴 [STREAM] OFFLINE - Puntos por chat DESACTIVADOS');

                return {
                    action: 'corrected',
                    previous_state: currentRedisState || 'not_set',
                    new_state: 'false',
                    method: 'api_sync_debounced',
                    failures: newFailures,
                    stream_data: null
                };
            } else {
                // Offline sospechado, pero no confirmado aún
                logger.warn(`⚠️  [STREAM MONITOR] Offline sospechado (${newFailures}/${OFFLINE_CONFIRMATION_THRESHOLD} fallos) - esperando confirmación`);
                return {
                    action: 'none',
                    reason: 'offline_suspected_waiting_confirmation',
                    current_failures: newFailures,
                    threshold: OFFLINE_CONFIRMATION_THRESHOLD
                };
            }
        }

    } catch (error) {
        logger.error('❌ [STREAM MONITOR] Error sincronizando estado:', error.message);
        return {
            action: 'error',
            error: error.message
        };
    }
}

/**
 * Inicia el monitor de estado del stream
 */
function startStreamMonitor() {
    // Verificar si el monitor está habilitado
    const isEnabled = process.env.STREAM_MONITOR_ENABLED === 'true';

    if (!isEnabled) {
        logger.info('🔍 [STREAM MONITOR] ==========================================');
        logger.info('🔍 [STREAM MONITOR] Monitor DESHABILITADO por configuración');
        logger.info('🔍 [STREAM MONITOR] Para habilitar: STREAM_MONITOR_ENABLED=true');
        logger.info('🔍 [STREAM MONITOR] ==========================================');
        return;
    }

    logger.info('🔍 [STREAM MONITOR] ==========================================');
    logger.info('🔍 [STREAM MONITOR] Iniciando monitor de estado del stream');
    logger.info('🔍 [STREAM MONITOR] Método: Polling a API oficial de Kick');
    logger.info(`🔍 [STREAM MONITOR] Frecuencia: cada ${CHECK_INTERVAL_MINUTES} minutos`);
    logger.info('🔍 [STREAM MONITOR] API: https://kick.com/api/v2/channels/{username}/livestream');
    logger.info('🔍 [STREAM MONITOR] ==========================================');
    
    // Ejecutar verificación cada CHECK_INTERVAL_MINUTES minutos
    const cronExpression = `*/${CHECK_INTERVAL_MINUTES} * * * *`;
    
    cron.schedule(cronExpression, async () => {
        logger.info('🔍 [STREAM MONITOR] Ejecutando verificación periódica...');
        const result = await syncStreamStatus();
        logger.debug('🔍 [STREAM MONITOR] Resultado:', JSON.stringify(result, null, 2));
    });
    
    logger.info(`✅ [STREAM MONITOR] Monitor iniciado - cron: ${cronExpression}`);
    
    // Ejecutar una verificación inicial inmediatamente
    setTimeout(async () => {
        logger.info('🔍 [STREAM MONITOR] Ejecutando verificación inicial...');
        await syncStreamStatus();
    }, 5000); // Esperar 5 segundos después del inicio
}

/**
 * Función exportada para verificación manual
 */
async function manualCheck() {
    logger.info('🔧 [STREAM MONITOR] Verificación MANUAL solicitada');
    const result = await syncStreamStatus();
    logger.info('🔧 [STREAM MONITOR] Resultado verificación manual:', JSON.stringify(result, null, 2));
    return result;
}

module.exports = {
    startStreamMonitor,
    syncStreamStatus,
    manualCheck
};
