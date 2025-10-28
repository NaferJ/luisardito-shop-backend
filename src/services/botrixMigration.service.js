const { Usuario, HistorialPunto, BotrixMigrationConfig } = require('../models');
const { sequelize } = require('../models/database');

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

            console.log(`🔄 [BOTRIX MIGRATION] Detected: @${targetUsername} has ${pointsAmount} points`);

            // Buscar el usuario por nickname de Kick
            const usuario = await Usuario.findOne({
                where: {
                    // Buscar por kick_data.username o nickname
                    [sequelize.Op.or]: [
                        sequelize.literal(`JSON_EXTRACT(kick_data, '$.username') = '${targetUsername}'`),
                        { nickname: targetUsername }
                    ]
                }
            });

            if (!usuario) {
                console.log(`❌ [BOTRIX MIGRATION] Usuario ${targetUsername} no encontrado en la base de datos`);
                return {
                    processed: false,
                    reason: 'User not found',
                    details: { targetUsername, pointsAmount }
                };
            }

            // Verificar si ya migró
            if (usuario.botrix_migrated) {
                console.log(`⚠️ [BOTRIX MIGRATION] Usuario ${targetUsername} ya migró puntos anteriormente`);
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

            console.log(`✅ [BOTRIX MIGRATION] Migración completada para ${targetUsername}: ${pointsAmount} puntos`);
            return {
                processed: true,
                reason: 'Migration successful',
                details: result
            };

        } catch (error) {
            console.error('❌ [BOTRIX MIGRATION] Error:', error);
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
     * Activar/desactivar migración
     */
    static async toggleMigration(enabled) {
        const config = await BotrixMigrationConfig.getConfig();
        await config.update({ migration_enabled: enabled });
        return config;
    }
}

module.exports = BotrixMigrationService;
