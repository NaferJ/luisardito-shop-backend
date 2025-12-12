const { Usuario } = require('../models');
const { Op } = require('sequelize');
const { getRedisClient } = require('../config/redis.config');
const logger = require('./logger');

/**
 * Sincroniza el username del usuario si ha cambiado en Kick
 * 
 * @param {Object} usuario - Instancia del modelo Usuario de Sequelize
 * @param {string} kickUsername - Username actual de Kick
 * @param {string} kickUserId - ID del usuario en Kick
 * @param {boolean} forceSync - Si es true, ignora throttling y sincroniza siempre
 * @returns {Promise<{updated: boolean, reason: string}>}
 */
async function syncUsernameIfNeeded(usuario, kickUsername, kickUserId, forceSync = false) {
    try {
        // DEBUG: Log al inicio
        console.log(`[DEBUG SYNC] Iniciando sync para ${kickUserId}: current '${usuario?.nickname}' vs new '${kickUsername}'`);

        // Validaciones básicas
        if (!usuario || !kickUsername || !kickUserId) {
            console.log(`[DEBUG SYNC] Return: Parámetros inválidos`);
            return { updated: false, reason: 'Parámetros inválidos' };
        }

        // Si el nombre no ha cambiado, no hacer nada
        if (usuario.nickname === kickUsername) {
            console.log(`[DEBUG SYNC] Return: Nombre sin cambios`);
            return { updated: false, reason: 'Nombre sin cambios' };
        }

        logger.info(`[Username Sync] Cambio detectado: "${usuario.nickname}" → "${kickUsername}" (ID: ${kickUserId})`);

        // Si no es forzado, verificar throttling con Redis
        if (!forceSync) {
            try {
                const redis = getRedisClient();
                const syncKey = `username_sync:${kickUserId}`;
                const lastSync = await redis.get(syncKey);

                if (lastSync) {
                    const lastSyncDate = new Date(lastSync);
                    const hoursSinceSync = (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60);
                    
                    logger.info(`[Username Sync] ⏰ Última sincronización hace ${hoursSinceSync.toFixed(1)}h - Throttling activo (24h)`);
                    console.log(`[DEBUG SYNC] Return: Throttling activo (${hoursSinceSync.toFixed(1)}h)`);
                    return { 
                        updated: false, 
                        reason: `Throttling: última sync hace ${hoursSinceSync.toFixed(1)}h`
                    };
                }
            } catch (redisError) {
                logger.warn(`[Username Sync] ⚠️ Error en Redis, continuando sin throttling:`, redisError.message);
                console.log(`[DEBUG SYNC] Error Redis, continuando sin throttling`);
            }
        }

        // Verificar colisión: el nuevo nombre ya existe en otro usuario
        const colision = await Usuario.findOne({
            where: { 
                nickname: kickUsername,
                id: { [Op.ne]: usuario.id }
            }
        });

        if (colision) {
            logger.warn(`[Username Sync] ⚠️ COLISIÓN: "${kickUsername}" ya existe (usuario ID: ${colision.id})`);
            console.log(`[DEBUG SYNC] Return: Colisión con usuario ${colision.id}`);
            return { 
                updated: false, 
                reason: `Colisión: nombre ya usado por usuario ID ${colision.id}` 
            };
        }

        // Actualizar el usuario
        const oldNickname = usuario.nickname;
        try {
            await usuario.update({ 
                nickname: kickUsername,
                kick_data: {
                    ...usuario.kick_data,
                    username: kickUsername,
                    last_sync: new Date().toISOString()
                }
            });
        } catch (updateError) {
            console.log(`[DEBUG SYNC] Error en update: ${updateError.message}`);
            logger.error(`[Username Sync] ❌ Error actualizando usuario:`, updateError.message);
            return { updated: false, reason: `Error BD: ${updateError.message}` };
        }

        logger.info(`[Username Sync] ✅ Usuario ID ${usuario.id} actualizado: "${oldNickname}" → "${kickUsername}"`);
        console.log(`[DEBUG SYNC] Update exitoso: "${oldNickname}" → "${kickUsername}"`);

        // Guardar en Redis que ya sincronizamos (expira en 24 horas)
        if (!forceSync) {
            try {
                const redis = getRedisClient();
                const syncKey = `username_sync:${kickUserId}`;
                await redis.set(syncKey, new Date().toISOString(), 'EX', 86400); // 24 horas
                logger.info(`[Username Sync] 📅 Throttling activado por 24h para usuario ${kickUserId}`);
                console.log(`[DEBUG SYNC] Throttling guardado en Redis`);
            } catch (redisError) {
                logger.warn(`[Username Sync] ⚠️ Error guardando throttling en Redis:`, redisError.message);
                console.log(`[DEBUG SYNC] Error guardando throttling en Redis`);
                // No fallar si Redis falla
            }
        }

        return { 
            updated: true, 
            reason: 'Sincronización exitosa',
            oldNickname,
            newNickname: kickUsername
        };

    } catch (error) {
        logger.error(`[Username Sync] ❌ Error sincronizando username:`, error.message);        console.log(`[DEBUG SYNC] Error general: ${error.message}`);        return { 
            updated: false, 
            reason: `Error: ${error.message}` 
        };
    }
}

module.exports = {
    syncUsernameIfNeeded
};
