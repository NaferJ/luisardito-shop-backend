const { Usuario, Canje, HistorialPunto, BotrixMigrationConfig } = require('../models');
const { sequelize } = require('../models/database');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class VipService {
    /**
     * Otorgar VIP a un usuario basado en un canje
     * @param {number} canjeId - ID del canje
     * @param {number} usuarioId - ID del usuario
     * @param {Object} vipConfig - Configuración del VIP (duración, etc.)
     */
    static async grantVipFromCanje(canjeId, usuarioId, vipConfig = {}) {
        const transaction = await sequelize.transaction();

        try {
            const usuario = await Usuario.findByPk(usuarioId);
            if (!usuario) {
                throw new Error('Usuario no encontrado');
            }

            const canje = await Canje.findByPk(canjeId);
            if (!canje) {
                throw new Error('Canje no encontrado');
            }

            // Calcular fecha de expiración
            let vipExpiresAt = null;
            if (vipConfig.duration_days && vipConfig.duration_days > 0) {
                vipExpiresAt = new Date();
                vipExpiresAt.setDate(vipExpiresAt.getDate() + vipConfig.duration_days);
            }
            // Si no se especifica duración, es permanente (null)

            // Actualizar usuario como VIP
            await usuario.update({
                is_vip: true,
                vip_granted_at: new Date(),
                vip_expires_at: vipExpiresAt,
                vip_granted_by_canje_id: canjeId
            }, { transaction });

            // Crear entrada en historial
            await HistorialPunto.create({
                usuario_id: usuarioId,
                puntos: 0, // No se otorgan puntos, solo se registra el evento
                tipo: 'ajuste', // Usar 'ajuste' que es válido en el ENUM
                concepto: 'VIP otorgado',
                motivo: `VIP otorgado por canje #${canjeId}${vipExpiresAt ? ` (expira: ${vipExpiresAt.toLocaleDateString()})` : ' (permanente)'}`,
                kick_event_data: {
                    event_type: 'vip_granted',
                    canje_id: canjeId,
                    expires_at: vipExpiresAt,
                    granted_at: new Date().toISOString()
                }
            }, { transaction });

            await transaction.commit();

            logger.info(`✅ [VIP] VIP otorgado a ${usuario.nickname} por canje #${canjeId}`);
            return {
                usuario_id: usuarioId,
                nickname: usuario.nickname,
                canje_id: canjeId,
                vip_granted_at: new Date(),
                vip_expires_at: vipExpiresAt,
                is_permanent: !vipExpiresAt
            };

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Remover VIP de un usuario
     * @param {number} usuarioId - ID del usuario
     * @param {string} reason - Razón para remover el VIP
     */
    static async removeVip(usuarioId, reason = 'Manual') {
        const transaction = await sequelize.transaction();

        try {
            const usuario = await Usuario.findByPk(usuarioId);
            if (!usuario) {
                throw new Error('Usuario no encontrado');
            }

            if (!usuario.is_vip) {
                throw new Error('El usuario no es VIP');
            }

            // Remover VIP
            await usuario.update({
                is_vip: false,
                vip_granted_at: null,
                vip_expires_at: null,
                vip_granted_by_canje_id: null
            }, { transaction });

            // Crear entrada en historial
            await HistorialPunto.create({
                usuario_id: usuarioId,
                puntos: 0,
                tipo: 'ajuste', // Usar 'ajuste' que es válido en el ENUM
                concepto: 'VIP removido',
                motivo: `VIP removido: ${reason}`,
                kick_event_data: {
                    event_type: 'vip_removed',
                    reason: reason,
                    removed_at: new Date().toISOString()
                }
            }, { transaction });

            await transaction.commit();

            logger.info(`🔴 [VIP] VIP removido de ${usuario.nickname} - Razón: ${reason}`);
            return {
                usuario_id: usuarioId,
                nickname: usuario.nickname,
                reason: reason,
                removed_at: new Date()
            };

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Verificar y limpiar VIPs expirados
     */
    static async cleanupExpiredVips() {
        const expiredVips = await Usuario.findAll({
            where: {
                is_vip: true,
                vip_expires_at: {
                    [Op.lt]: new Date()
                }
            }
        });

        let cleanedCount = 0;
        for (const user of expiredVips) {
            try {
                await this.removeVip(user.id, 'Expiración automática');
                cleanedCount++;
            } catch (error) {
                logger.error(`❌ [VIP CLEANUP] Error removing expired VIP for user ${user.id}:`, error);
            }
        }

        logger.info(`🧹 [VIP CLEANUP] ${cleanedCount} VIPs expirados removidos`);
        return { cleaned_count: cleanedCount, total_expired: expiredVips.length };
    }

    /**
     * Obtener configuración de puntos VIP
     */
    static async getVipPointsConfig() {
        const config = await BotrixMigrationConfig.getConfig();
        return {
            vip_points_enabled: config.vip_points_enabled,
            vip_chat_points: config.vip_chat_points,
            vip_follow_points: config.vip_follow_points,
            vip_sub_points: config.vip_sub_points
        };
    }

    /**
     * Actualizar configuración de puntos VIP
     */
    static async updateVipPointsConfig(newConfig) {
        const config = await BotrixMigrationConfig.getConfig();
        const updateData = {};

        if (typeof newConfig.vip_points_enabled === 'boolean') {
            updateData.vip_points_enabled = newConfig.vip_points_enabled;
        }
        if (typeof newConfig.vip_chat_points === 'number') {
            updateData.vip_chat_points = newConfig.vip_chat_points;
        }
        if (typeof newConfig.vip_follow_points === 'number') {
            updateData.vip_follow_points = newConfig.vip_follow_points;
        }
        if (typeof newConfig.vip_sub_points === 'number') {
            updateData.vip_sub_points = newConfig.vip_sub_points;
        }

        await config.update(updateData);
        return config;
    }

    /**
     * Calcular puntos según tipo de usuario
     * @param {Object} usuario - Usuario
     * @param {string} eventType - Tipo de evento ('chat', 'follow', 'sub')
     * @param {number} defaultPoints - Puntos por defecto
     */
    static async calculatePointsForUser(usuario, eventType, defaultPoints) {
        const config = await this.getVipPointsConfig();

        if (!config.vip_points_enabled || !usuario.isVipActive()) {
            return defaultPoints;
        }

        switch (eventType) {
            case 'chat':
                return config.vip_chat_points;
            case 'follow':
                return config.vip_follow_points;
            case 'sub':
                return config.vip_sub_points;
            default:
                return defaultPoints;
        }
    }

    /**
     * Obtener estadísticas de VIPs
     */
    static async getVipStats() {
        const totalVips = await Usuario.count({ where: { is_vip: true } });
        const permanentVips = await Usuario.count({
            where: {
                is_vip: true,
                vip_expires_at: null
            }
        });
        const temporaryVips = totalVips - permanentVips;

        const expiredVips = await Usuario.count({
            where: {
                is_vip: true,
                vip_expires_at: {
                    [Op.lt]: new Date()
                }
            }
        });

        return {
            total_vips: totalVips,
            permanent_vips: permanentVips,
            temporary_vips: temporaryVips,
            expired_vips: expiredVips,
            active_vips: totalVips - expiredVips
        };
    }
}

module.exports = VipService;
