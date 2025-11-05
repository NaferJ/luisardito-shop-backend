const { Usuario, Canje, Producto, BotrixMigrationConfig, KickBotToken, sequelize, KickUserTracking } = require('../models');
const BotrixMigrationService = require('../services/botrixMigration.service');
const VipService = require('../services/vip.service');
const KickBotService = require('../services/kickBot.service');
const { Op } = require('sequelize');

/**
 * Obtener configuración de migración y VIP
 */
exports.getConfig = async (req, res) => {
    try {
        const config = await BotrixMigrationConfig.getConfig();

        // Obtener estadísticas reales de migración
        const migrationStats = await Usuario.findAll({
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'migrated_users'],
                [sequelize.fn('SUM', sequelize.col('botrix_points_migrated')), 'total_points_migrated']
            ],
            where: {
                botrix_migrated: true,
                botrix_points_migrated: { [Op.gt]: 0 }
            },
            raw: true
        });

        // Obtener estadísticas reales de VIP
        const now = new Date();

        const activeVips = await Usuario.count({
            where: {
                is_vip: true,
                [Op.or]: [
                    { vip_expires_at: null }, // VIP permanente
                    { vip_expires_at: { [Op.gt]: now } } // VIP no expirado
                ]
            }
        });

        const expiredVips = await Usuario.count({
            where: {
                is_vip: true,
                vip_expires_at: { [Op.lt]: now } // VIP expirado
            }
        });

        console.log('📊 [KICK ADMIN DEBUG] Estadísticas calculadas:', {
            migration: migrationStats[0],
            vip: { activeVips, expiredVips }
        });

        res.json({
            success: true,
            migration: {
                enabled: config.migration_enabled,
                stats: {
                    migrated_users: parseInt(migrationStats[0]?.migrated_users || 0),
                    total_points_migrated: parseInt(migrationStats[0]?.total_points_migrated || 0)
                }
            },
            vip: {
                points_enabled: config.vip_points_enabled,
                chat_points: config.vip_chat_points,
                follow_points: config.vip_follow_points,
                sub_points: config.vip_sub_points,
                stats: {
                    active_vips: activeVips,
                    expired_vips: expiredVips
                }
            }
        });
    } catch (error) {
        console.error('❌ [KICK ADMIN DEBUG] Error obteniendo configuración:', error);
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
        console.log('🔍 [KICK ADMIN DEBUG] Datos recibidos en migration config:', {
            body: req.body,
            bodyKeys: Object.keys(req.body),
            migration_enabled_value: req.body.migration_enabled,
            migration_enabled_type: typeof req.body.migration_enabled,
            headers: {
                'content-type': req.headers['content-type'],
                'user-agent': req.headers['user-agent']
            }
        });

        const { migration_enabled } = req.body;

        // Validación más flexible para manejar strings "true"/"false"
        let booleanValue;

        if (typeof migration_enabled === 'boolean') {
            booleanValue = migration_enabled;
        } else if (typeof migration_enabled === 'string') {
            if (migration_enabled.toLowerCase() === 'true') {
                booleanValue = true;
            } else if (migration_enabled.toLowerCase() === 'false') {
                booleanValue = false;
            } else {
                console.log('❌ [KICK ADMIN DEBUG] Valor string inválido:', migration_enabled);
                return res.status(400).json({
                    success: false,
                    error: 'migration_enabled debe ser un booleano o "true"/"false"'
                });
            }
        } else {
            console.log('❌ [KICK ADMIN DEBUG] Tipo inválido:', typeof migration_enabled, 'valor:', migration_enabled);
            return res.status(400).json({
                success: false,
                error: 'migration_enabled debe ser un booleano'
            });
        }

        console.log('✅ [KICK ADMIN DEBUG] Valor procesado:', booleanValue);

        await BotrixMigrationConfig.setConfig('migration_enabled', booleanValue);

        res.json({
            success: true,
            message: `Migración de Botrix ${booleanValue ? 'activada' : 'desactivada'}`,
            config: {
                migration_enabled: booleanValue
            }
        });
    } catch (error) {
        console.error('❌ [KICK ADMIN DEBUG] Error actualizando configuración de migración:', error);
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
        console.log('🔍 [KICK ADMIN DEBUG] Datos recibidos en VIP config:', {
            body: req.body,
            bodyKeys: Object.keys(req.body),
            types: {
                vip_points_enabled: typeof req.body.vip_points_enabled,
                vip_chat_points: typeof req.body.vip_chat_points,
                vip_follow_points: typeof req.body.vip_follow_points,
                vip_sub_points: typeof req.body.vip_sub_points
            }
        });

        const { vip_points_enabled, vip_chat_points, vip_follow_points, vip_sub_points } = req.body;

        const updateData = {};

        // Validar y convertir vip_points_enabled
        if (vip_points_enabled !== undefined) {
            if (typeof vip_points_enabled === 'boolean') {
                updateData.vip_points_enabled = vip_points_enabled;
            } else if (typeof vip_points_enabled === 'string') {
                if (vip_points_enabled.toLowerCase() === 'true') {
                    updateData.vip_points_enabled = true;
                } else if (vip_points_enabled.toLowerCase() === 'false') {
                    updateData.vip_points_enabled = false;
                } else {
                    return res.status(400).json({
                        success: false,
                        error: 'vip_points_enabled debe ser un booleano'
                    });
                }
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'vip_points_enabled debe ser un booleano'
                });
            }
        }

        // Validar y convertir números
        if (vip_chat_points !== undefined) {
            const num = Number(vip_chat_points);
            if (isNaN(num) || num < 0) {
                return res.status(400).json({
                    success: false,
                    error: 'vip_chat_points debe ser un número positivo'
                });
            }
            updateData.vip_chat_points = num;
        }

        if (vip_follow_points !== undefined) {
            const num = Number(vip_follow_points);
            if (isNaN(num) || num < 0) {
                return res.status(400).json({
                    success: false,
                    error: 'vip_follow_points debe ser un número positivo'
                });
            }
            updateData.vip_follow_points = num;
        }

        if (vip_sub_points !== undefined) {
            const num = Number(vip_sub_points);
            if (isNaN(num) || num < 0) {
                return res.status(400).json({
                    success: false,
                    error: 'vip_sub_points debe ser un número positivo'
                });
            }
            updateData.vip_sub_points = num;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionaron datos válidos para actualizar'
            });
        }

        console.log('✅ [KICK ADMIN DEBUG] Datos a actualizar:', updateData);

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
        console.error('❌ [KICK ADMIN DEBUG] Error actualizando configuración VIP:', error);
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
        const { filter = 'all' } = req.query;

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
            order: [['actualizado', 'DESC']],
            attributes: [
                'id', 'nickname', 'email', 'puntos', 'user_id_ext', 'discord_username',
                'is_vip', 'vip_granted_at', 'vip_expires_at', 'vip_granted_by_canje_id',
                'botrix_migrated', 'botrix_migrated_at', 'botrix_points_migrated',
                'creado', 'actualizado'
            ]
        });

        const enrichedUsers = await Promise.all(usuarios.map(async user => {
            const userJson = user.toJSON();

            // Calcular información de suscriptor
            let subscriberStatus = {
                is_active: false,
                expires_soon: false
            };

            if (userJson.user_id_ext) {
                const userTracking = await KickUserTracking.findOne({
                    where: { kick_user_id: userJson.user_id_ext }
                });

                if (userTracking?.is_subscribed) {
                    const now = new Date();
                    const expiresAt = userTracking.subscription_expires_at ? new Date(userTracking.subscription_expires_at) : null;
                    subscriberStatus = {
                        is_active: !expiresAt || expiresAt > now,
                        expires_soon: expiresAt && expiresAt <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                    };
                }
            }

            return {
                ...userJson,
                vip_status: {
                    is_active: userJson.is_vip && (!userJson.vip_expires_at || new Date(userJson.vip_expires_at) > new Date()),
                    is_permanent: userJson.is_vip && !userJson.vip_expires_at,
                    expires_soon: userJson.vip_expires_at &&
                        new Date(userJson.vip_expires_at) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                },
                migration_status: {
                    can_migrate: !userJson.botrix_migrated,
                    points_migrated: userJson.botrix_points_migrated || 0
                },
                subscriber_status: subscriberStatus
            };
        }));

        res.json({
            success: true,
            users: enrichedUsers,
            total: count
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
    try {
        const rawUsuarioId = req.params?.usuarioId ?? req.body?.usuario_id ?? req.body?.usuarioId
        const rawPoints = req.body?.points ?? req.body?.points_amount ?? req.body?.pointsAmount

        if (!rawUsuarioId || !rawPoints) {
            return res.status(400).json({
                success: false,
                error: 'usuarioId y points son requeridos'
            })
        }

        const usuarioId = parseInt(rawUsuarioId, 10)
        const points = parseInt(rawPoints, 10)

        if (Number.isNaN(usuarioId) || Number.isNaN(points)) {
            return res.status(400).json({
                success: false,
                error: 'usuarioId y points deben ser números válidos'
            })
        }

        // Buscar el usuario
        const usuario = await Usuario.findByPk(usuarioId)

        if (!usuario) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            })
        }

        // Verificar si ya migró
        if (usuario.botrix_migrated) {
            return res.status(400).json({
                success: false,
                error: 'El usuario ya tiene puntos migrados de Botrix',
                details: {
                    migrated_at: usuario.botrix_migrated_at,
                    points_migrated: usuario.botrix_points_migrated
                }
            })
        }

        // Realizar migración manual usando el servicio
        const result = await BotrixMigrationService.migrateBotrixPoints(
            usuario,
            points,
            usuario.nickname || `Manual-${usuario.id}`
        )

        res.json({
            success: true,
            message: 'Migración manual completada exitosamente',
            migration: result
        })
    } catch (error) {
        console.error('❌ [KICK ADMIN DEBUG] Error en migración manual:', error)
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
}

/**
 * Obtener estado de tokens del bot de Kick
 */
exports.getBotTokensStatus = async (req, res) => {
    try {
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

        // Obtener todos los tokens
        const allTokens = await KickBotToken.findAll({
            order: [['updated_at', 'DESC']]
        });

        // Clasificar tokens
        const activeTokens = allTokens.filter(token =>
            token.is_active && new Date(token.token_expires_at) > now
        );

        const expiredTokens = allTokens.filter(token =>
            token.is_active && new Date(token.token_expires_at) <= now
        );

        const expiringSoon = allTokens.filter(token =>
            token.is_active &&
            new Date(token.token_expires_at) > now &&
            new Date(token.token_expires_at) <= fiveMinutesFromNow
        );

        const inactiveTokens = allTokens.filter(token => !token.is_active);

        const tokens = allTokens.map(token => ({
            id: token.id,
            kick_username: token.kick_username,
            kick_user_id: token.kick_user_id,
            is_active: token.is_active,
            token_expires_at: token.token_expires_at,
            has_refresh_token: !!token.refresh_token,
            status: token.is_active
                ? (new Date(token.token_expires_at) <= now
                    ? 'expired'
                    : (new Date(token.token_expires_at) <= fiveMinutesFromNow
                        ? 'expiring_soon'
                        : 'active'
                    )
                )
                : 'inactive',
            expires_in_minutes: Math.round((new Date(token.token_expires_at) - now) / 1000 / 60),
            created_at: token.created_at,
            updated_at: token.updated_at
        }));

        res.json({
            success: true,
            summary: {
                total: allTokens.length,
                active: activeTokens.length,
                expired: expiredTokens.length,
                expiring_soon: expiringSoon.length,
                inactive: inactiveTokens.length
            },
            tokens
        });

    } catch (error) {
        console.error('❌ [KICK ADMIN DEBUG] Error obteniendo estado de tokens:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Limpiar tokens expirados del bot
 */
exports.cleanupExpiredBotTokens = async (req, res) => {
    try {
        const now = new Date();

        // Buscar tokens expirados y activos
        const expiredTokens = await KickBotToken.findAll({
            where: {
                is_active: true,
                token_expires_at: {
                    [Op.lt]: now
                }
            }
        });

        if (expiredTokens.length === 0) {
            return res.json({
                success: true,
                message: 'No hay tokens expirados para limpiar',
                cleaned: 0
            });
        }

        // Marcar como inactivos
        await KickBotToken.update(
            { is_active: false },
            {
                where: {
                    is_active: true,
                    token_expires_at: {
                        [Op.lt]: now
                    }
                }
            }
        );

        res.json({
            success: true,
            message: `${expiredTokens.length} tokens expirados marcados como inactivos`,
            cleaned: expiredTokens.length,
            tokens: expiredTokens.map(token => ({
                id: token.id,
                kick_username: token.kick_username,
                expired_at: token.token_expires_at
            }))
        });

    } catch (error) {
        console.error('❌ [KICK ADMIN DEBUG] Error limpiando tokens expirados:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Renovar token del bot manualmente
 */
exports.refreshBotToken = async (req, res) => {
    try {
        const { tokenId } = req.params;

        const token = await KickBotToken.findByPk(tokenId);
        if (!token) {
            return res.status(404).json({
                success: false,
                error: 'Token no encontrado'
            });
        }

        const kickBotService = new KickBotService();

        try {
            const refreshedToken = await kickBotService.refreshToken(token);

            res.json({
                success: true,
                message: 'Token renovado exitosamente',
                token: {
                    id: refreshedToken.id,
                    kick_username: refreshedToken.kick_username,
                    expires_at: refreshedToken.token_expires_at,
                    is_active: refreshedToken.is_active
                }
            });

        } catch (refreshError) {
            res.status(400).json({
                success: false,
                error: 'No se pudo renovar el token',
                details: refreshError.message,
                code: refreshError.code || 'REFRESH_FAILED'
            });
        }

    } catch (error) {
        console.error('❌ [KICK ADMIN DEBUG] Error renovando token:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Desactivar token del bot
 */
exports.deactivateBotToken = async (req, res) => {
    try {
        const { tokenId } = req.params;
        const { reason } = req.body;

        const token = await KickBotToken.findByPk(tokenId);
        if (!token) {
            return res.status(404).json({
                success: false,
                error: 'Token no encontrado'
            });
        }

        await token.update({
            is_active: false,
            updated_at: new Date()
        });

        res.json({
            success: true,
            message: 'Token desactivado exitosamente',
            token: {
                id: token.id,
                kick_username: token.kick_username,
                reason: reason || 'Desactivado manualmente'
            }
        });

    } catch (error) {
        console.error('❌ [KICK ADMIN DEBUG] Error desactivando token:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Probar envío de mensaje con el bot
 */
exports.testBotMessage = async (req, res) => {
    try {
        const { message = 'Mensaje de prueba desde el panel de administración' } = req.body;

        const kickBotService = new KickBotService();
        const result = await kickBotService.sendMessage(message);

        res.json({
            success: result.ok,
            message: result.ok ? 'Mensaje enviado exitosamente' : 'Error enviando mensaje',
            details: {
                status: result.status,
                data: result.data,
                error: result.error
            }
        });

    } catch (error) {
        console.error('❌ [KICK ADMIN DEBUG] Error enviando mensaje de prueba:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
