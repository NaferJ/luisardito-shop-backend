const { Usuario, Canje, Producto, BotrixMigrationConfig } = require('../models');
// const BotrixMigrationService = require('../services/botrixMigration.service');
// const VipService = require('../services/vip.service');
const { Op } = require('sequelize');

/**
 * Obtener configuración de migración y VIP
 */
exports.getConfig = async (req, res) => {
    try {
        const config = await BotrixMigrationConfig.getConfig();
        // const migrationStats = await BotrixMigrationService.getMigrationStats();
        // const vipStats = await VipService.getVipStats();

        res.json({
            success: true,
            migration: {
                enabled: config.migration_enabled,
                stats: { migrated_users: 0, total_points_migrated: 0 } // migrationStats
            },
            vip: {
                points_enabled: config.vip_points_enabled,
                chat_points: config.vip_chat_points,
                follow_points: config.vip_follow_points,
                sub_points: config.vip_sub_points,
                stats: { active_vips: 0, expired_vips: 0 } // vipStats
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

        await BotrixMigrationConfig.setConfig('migration_enabled', migration_enabled);

        res.json({
            success: true,
            message: `Migración de Botrix ${migration_enabled ? 'activada' : 'desactivada'}`,
            config: {
                migration_enabled: migration_enabled
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

        // Actualizar cada configuración
        for (const [key, value] of Object.entries(updateData)) {
            await BotrixMigrationConfig.setConfig(key, value);
        }

        res.json({
            success: true,
            message: 'Configuración VIP actualizada',
            config: updateData
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
 * Otorgar VIP desde canje entregado
 */
exports.grantVipFromCanje = async (req, res) => {
    try {
        const { canjeId } = req.params;
        const { duration_days } = req.body;

        // Buscar el canje
        const canje = await Canje.findByPk(canjeId, {
            include: [{ model: Usuario }, { model: Producto }]
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
                error: 'El canje debe estar en estado "entregado" para otorgar VIP'
            });
        }

        // Verificar si el producto otorga VIP
        if (!canje.Producto.nombre.toLowerCase().includes('vip')) {
            return res.status(400).json({
                success: false,
                error: 'Este producto no otorga VIP'
            });
        }

        // Calcular fecha de expiración
        let vip_expires_at = null;
        if (duration_days && duration_days > 0) {
            vip_expires_at = new Date(Date.now() + duration_days * 24 * 60 * 60 * 1000);
        }

        // Otorgar VIP al usuario
        await canje.Usuario.update({
            is_vip: true,
            vip_granted_at: new Date(),
            vip_expires_at,
            vip_granted_by_canje_id: canjeId
        });

        res.json({
            success: true,
            message: 'VIP otorgado exitosamente',
            user_id: canje.Usuario.id,
            duration: duration_days ? `${duration_days} días` : 'Permanente'
        });

    } catch (error) {
        console.error('Error otorgando VIP desde canje:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Otorgar VIP manualmente a un usuario
 */
exports.grantVipManually = async (req, res) => {
    try {
        const { usuarioId } = req.params;
        const { duration_days, reason } = req.body;

        // Buscar el usuario
        const usuario = await Usuario.findByPk(usuarioId);

        if (!usuario) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }

        // Verificar si ya es VIP activo
        if (usuario.is_vip && (!usuario.vip_expires_at || new Date(usuario.vip_expires_at) > new Date())) {
            return res.status(400).json({
                success: false,
                error: 'El usuario ya tiene VIP activo'
            });
        }

        // Calcular fecha de expiración
        let vip_expires_at = null;
        if (duration_days && duration_days > 0) {
            vip_expires_at = new Date(Date.now() + duration_days * 24 * 60 * 60 * 1000);
        }

        // Otorgar VIP al usuario
        await usuario.update({
            is_vip: true,
            vip_granted_at: new Date(),
            vip_expires_at,
            vip_granted_by_canje_id: null // Es manual
        });

        res.json({
            success: true,
            message: 'VIP otorgado exitosamente',
            user: {
                id: usuario.id,
                nickname: usuario.nickname,
                vip_granted_at: new Date(),
                vip_expires_at,
                duration: duration_days ? `${duration_days} días` : 'Permanente'
            }
        });

    } catch (error) {
        console.error('Error otorgando VIP manualmente:', error);
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
        const { reason } = req.body;

        // Buscar el usuario
        const usuario = await Usuario.findByPk(usuarioId);

        if (!usuario) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }

        if (!usuario.is_vip) {
            return res.status(400).json({
                success: false,
                error: 'El usuario no tiene VIP'
            });
        }

        // Remover VIP
        await usuario.update({
            is_vip: false,
            vip_granted_at: null,
            vip_expires_at: null,
            vip_granted_by_canje_id: null
        });

        res.json({
            success: true,
            message: 'VIP removido exitosamente',
            user: {
                id: usuario.id,
                nickname: usuario.nickname,
                vip_removed_at: new Date(),
                reason: reason || 'Removido manualmente'
            }
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
        const now = new Date();

        // Buscar usuarios con VIP expirado
        const expiredVips = await Usuario.findAll({
            where: {
                is_vip: true,
                vip_expires_at: {
                    [Op.lt]: now
                }
            }
        });

        if (expiredVips.length === 0) {
            return res.json({
                success: true,
                message: 'No hay VIPs expirados para limpiar',
                cleaned: 0
            });
        }

        // Actualizar usuarios expirados
        await Usuario.update(
            {
                is_vip: false,
                vip_granted_at: null,
                vip_expires_at: null,
                vip_granted_by_canje_id: null
            },
            {
                where: {
                    is_vip: true,
                    vip_expires_at: {
                        [Op.lt]: now
                    }
                }
            }
        );

        res.json({
            success: true,
            message: `${expiredVips.length} VIPs expirados limpiados exitosamente`,
            cleaned: expiredVips.length,
            users: expiredVips.map(u => ({
                id: u.id,
                nickname: u.nickname,
                expired_at: u.vip_expires_at
            }))
        });

    } catch (error) {
        console.error('Error limpiando VIPs expirados:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

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

        const enrichedUsers = usuarios.map(user => ({
            ...user.toJSON(),
            vip_status: {
                is_active: user.is_vip && (!user.vip_expires_at || new Date(user.vip_expires_at) > new Date()),
                is_permanent: user.is_vip && !user.vip_expires_at,
                expires_soon: user.vip_expires_at &&
                    new Date(user.vip_expires_at) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            },
            migration_status: {
                can_migrate: !user.botrix_migrated,
                points_migrated: user.botrix_points_migrated || 0
            }
        }));

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

exports.manualBotrixMigration = async (req, res) => {
    res.json({ success: false, error: 'Función en desarrollo - Botrix service no implementado aún' });
};
