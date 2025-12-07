const axios = require('axios');
const config = require('../../config');
const { KickReward } = require('../models');
const logger = require('../utils/logger');

/**
 * Servicio para manejar Channel Rewards de Kick
 * Permite crear, editar, eliminar y sincronizar recompensas con la API de Kick
 */

/**
 * Obtener App Access Token para autenticación
 * @returns {Promise<string|null>}
 */
async function getAppAccessToken() {
    try {
        const tokenUrl = `${config.kick.apiBaseUrl}/oauth/token`;
        const payload = {
            grant_type: 'client_credentials',
            client_id: config.kick.clientId,
            client_secret: config.kick.clientSecret
        };

        const response = await axios.post(tokenUrl, payload, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            timeout: 15000
        });

        return response.data.access_token || null;
    } catch (error) {
        logger.error('🔑 [Kick Rewards] Error obteniendo App Access Token:', error.message);
        return null;
    }
}

/**
 * Obtener todas las recompensas del canal desde Kick
 * @returns {Promise<Array>}
 */
async function fetchRewardsFromKick() {
    try {
        const token = await getAppAccessToken();
        if (!token) {
            throw new Error('No se pudo obtener token de acceso');
        }

        logger.info('🎁 [Kick Rewards] Obteniendo recompensas desde Kick API...');

        const response = await axios.get(
            `${config.kick.apiBaseUrl}/public/v1/channels/rewards`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                },
                timeout: 10000
            }
        );

        const rewards = response.data.data || [];
        logger.info(`🎁 [Kick Rewards] ✅ ${rewards.length} recompensas obtenidas`);

        return rewards;
    } catch (error) {
        logger.error('🎁 [Kick Rewards] ❌ Error obteniendo recompensas:', error.message);
        if (error.response) {
            logger.error('🎁 [Kick Rewards] Status:', error.response.status);
            logger.error('🎁 [Kick Rewards] Response:', error.response.data);
        }
        throw error;
    }
}

/**
 * Sincronizar recompensas de Kick con nuestra base de datos
 * @returns {Promise<Object>}
 */
async function syncRewardsFromKick() {
    try {
        const kickRewards = await fetchRewardsFromKick();
        
        let synced = 0;
        let created = 0;
        let updated = 0;

        for (const kickReward of kickRewards) {
            const [reward, wasCreated] = await KickReward.upsert({
                kick_reward_id: kickReward.id,
                title: kickReward.title,
                description: kickReward.description || null,
                cost: kickReward.cost,
                background_color: kickReward.background_color || '#00e701',
                is_enabled: kickReward.is_enabled,
                is_paused: kickReward.is_paused,
                is_user_input_required: kickReward.is_user_input_required,
                should_redemptions_skip_request_queue: kickReward.should_redemptions_skip_request_queue,
                last_synced_at: new Date()
            }, {
                returning: true
            });

            if (wasCreated) {
                created++;
                logger.info(`🎁 [Sync] ✨ Nueva recompensa creada: "${kickReward.title}"`);
            } else {
                updated++;
                logger.info(`🎁 [Sync] 🔄 Recompensa actualizada: "${kickReward.title}"`);
            }
            synced++;
        }

        logger.info(`🎁 [Sync] ✅ Sincronización completada: ${synced} total (${created} nuevas, ${updated} actualizadas)`);

        return {
            success: true,
            total: synced,
            created,
            updated
        };
    } catch (error) {
        logger.error('🎁 [Sync] ❌ Error sincronizando recompensas:', error.message);
        throw error;
    }
}

/**
 * Crear nueva recompensa en Kick
 * @param {Object} rewardData - Datos de la recompensa
 * @returns {Promise<Object>}
 */
async function createRewardInKick(rewardData) {
    try {
        const token = await getAppAccessToken();
        if (!token) {
            throw new Error('No se pudo obtener token de acceso');
        }

        logger.info('🎁 [Kick Rewards] Creando recompensa en Kick:', rewardData.title);

        const response = await axios.post(
            `${config.kick.apiBaseUrl}/public/v1/channels/rewards`,
            {
                title: rewardData.title,
                description: rewardData.description || '',
                cost: rewardData.cost,
                background_color: rewardData.background_color || '#00e701',
                is_enabled: rewardData.is_enabled !== false,
                is_user_input_required: rewardData.is_user_input_required || false,
                should_redemptions_skip_request_queue: rewardData.should_redemptions_skip_request_queue || false
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 10000
            }
        );

        const kickReward = response.data.data;
        logger.info(`🎁 [Kick Rewards] ✅ Recompensa creada en Kick con ID: ${kickReward.id}`);

        // Guardar en nuestra BD
        const localReward = await KickReward.create({
            kick_reward_id: kickReward.id,
            title: kickReward.title,
            description: kickReward.description,
            cost: kickReward.cost,
            background_color: kickReward.background_color,
            puntos_a_otorgar: rewardData.puntos_a_otorgar || 0,
            is_enabled: kickReward.is_enabled,
            is_paused: kickReward.is_paused,
            is_user_input_required: kickReward.is_user_input_required,
            should_redemptions_skip_request_queue: kickReward.should_redemptions_skip_request_queue,
            auto_accept: rewardData.auto_accept !== false,
            last_synced_at: new Date()
        });

        return {
            success: true,
            reward: localReward
        };
    } catch (error) {
        logger.error('🎁 [Kick Rewards] ❌ Error creando recompensa:', error.message);
        if (error.response) {
            logger.error('🎁 [Kick Rewards] Status:', error.response.status);
            logger.error('🎁 [Kick Rewards] Response:', error.response.data);
        }
        throw error;
    }
}

/**
 * Actualizar recompensa en Kick
 * @param {string} kickRewardId - ID de la recompensa en Kick
 * @param {Object} updateData - Datos a actualizar
 * @returns {Promise<Object>}
 */
async function updateRewardInKick(kickRewardId, updateData) {
    try {
        const token = await getAppAccessToken();
        if (!token) {
            throw new Error('No se pudo obtener token de acceso');
        }

        logger.info('🎁 [Kick Rewards] Actualizando recompensa en Kick:', kickRewardId);

        const payload = {};
        if (updateData.title !== undefined) payload.title = updateData.title;
        if (updateData.description !== undefined) payload.description = updateData.description;
        if (updateData.cost !== undefined) payload.cost = updateData.cost;
        if (updateData.background_color !== undefined) payload.background_color = updateData.background_color;
        if (updateData.is_enabled !== undefined) payload.is_enabled = updateData.is_enabled;
        if (updateData.is_paused !== undefined) payload.is_paused = updateData.is_paused;
        if (updateData.is_user_input_required !== undefined) payload.is_user_input_required = updateData.is_user_input_required;
        if (updateData.should_redemptions_skip_request_queue !== undefined) {
            payload.should_redemptions_skip_request_queue = updateData.should_redemptions_skip_request_queue;
        }

        const response = await axios.patch(
            `${config.kick.apiBaseUrl}/public/v1/channels/rewards/${kickRewardId}`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 10000
            }
        );

        const kickReward = response.data.data;
        logger.info(`🎁 [Kick Rewards] ✅ Recompensa actualizada en Kick: ${kickReward.title}`);

        // Actualizar en nuestra BD
        const localReward = await KickReward.findOne({ where: { kick_reward_id: kickRewardId } });
        if (localReward) {
            await localReward.update({
                title: kickReward.title,
                description: kickReward.description,
                cost: kickReward.cost,
                background_color: kickReward.background_color,
                is_enabled: kickReward.is_enabled,
                is_paused: kickReward.is_paused,
                is_user_input_required: kickReward.is_user_input_required,
                should_redemptions_skip_request_queue: kickReward.should_redemptions_skip_request_queue,
                last_synced_at: new Date(),
                ...(updateData.puntos_a_otorgar !== undefined && { puntos_a_otorgar: updateData.puntos_a_otorgar }),
                ...(updateData.auto_accept !== undefined && { auto_accept: updateData.auto_accept })
            });
        }

        return {
            success: true,
            reward: localReward
        };
    } catch (error) {
        logger.error('🎁 [Kick Rewards] ❌ Error actualizando recompensa:', error.message);
        if (error.response) {
            logger.error('🎁 [Kick Rewards] Status:', error.response.status);
            logger.error('🎁 [Kick Rewards] Response:', error.response.data);
        }
        throw error;
    }
}

/**
 * Eliminar recompensa en Kick
 * @param {string} kickRewardId - ID de la recompensa en Kick
 * @returns {Promise<Object>}
 */
async function deleteRewardInKick(kickRewardId) {
    try {
        const token = await getAppAccessToken();
        if (!token) {
            throw new Error('No se pudo obtener token de acceso');
        }

        logger.info('🎁 [Kick Rewards] Eliminando recompensa en Kick:', kickRewardId);

        await axios.delete(
            `${config.kick.apiBaseUrl}/public/v1/channels/rewards/${kickRewardId}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                },
                timeout: 10000
            }
        );

        logger.info(`🎁 [Kick Rewards] ✅ Recompensa eliminada en Kick: ${kickRewardId}`);

        // Eliminar de nuestra BD
        const localReward = await KickReward.findOne({ where: { kick_reward_id: kickRewardId } });
        if (localReward) {
            await localReward.destroy();
            logger.info(`🎁 [Kick Rewards] ✅ Recompensa eliminada de BD local`);
        }

        return {
            success: true,
            message: 'Recompensa eliminada exitosamente'
        };
    } catch (error) {
        logger.error('🎁 [Kick Rewards] ❌ Error eliminando recompensa:', error.message);
        if (error.response) {
            logger.error('🎁 [Kick Rewards] Status:', error.response.status);
            logger.error('🎁 [Kick Rewards] Response:', error.response.data);
        }
        throw error;
    }
}

/**
 * Actualizar estado de redención (aceptar/rechazar)
 * Nota: Este endpoint aún no está documentado en la API de Kick,
 * pero basándonos en el webhook que incluye status (pending/accepted/rejected),
 * es probable que exista un endpoint PATCH para actualizar el estado
 * @param {string} redemptionId - ID de la redención
 * @param {string} status - 'accepted' o 'rejected'
 * @returns {Promise<Object>}
 */
async function updateRedemptionStatus(redemptionId, status) {
    try {
        const token = await getAppAccessToken();
        if (!token) {
            throw new Error('No se pudo obtener token de acceso');
        }

        logger.info(`🎁 [Kick Rewards] Actualizando estado de redención ${redemptionId} a ${status}`);

        // Nota: Este endpoint es hipotético basado en el patrón de la API
        // Puede que necesite ajustes cuando Kick lo documente oficialmente
        const response = await axios.patch(
            `${config.kick.apiBaseUrl}/public/v1/channels/rewards/redemptions/${redemptionId}`,
            { status },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 10000
            }
        );

        logger.info(`🎁 [Kick Rewards] ✅ Estado de redención actualizado`);

        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        logger.error('🎁 [Kick Rewards] ❌ Error actualizando estado de redención:', error.message);
        if (error.response) {
            logger.error('🎁 [Kick Rewards] Status:', error.response.status);
            logger.error('🎁 [Kick Rewards] Response:', error.response.data);
        }
        // No lanzar error para no bloquear el flujo principal
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    fetchRewardsFromKick,
    syncRewardsFromKick,
    createRewardInKick,
    updateRewardInKick,
    deleteRewardInKick,
    updateRedemptionStatus
};
