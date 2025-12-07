const { KickReward } = require('../models');
const KickRewardService = require('../services/kickReward.service');
const logger = require('../utils/logger');

/**
 * 📋 Obtener todas las recompensas
 * GET /api/admin/kick-rewards
 */
exports.getAllRewards = async (req, res) => {
    try {
        const rewards = await KickReward.findAll({
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            total: rewards.length,
            rewards
        });
    } catch (error) {
        logger.error('❌ [Kick Rewards Admin] Error obteniendo recompensas:', error.message);
        res.status(500).json({
            success: false,
            error: 'Error obteniendo recompensas'
        });
    }
};

/**
 * 🔍 Obtener una recompensa por ID
 * GET /api/admin/kick-rewards/:id
 */
exports.getRewardById = async (req, res) => {
    try {
        const { id } = req.params;

        const reward = await KickReward.findByPk(id);

        if (!reward) {
            return res.status(404).json({
                success: false,
                error: 'Recompensa no encontrada'
            });
        }

        res.json({
            success: true,
            reward
        });
    } catch (error) {
        logger.error('❌ [Kick Rewards Admin] Error obteniendo recompensa:', error.message);
        res.status(500).json({
            success: false,
            error: 'Error obteniendo recompensa'
        });
    }
};

/**
 * 🔄 Sincronizar recompensas desde Kick
 * POST /api/admin/kick-rewards/sync
 */
exports.syncRewards = async (req, res) => {
    try {
        logger.info('🔄 [Kick Rewards Admin] Iniciando sincronización...');

        const result = await KickRewardService.syncRewardsFromKick();

        res.json({
            success: true,
            message: 'Recompensas sincronizadas exitosamente',
            ...result
        });
    } catch (error) {
        logger.error('❌ [Kick Rewards Admin] Error sincronizando:', error.message);
        res.status(500).json({
            success: false,
            error: 'Error sincronizando recompensas',
            details: error.message
        });
    }
};

/**
 * ✨ Crear nueva recompensa en Kick
 * POST /api/admin/kick-rewards
 */
exports.createReward = async (req, res) => {
    try {
        const {
            title,
            description,
            cost,
            background_color,
            puntos_a_otorgar,
            is_enabled,
            is_user_input_required,
            should_redemptions_skip_request_queue,
            auto_accept
        } = req.body;

        // Validaciones
        if (!title || !cost || puntos_a_otorgar === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Faltan campos requeridos: title, cost, puntos_a_otorgar'
            });
        }

        if (cost < 1) {
            return res.status(400).json({
                success: false,
                error: 'El costo debe ser mínimo 1'
            });
        }

        if (title.length > 50) {
            return res.status(400).json({
                success: false,
                error: 'El título no puede exceder 50 caracteres'
            });
        }

        if (description && description.length > 200) {
            return res.status(400).json({
                success: false,
                error: 'La descripción no puede exceder 200 caracteres'
            });
        }

        logger.info('✨ [Kick Rewards Admin] Creando recompensa:', title);

        const result = await KickRewardService.createRewardInKick({
            title,
            description,
            cost,
            background_color,
            puntos_a_otorgar,
            is_enabled,
            is_user_input_required,
            should_redemptions_skip_request_queue,
            auto_accept
        });

        res.status(201).json({
            success: true,
            message: 'Recompensa creada exitosamente en Kick',
            reward: result.reward
        });
    } catch (error) {
        logger.error('❌ [Kick Rewards Admin] Error creando recompensa:', error.message);
        res.status(500).json({
            success: false,
            error: 'Error creando recompensa',
            details: error.message
        });
    }
};

/**
 * ✏️ Actualizar recompensa
 * PATCH /api/admin/kick-rewards/:id
 */
exports.updateReward = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Buscar recompensa local
        const reward = await KickReward.findByPk(id);

        if (!reward) {
            return res.status(404).json({
                success: false,
                error: 'Recompensa no encontrada'
            });
        }

        // Validaciones
        if (updateData.title && updateData.title.length > 50) {
            return res.status(400).json({
                success: false,
                error: 'El título no puede exceder 50 caracteres'
            });
        }

        if (updateData.description && updateData.description.length > 200) {
            return res.status(400).json({
                success: false,
                error: 'La descripción no puede exceder 200 caracteres'
            });
        }

        if (updateData.cost !== undefined && updateData.cost < 1) {
            return res.status(400).json({
                success: false,
                error: 'El costo debe ser mínimo 1'
            });
        }

        logger.info('✏️ [Kick Rewards Admin] Actualizando recompensa:', reward.title);

        // Actualizar en Kick
        const result = await KickRewardService.updateRewardInKick(
            reward.kick_reward_id,
            updateData
        );

        res.json({
            success: true,
            message: 'Recompensa actualizada exitosamente',
            reward: result.reward
        });
    } catch (error) {
        logger.error('❌ [Kick Rewards Admin] Error actualizando recompensa:', error.message);
        res.status(500).json({
            success: false,
            error: 'Error actualizando recompensa',
            details: error.message
        });
    }
};

/**
 * 🗑️ Eliminar recompensa
 * DELETE /api/admin/kick-rewards/:id
 */
exports.deleteReward = async (req, res) => {
    try {
        const { id } = req.params;

        // Buscar recompensa local
        const reward = await KickReward.findByPk(id);

        if (!reward) {
            return res.status(404).json({
                success: false,
                error: 'Recompensa no encontrada'
            });
        }

        logger.info('🗑️ [Kick Rewards Admin] Eliminando recompensa:', reward.title);

        // Eliminar en Kick
        await KickRewardService.deleteRewardInKick(reward.kick_reward_id);

        res.json({
            success: true,
            message: 'Recompensa eliminada exitosamente'
        });
    } catch (error) {
        logger.error('❌ [Kick Rewards Admin] Error eliminando recompensa:', error.message);
        res.status(500).json({
            success: false,
            error: 'Error eliminando recompensa',
            details: error.message
        });
    }
};

/**
 * 📊 Obtener estadísticas de recompensas
 * GET /api/admin/kick-rewards/stats
 */
exports.getRewardsStats = async (req, res) => {
    try {
        const rewards = await KickReward.findAll();

        const stats = {
            total: rewards.length,
            enabled: rewards.filter(r => r.is_enabled).length,
            disabled: rewards.filter(r => !r.is_enabled).length,
            paused: rewards.filter(r => r.is_paused).length,
            with_user_input: rewards.filter(r => r.is_user_input_required).length,
            total_redemptions: rewards.reduce((sum, r) => sum + r.total_redemptions, 0),
            total_points_configured: rewards.reduce((sum, r) => sum + r.puntos_a_otorgar, 0),
            most_redeemed: rewards.sort((a, b) => b.total_redemptions - a.total_redemptions).slice(0, 5).map(r => ({
                title: r.title,
                total_redemptions: r.total_redemptions,
                puntos_a_otorgar: r.puntos_a_otorgar
            }))
        };

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        logger.error('❌ [Kick Rewards Admin] Error obteniendo estadísticas:', error.message);
        res.status(500).json({
            success: false,
            error: 'Error obteniendo estadísticas'
        });
    }
};

/**
 * 🔄 Actualizar solo puntos a otorgar (local)
 * PATCH /api/admin/kick-rewards/:id/points
 */
exports.updateRewardPoints = async (req, res) => {
    try {
        const { id } = req.params;
        const { puntos_a_otorgar, auto_accept } = req.body;

        if (puntos_a_otorgar === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Falta el campo puntos_a_otorgar'
            });
        }

        const reward = await KickReward.findByPk(id);

        if (!reward) {
            return res.status(404).json({
                success: false,
                error: 'Recompensa no encontrada'
            });
        }

        const updateData = { puntos_a_otorgar };
        if (auto_accept !== undefined) {
            updateData.auto_accept = auto_accept;
        }

        await reward.update(updateData);

        logger.info(
            `✏️ [Kick Rewards Admin] Puntos actualizados para "${reward.title}": ${puntos_a_otorgar}`
        );

        res.json({
            success: true,
            message: 'Puntos actualizados exitosamente',
            reward
        });
    } catch (error) {
        logger.error('❌ [Kick Rewards Admin] Error actualizando puntos:', error.message);
        res.status(500).json({
            success: false,
            error: 'Error actualizando puntos'
        });
    }
};
