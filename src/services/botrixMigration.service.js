const { Usuario, HistorialPunto, BotrixMigrationConfig, UserWatchtime } = require('../models');
const { sequelize } = require('../models/database');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class BotrixMigrationService {
    /**
     * Procesar mensaje de chat para detectar respuesta de BotRix
     * @param {Object} chatMessage - Mensaje de chat recibido del webhook
     */
    static async processChatMessage(chatMessage) {
        try {
            const { sender, content, broadcaster } = chatMessage;

            // Verificar que el mensaje viene de BotRix
            if (sender.username !== 'BotRix') {
                return { processed: false, reason: 'Not from BotRix' };
            }

            // Verificar configuración activa
            const config = await BotrixMigrationConfig.getConfig();
            if (!config.migration_enabled) {
                return { processed: false, reason: 'Migration disabled' };
            }

            // Regex para detectar el patrón: "@usuario tiene X puntos."
            const pointsRegex = /@(\w+)\s+tiene\s+(\d+)\s+puntos\./i;
            const match = content.match(pointsRegex);

            if (!match) {
                return { processed: false, reason: 'Pattern not matched' };
            }

            const [, targetUsername, botrixPoints] = match;
            const pointsAmount = parseInt(botrixPoints, 10);

            logger.info(`🔄 [BOTRIX MIGRATION] Detected: @${targetUsername} has ${pointsAmount} points`);

            // Buscar el usuario por nickname de Kick
            const usuario = await Usuario.findOne({
                where: {
                    // Buscar por kick_data.username o nickname
                    [Op.or]: [
                        sequelize.literal(`JSON_EXTRACT(kick_data, '$.username') = '${targetUsername}'`),
                        { nickname: targetUsername }
                    ]
                }
            });

            if (!usuario) {
                logger.info(`❌ [BOTRIX MIGRATION] Usuario ${targetUsername} no encontrado en la base de datos`);
                return {
                    processed: false,
                    reason: 'User not found',
                    details: { targetUsername, pointsAmount }
                };
            }

            // Verificar si ya migró
            if (usuario.botrix_migrated) {
                logger.info(`⚠️ [BOTRIX MIGRATION] Usuario ${targetUsername} ya migró puntos anteriormente`);
                return {
                    processed: false,
                    reason: 'Already migrated',
                    details: {
                        targetUsername,
                        pointsAmount,
                        migrated_at: usuario.botrix_migrated_at,
                        previous_migration: usuario.botrix_points_migrated
                    }
                };
            }

            // Realizar la migración
            const result = await this.migrateBotrixPoints(usuario, pointsAmount, targetUsername);

            logger.info(`✅ [BOTRIX MIGRATION] Migración completada para ${targetUsername}: ${pointsAmount} puntos`);
            return {
                processed: true,
                reason: 'Migration successful',
                details: result
            };

        } catch (error) {
            logger.error('❌ [BOTRIX MIGRATION] Error:', error);
            return {
                processed: false,
                reason: 'Error',
                error: error.message
            };
        }
    }

    /**
     * Realizar migración de puntos de Botrix
     * @param {Object} usuario - Usuario de la base de datos
     * @param {number} pointsAmount - Cantidad de puntos a migrar
     * @param {string} kickUsername - Username de Kick para logs
     */
    static async migrateBotrixPoints(usuario, pointsAmount, kickUsername) {
        const transaction = await sequelize.transaction();

        try {
            // Actualizar puntos del usuario
            const puntosAnteriores = usuario.puntos;
            const nuevosTotal = puntosAnteriores + pointsAmount;

            await usuario.update({
                puntos: nuevosTotal,
                botrix_migrated: true,
                botrix_migrated_at: new Date(),
                botrix_points_migrated: pointsAmount
            }, { transaction });

            // Crear entrada en historial de puntos
            await HistorialPunto.create({
                usuario_id: usuario.id,
                puntos: pointsAmount,
                tipo: 'ganado',
                concepto: 'Migración desde Botrix',
                motivo: `Puntos migrados automáticamente desde Botrix por respuesta del bot`,
                kick_event_data: {
                    event_type: 'botrix_migration',
                    kick_username: kickUsername,
                    original_points: pointsAmount,
                    migration_date: new Date().toISOString()
                }
            }, { transaction });

            await transaction.commit();

            return {
                usuario_id: usuario.id,
                nickname: usuario.nickname,
                kick_username: kickUsername,
                puntos_anteriores: puntosAnteriores,
                puntos_migrados: pointsAmount,
                nuevo_total: nuevosTotal,
                migrated_at: new Date()
            };

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Obtener estadísticas de migración
     */
    static async getMigrationStats() {
        const totalUsers = await Usuario.count();
        const migratedUsers = await Usuario.count({ where: { botrix_migrated: true } });
        const pendingUsers = totalUsers - migratedUsers;

        const totalMigratedPoints = await Usuario.sum('botrix_points_migrated', {
            where: { botrix_migrated: true }
        }) || 0;

        const config = await BotrixMigrationConfig.getConfig();

        return {
            total_users: totalUsers,
            migrated_users: migratedUsers,
            pending_users: pendingUsers,
            migration_percentage: totalUsers > 0 ? ((migratedUsers / totalUsers) * 100).toFixed(2) : 0,
            total_migrated_points: totalMigratedPoints,
            migration_enabled: config.migration_enabled,
            last_updated: new Date()
        };
    }

    /**
     * Procesar mensaje de chat para detectar watchtime de BotRix
     * Patrón: "@usuario ha pasado X dias Y horas Z min viendo este canal"
     * @param {Object} chatMessage - Mensaje de chat recibido del webhook
     */
    static async processWatchtimeMessage(chatMessage) {
        try {
            const { sender, content, broadcaster } = chatMessage;

            // Verificar que el mensaje viene de BotRix
            if (sender.username !== 'BotRix') {
                return { processed: false, reason: 'Not from BotRix' };
            }

            // Verificar configuración de migración de watchtime activa
            const config = await BotrixMigrationConfig.getConfig();
            if (!config.watchtime_migration_enabled) {
                return { processed: false, reason: 'Watchtime migration disabled' };
            }

            // Regex para detectar: "@usuario ha pasado X dias Y horas Z min viendo este canal"
            // Flexible para manejar variaciones en singular/plural
            const watchtimeRegex = /@(\w+)\s+ha\s+pasado\s+(?:(\d+)\s+d[íi]as?)?\s*(?:(\d+)\s+horas?)?\s*(?:(\d+)\s+min)?\s+viendo\s+este\s+canal/i;
            const match = content.match(watchtimeRegex);

            if (!match) {
                return { processed: false, reason: 'Pattern not matched' };
            }

            const [, targetUsername, daysStr, hoursStr, minutesStr] = match;

            const days = parseInt(daysStr || 0, 10);
            const hours = parseInt(hoursStr || 0, 10);
            const minutes = parseInt(minutesStr || 0, 10);

            // Convertir todo a minutos: días × 24 × 60 + horas × 60 + minutos
            const totalWatchtimeMinutes = (days * 24 * 60) + (hours * 60) + minutes;

            logger.info(`🔄 [BOTRIX WATCHTIME MIGRATION] Detected: @${targetUsername} has ${days}d ${hours}h ${minutes}m = ${totalWatchtimeMinutes} minutes`);

            // Buscar el usuario por nickname de Kick
            const usuario = await Usuario.findOne({
                where: {
                    [Op.or]: [
                        sequelize.literal(`JSON_EXTRACT(kick_data, '$.username') = '${targetUsername}'`),
                        { nickname: targetUsername }
                    ]
                }
            });

            if (!usuario) {
                logger.info(`❌ [BOTRIX WATCHTIME MIGRATION] Usuario ${targetUsername} no encontrado en la base de datos`);
                return {
                    processed: false,
                    reason: 'User not found',
                    details: { targetUsername, totalWatchtimeMinutes }
                };
            }

            // Verificar si ya migró watchtime
            if (usuario.botrix_watchtime_migrated) {
                logger.info(`⚠️ [BOTRIX WATCHTIME MIGRATION] Usuario ${targetUsername} ya migró watchtime anteriormente`);
                return {
                    processed: false,
                    reason: 'Already migrated',
                    details: {
                        targetUsername,
                        totalWatchtimeMinutes,
                        migrated_at: usuario.botrix_watchtime_migrated_at,
                        previous_migration: usuario.botrix_watchtime_minutes_migrated
                    }
                };
            }

            // Realizar la migración
            const result = await this.migrateWatchtime(usuario, totalWatchtimeMinutes, targetUsername, { days, hours, minutes });

            logger.info(`✅ [BOTRIX WATCHTIME MIGRATION] Migración completada para ${targetUsername}: ${totalWatchtimeMinutes} minutos`);
            return {
                processed: true,
                reason: 'Migration successful',
                details: result
            };

        } catch (error) {
            logger.error('❌ [BOTRIX WATCHTIME MIGRATION] Error:', error);
            return {
                processed: false,
                reason: 'Error',
                error: error.message
            };
        }
    }

    /**
     * Realizar migración de watchtime de Botrix
     * @param {Object} usuario - Usuario de la base de datos
     * @param {number} totalWatchtimeMinutes - Minutos totales a migrar
     * @param {string} kickUsername - Username de Kick para logs
     * @param {Object} breakdown - Desglose de días, horas, minutos
     */
    static async migrateWatchtime(usuario, totalWatchtimeMinutes, kickUsername, breakdown = {}) {
        const transaction = await sequelize.transaction();

        try {
            // Obtener o crear registro de watchtime del usuario
            let userWatchtime = await UserWatchtime.findOne({
                where: { usuario_id: usuario.id },
                transaction
            });

            if (!userWatchtime) {
                // Crear nuevo registro de watchtime
                userWatchtime = await UserWatchtime.create({
                    usuario_id: usuario.id,
                    kick_user_id: usuario.user_id_ext,
                    total_watchtime_minutes: totalWatchtimeMinutes,
                    message_count: 0,
                    first_message_date: new Date()
                }, { transaction });
            } else {
                // Actualizar watchtime existente
                const previousWatchtime = userWatchtime.total_watchtime_minutes;
                userWatchtime.total_watchtime_minutes += totalWatchtimeMinutes;
                await userWatchtime.save({ transaction });
            }

            // Actualizar usuario con información de migración
            await usuario.update({
                botrix_watchtime_migrated: true,
                botrix_watchtime_migrated_at: new Date(),
                botrix_watchtime_minutes_migrated: totalWatchtimeMinutes
            }, { transaction });

            await transaction.commit();

            return {
                usuario_id: usuario.id,
                nickname: usuario.nickname,
                kick_username: kickUsername,
                watchtime_minutes_migrated: totalWatchtimeMinutes,
                watchtime_breakdown: breakdown,
                total_watchtime_after_migration: userWatchtime.total_watchtime_minutes,
                migrated_at: new Date()
            };

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Obtener estadísticas de migración de watchtime
     */
    static async getWatchtimeMigrationStats() {
        const totalUsers = await Usuario.count();
        const migratedUsers = await Usuario.count({ where: { botrix_watchtime_migrated: true } });
        const pendingUsers = totalUsers - migratedUsers;

        const totalMigratedWatchtime = await Usuario.sum('botrix_watchtime_minutes_migrated', {
            where: { botrix_watchtime_migrated: true }
        }) || 0;

        const config = await BotrixMigrationConfig.getConfig();

        return {
            total_users: totalUsers,
            migrated_users: migratedUsers,
            pending_users: pendingUsers,
            migration_percentage: totalUsers > 0 ? ((migratedUsers / totalUsers) * 100).toFixed(2) : 0,
            total_migrated_minutes: totalMigratedWatchtime,
            watchtime_migration_enabled: config.watchtime_migration_enabled,
            last_updated: new Date()
        };
    }

    /**
     * Activar/desactivar migración
     */
    static async toggleMigration(enabled) {
        const config = await BotrixMigrationConfig.getConfig();
        await config.update({ migration_enabled: enabled });
        return config;
    }
}

module.exports = BotrixMigrationService;
