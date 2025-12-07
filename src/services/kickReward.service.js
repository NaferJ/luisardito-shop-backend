const { KickReward } = require('../models');
const logger = require('../utils/logger');

/**
 * 🎁 Servicio simplificado para Kick Rewards
 * Solo maneja datos locales para el webhook
 * Las recompensas se crean manualmente en Kick.com
 */

/**
 * 🔍 Obtiene una recompensa por su kick_reward_id
 * Usado por el webhook para procesar canjeos
 * @param {string} kickRewardId - ID de la recompensa en Kick
 * @returns {Promise<Object|null>}
 */
async function getRewardByKickId(kickRewardId) {
    try {
        const reward = await KickReward.findOne({
            where: { kick_reward_id: kickRewardId }
        });
        return reward;
    } catch (error) {
        logger.error('🎁 [Kick Rewards] ❌ Error obteniendo recompensa por kick_id:', error.message);
        throw error;
    }
}

/**
 * 📊 Obtiene estadísticas de recompensas
 * @returns {Promise<Object>}
 */
async function getRewardStats() {
    try {
        const { Op } = require('sequelize');
        
        const [totalRewards, enabledRewards, totalRedemptions] = await Promise.all([
            KickReward.count(),
            KickReward.count({ where: { is_enabled: true } }),
            KickReward.sum('total_redemptions') || 0
        ]);

        return {
            total_rewards: totalRewards,
            enabled_rewards: enabledRewards,
            disabled_rewards: totalRewards - enabledRewards,
            total_redemptions: totalRedemptions
        };
    } catch (error) {
        logger.error('🎁 [Kick Rewards] ❌ Error obteniendo estadísticas:', error.message);
        throw error;
    }
}

module.exports = {
    getRewardByKickId,
    getRewardStats
};
