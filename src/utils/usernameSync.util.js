const { Usuario } = require('../models');
const { Op } = require('sequelize');
const { getRedisClient } = require('../config/redis.config');
const logger = require('./logger');
const { getKickUserData, extractAvatarUrl } = require('./kickApi');

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

/**
 * Sincroniza el perfil completo del usuario (username y avatar) si ha cambiado en Kick
 *
 * @param {Object} usuario - Instancia del modelo Usuario de Sequelize
 * @param {string} kickUsername - Username actual de Kick
 * @param {string} kickUserId - ID del usuario en Kick
 * @param {boolean} forceSync - Si es true, ignora throttling y sincroniza siempre
 * @param {string} [kickProfilePicture] - URL de la foto de perfil desde el webhook (opcional)
 * @returns {Promise<{updated: boolean, reason: string, usernameChanged: boolean, avatarChanged: boolean}>}
 */
async function syncUserProfileIfNeeded(usuario, kickUsername, kickUserId, forceSync = false, kickProfilePicture = null) {
    try {
        // DEBUG: Log al inicio
        console.log(`[DEBUG SYNC PROFILE] Iniciando sync completo para ${kickUserId}: current '${usuario?.nickname}' vs new '${kickUsername}'`);

        // Validaciones básicas
        if (!usuario || !kickUsername || !kickUserId) {
            console.log(`[DEBUG SYNC PROFILE] Return: Parámetros inválidos`);
            return { updated: false, reason: 'Parámetros inválidos', usernameChanged: false, avatarChanged: false };
        }

        let usernameChanged = false;
        let avatarChanged = false;
        let needsUpdate = false;

        // Verificar si el nombre cambió
        if (usuario.nickname !== kickUsername) {
            logger.info(`[Profile Sync] Cambio de username detectado: "${usuario.nickname}" → "${kickUsername}" (ID: ${kickUserId})`);
            usernameChanged = true;
            needsUpdate = true;
        }

        // Verificar si el avatar cambió (usar webhook data si disponible, sino API)
        let newAvatarUrl = null;
        if (kickProfilePicture) {
            // Usar la foto del webhook directamente
            newAvatarUrl = kickProfilePicture;
        } else if (forceSync || usernameChanged) {
            // Solo llamar a la API si no tenemos datos del webhook
            try {
                kickUserData = await getKickUserData(kickUserId);
                newAvatarUrl = extractAvatarUrl(kickUserData);
            } catch (apiError) {
                logger.warn(`[Profile Sync] ⚠️ No se pudo obtener datos de Kick para avatar:`, apiError.message);
                // Continuar sin actualizar avatar si falla la API
            }
        }

        const currentAvatarUrl = usuario.kick_data?.avatar_url;
        if (newAvatarUrl && currentAvatarUrl !== newAvatarUrl) {
            logger.info(`[Profile Sync] Cambio de avatar detectado para ${kickUsername}`);
            avatarChanged = true;
            needsUpdate = true;
        }

        // Si no hay cambios, no hacer nada
        if (!needsUpdate) {
            console.log(`[DEBUG SYNC PROFILE] Return: Perfil sin cambios`);
            return { updated: false, reason: 'Perfil sin cambios', usernameChanged: false, avatarChanged: false };
        }

        // Si no es forzado, verificar throttling con Redis
        if (!forceSync) {
            try {
                const redis = getRedisClient();
                const syncKey = `profile_sync:${kickUserId}`;
                const lastSync = await redis.get(syncKey);

                if (lastSync) {
                    const lastSyncDate = new Date(lastSync);
                    const hoursSinceSync = (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60);

                    logger.info(`[Profile Sync] ⏰ Última sincronización hace ${hoursSinceSync.toFixed(1)}h - Throttling activo (24h)`);
                    console.log(`[DEBUG SYNC PROFILE] Return: Throttling activo (${hoursSinceSync.toFixed(1)}h)`);
                    return {
                        updated: false,
                        reason: `Throttling: última sync hace ${hoursSinceSync.toFixed(1)}h`,
                        usernameChanged: false,
                        avatarChanged: false
                    };
                }
            } catch (redisError) {
                logger.warn(`[Profile Sync] ⚠️ Error en Redis, continuando sin throttling:`, redisError.message);
                console.log(`[DEBUG SYNC PROFILE] Error Redis, continuando sin throttling`);
            }
        }

        // Verificar colisión de username si cambió
        if (usernameChanged) {
            const colision = await Usuario.findOne({
                where: {
                    nickname: kickUsername,
                    id: { [Op.ne]: usuario.id }
                }
            });

            if (colision) {
                logger.warn(`[Profile Sync] ⚠️ COLISIÓN: "${kickUsername}" ya existe (usuario ID: ${colision.id})`);
                console.log(`[DEBUG SYNC PROFILE] Return: Colisión con usuario ${colision.id}`);
                return {
                    updated: false,
                    reason: `Colisión: nombre ya usado por usuario ID ${colision.id}`,
                    usernameChanged: false,
                    avatarChanged: false
                };
            }
        }

        // Preparar datos para actualizar
        const updateData = {
            kick_data: {
                ...usuario.kick_data,
                username: kickUsername,
                last_sync: new Date().toISOString()
            }
        };

        if (usernameChanged) {
            updateData.nickname = kickUsername;
        }

        if (avatarChanged && newAvatarUrl) {
            updateData.kick_data.avatar_url = newAvatarUrl;
        }

        // Actualizar el usuario
        const oldNickname = usuario.nickname;
        const oldAvatarUrl = usuario.kick_data?.avatar_url;

        try {
            await usuario.update(updateData);
        } catch (updateError) {
            console.log(`[DEBUG SYNC PROFILE] Error en update: ${updateError.message}`);
            logger.error(`[Profile Sync] ❌ Error actualizando usuario:`, updateError.message);
            return {
                updated: false,
                reason: `Error BD: ${updateError.message}`,
                usernameChanged: false,
                avatarChanged: false
            };
        }

        logger.info(`[Profile Sync] ✅ Usuario ID ${usuario.id} actualizado: ${usernameChanged ? `"${oldNickname}" → "${kickUsername}"` : 'username sin cambio'}${avatarChanged ? ', avatar actualizado' : ''}`);
        console.log(`[DEBUG SYNC PROFILE] Update exitoso: username=${usernameChanged}, avatar=${avatarChanged}`);

        // Guardar en Redis que ya sincronizamos (expira en 24 horas)
        if (!forceSync) {
            try {
                const redis = getRedisClient();
                const syncKey = `profile_sync:${kickUserId}`;
                await redis.set(syncKey, new Date().toISOString(), 'EX', 86400); // 24 horas
                logger.info(`[Profile Sync] 📅 Throttling activado por 24h para usuario ${kickUserId}`);
                console.log(`[DEBUG SYNC PROFILE] Throttling guardado en Redis`);
            } catch (redisError) {
                logger.warn(`[Profile Sync] ⚠️ Error guardando throttling en Redis:`, redisError.message);
                console.log(`[DEBUG SYNC PROFILE] Error guardando throttling en Redis`);
                // No fallar si Redis falla
            }
        }

        return {
            updated: true,
            reason: 'Sincronización exitosa',
            usernameChanged,
            avatarChanged,
            oldNickname: usernameChanged ? oldNickname : null,
            newNickname: usernameChanged ? kickUsername : null,
            oldAvatarUrl: avatarChanged ? oldAvatarUrl : null,
            newAvatarUrl: avatarChanged ? updateData.kick_data.avatar_url : null
        };

    } catch (error) {
        logger.error(`[Profile Sync] ❌ Error sincronizando perfil:`, error.message);
        console.log(`[DEBUG SYNC PROFILE] Error general: ${error.message}`);
        return {
            updated: false,
            reason: `Error: ${error.message}`,
            usernameChanged: false,
            avatarChanged: false
        };
    }
}

module.exports = {
    syncUsernameIfNeeded,
    syncUserProfileIfNeeded
};
