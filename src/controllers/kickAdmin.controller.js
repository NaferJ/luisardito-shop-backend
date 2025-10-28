const { Usuario, Canje, Producto, BotrixMigrationConfig } = require('../models');
const BotrixMigrationService = require('../services/botrixMigration.service');
const VipService = require('../services/vip.service');
const { Op } = require('sequelize');

/**
 * Obtener configuración de migración y VIP
 */
exports.getConfig = async (req, res) => {
    try {
        const config = await BotrixMigrationConfig.getConfig();
        const migrationStats = await BotrixMigrationService.getMigrationStats();
        const vipStats = await VipService.getVipStats();

        res.json({
            success: true,
            migration: {
                enabled: config.migration_enabled,
                stats: migrationStats
            },
            vip: {
                points_enabled: config.vip_points_enabled,
                chat_points: config.vip_chat_points,
                follow_points: config.vip_follow_points,
                sub_points: config.vip_sub_points,
                stats: vipStats
            }
        });
    } catch (error) {
        console.error('Error obteniendo configuración:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Actualizar configuración de migración
 */
exports.updateMigrationConfig = async (req, res) => {
    try {
        const { migration_enabled } = req.body;

        if (typeof migration_enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'migration_enabled debe ser un booleano'
            });
        }

        const config = await BotrixMigrationService.toggleMigration(migration_enabled);

        res.json({
            success: true,
            message: `Migración de Botrix ${migration_enabled ? 'activada' : 'desactivada'}`,
            config: {
                migration_enabled: config.migration_enabled
            }
        });
    } catch (error) {
        console.error('Error actualizando configuración de migración:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Actualizar configuración de puntos VIP
 */
exports.updateVipConfig = async (req, res) => {
    try {
        const { vip_points_enabled, vip_chat_points, vip_follow_points, vip_sub_points } = req.body;

        const updateData = {};
        if (typeof vip_points_enabled === 'boolean') updateData.vip_points_enabled = vip_points_enabled;
        if (typeof vip_chat_points === 'number') updateData.vip_chat_points = vip_chat_points;
        if (typeof vip_follow_points === 'number') updateData.vip_follow_points = vip_follow_points;
        if (typeof vip_sub_points === 'number') updateData.vip_sub_points = vip_sub_points;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionaron datos válidos para actualizar'
            });
        }

        const config = await VipService.updateVipPointsConfig(updateData);

        res.json({
            success: true,
            message: 'Configuración VIP actualizada',
            config: {
                vip_points_enabled: config.vip_points_enabled,
                vip_chat_points: config.vip_chat_points,
                vip_follow_points: config.vip_follow_points,
                vip_sub_points: config.vip_sub_points
            }
        });
    } catch (error) {
        console.error('Error actualizando configuración VIP:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Otorgar VIP manualmente desde un canje
 */
exports.grantVipFromCanje = async (req, res) => {
    try {
        const { canjeId } = req.params;
        const { duration_days } = req.body;

        const canje = await Canje.findByPk(canjeId, {
            include: [
                { model: Usuario, attributes: ['id', 'nickname', 'is_vip'] },
                { model: Producto, attributes: ['id', 'nombre'] }
            ]
        });

        if (!canje) {
            return res.status(404).json({
                success: false,
                error: 'Canje no encontrado'
            });
        }

        if (canje.estado !== 'entregado') {
            return res.status(400).json({
                success: false,
                error: 'El canje debe estar marcado como entregado'
            });
        }

        const vipConfig = {};
        if (duration_days && duration_days > 0) {
            vipConfig.duration_days = parseInt(duration_days);
        }

        const result = await VipService.grantVipFromCanje(
            parseInt(canjeId),
            canje.usuario_id,
            vipConfig
        );

        res.json({
            success: true,
            message: `VIP otorgado a ${result.nickname}`,
            vip_info: result
        });

    } catch (error) {
        console.error('Error otorgando VIP:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Remover VIP de un usuario
 */
exports.removeVip = async (req, res) => {
    try {
        const { usuarioId } = req.params;
        const { reason = 'Remoción manual' } = req.body;

        const result = await VipService.removeVip(parseInt(usuarioId), reason);

        res.json({
            success: true,
            message: `VIP removido de ${result.nickname}`,
            removal_info: result
        });

    } catch (error) {
        console.error('Error removiendo VIP:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Limpiar VIPs expirados
 */
exports.cleanupExpiredVips = async (req, res) => {
    try {
        const result = await VipService.cleanupExpiredVips();

        res.json({
            success: true,
            message: `${result.cleaned_count} VIPs expirados limpiados`,
            cleanup_info: result
        });

    } catch (error) {
        console.error('Error limpiando VIPs expirados:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Obtener lista de usuarios con información VIP y migración
 */
exports.getUsersWithDetails = async (req, res) => {
    try {
        const { page = 1, limit = 20, filter = 'all' } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = {};
        switch (filter) {
            case 'vip':
                whereClause.is_vip = true;
                break;
            case 'migrated':
                whereClause.botrix_migrated = true;
                break;
            case 'pending_migration':
                whereClause.botrix_migrated = false;
                break;
        }

        const { count, rows: usuarios } = await Usuario.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['actualizado', 'DESC']],
            attributes: [
                'id', 'nickname', 'email', 'puntos', 'user_id_ext', 'discord_username',
                'is_vip', 'vip_granted_at', 'vip_expires_at', 'vip_granted_by_canje_id',
                'botrix_migrated', 'botrix_migrated_at', 'botrix_points_migrated',
                'creado', 'actualizado'
            ]
        });

        // Enriquecer datos con información adicional
        const enrichedUsers = usuarios.map(user => {
            const userData = user.toJSON();
            return {
                ...userData,
                vip_status: {
                    is_active: user.isVipActive(),
                    is_permanent: user.is_vip && !user.vip_expires_at,
                    expires_soon: user.vip_expires_at &&
                        new Date(user.vip_expires_at) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
                },
                migration_status: {
                    can_migrate: user.canMigrateBotrix(),
                    points_migrated: user.botrix_points_migrated || 0
                },
                user_type: user.getUserType()
            };
        });

        res.json({
            success: true,
            users: enrichedUsers,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('Error obteniendo usuarios:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Migración manual de puntos (para testing)
 */
exports.manualBotrixMigration = async (req, res) => {
    try {
        const { usuario_id, points_amount, kick_username } = req.body;

        if (!usuario_id || !points_amount || !kick_username) {
            return res.status(400).json({
                success: false,
                error: 'Faltan parámetros: usuario_id, points_amount, kick_username'
            });
        }

        const usuario = await Usuario.findByPk(usuario_id);
        if (!usuario) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }

        if (usuario.botrix_migrated) {
            return res.status(400).json({
                success: false,
                error: 'Usuario ya migró puntos anteriormente'
            });
        }

        const result = await BotrixMigrationService.migrateBotrixPoints(
            usuario,
            parseInt(points_amount),
            kick_username
        );

        res.json({
            success: true,
            message: 'Migración manual completada',
            migration_info: result
        });

    } catch (error) {
        console.error('Error en migración manual:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
