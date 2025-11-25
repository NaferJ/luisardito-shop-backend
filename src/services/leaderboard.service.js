const Usuario = require('../models/usuario.model');
const LeaderboardSnapshot = require('../models/leaderboardSnapshot.model');
const { sequelize } = require('../models/database');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class LeaderboardService {
    /**
     * Obtiene el leaderboard actual con indicadores de cambio de posición
     * @param {Object} options - Opciones de consulta
     * @param {number} options.limit - Número de usuarios a retornar (default: 100)
     * @param {number} options.offset - Offset para paginación (default: 0)
     * @param {number} options.userId - ID de usuario específico para buscar su posición
     * @returns {Object} Leaderboard con posiciones y cambios
     */
    async getLeaderboard({ limit = 100, offset = 0, userId = null } = {}) {
        try {
            // 1. Obtener el ranking actual
            const currentRanking = await this._getCurrentRanking();

            // 2. Obtener el último snapshot para comparar posiciones
            const lastSnapshot = await this._getLastSnapshot();

            // 3. Combinar datos actuales con históricos para detectar cambios
            const leaderboardWithChanges = this._calculatePositionChanges(
                currentRanking,
                lastSnapshot
            );

            // 4. Si se solicita un usuario específico, incluir su posición aunque esté fuera del top
            let userPosition = null;
            if (userId) {
                userPosition = leaderboardWithChanges.find(u => u.usuario_id === userId);
                if (!userPosition) {
                    // El usuario está fuera del ranking actual, buscarlo manualmente
                    const usuario = await Usuario.findByPk(userId);
                    if (usuario) {
                        const position = currentRanking.findIndex(u => u.usuario_id === userId) + 1;
                        userPosition = {
                            usuario_id: usuario.id,
                            nickname: usuario.nickname,
                            puntos: usuario.puntos,
                            position: position || currentRanking.length + 1,
                            position_change: 0,
                            change_indicator: 'neutral',
                            is_vip: usuario.is_vip && usuario.isVipActive(),
                            kick_data: usuario.kick_data
                        };
                    }
                }
            }

            // 5. Aplicar paginación
            const paginatedData = leaderboardWithChanges.slice(offset, offset + limit);

            return {
                success: true,
                data: paginatedData,
                meta: {
                    total: leaderboardWithChanges.length,
                    limit,
                    offset,
                    last_update: lastSnapshot?.snapshot_date || null
                },
                user_position: userPosition
            };
        } catch (error) {
            logger.error('❌ Error al obtener leaderboard:', error);
            throw error;
        }
    }

    /**
     * Obtiene el ranking actual de usuarios ordenado por puntos
     * @private
     */
    async _getCurrentRanking() {
        const usuarios = await Usuario.findAll({
            where: {
                puntos: {
                    [Op.gt]: 0 // Solo usuarios con puntos
                }
            },
            attributes: [
                'id',
                'nickname',
                'puntos',
                'is_vip',
                'vip_expires_at',
                'kick_data'
            ],
            order: [
                ['puntos', 'DESC'],
                ['creado', 'ASC'] // En caso de empate, el más antiguo primero
            ],
            raw: true
        });

        // Asignar posiciones
        return usuarios.map((usuario, index) => ({
            usuario_id: usuario.id,
            nickname: usuario.nickname,
            puntos: usuario.puntos,
            position: index + 1,
            is_vip: usuario.is_vip && (!usuario.vip_expires_at || new Date(usuario.vip_expires_at) > new Date()),
            kick_data: usuario.kick_data
        }));
    }

    /**
     * Obtiene el último snapshot guardado
     * @private
     */
    async _getLastSnapshot() {
        const lastSnapshotDate = await LeaderboardSnapshot.max('snapshot_date');

        if (!lastSnapshotDate) {
            return [];
        }

        const snapshots = await LeaderboardSnapshot.findAll({
            where: {
                snapshot_date: lastSnapshotDate
            },
            attributes: ['usuario_id', 'position', 'puntos'],
            raw: true
        });

        // Crear un mapa para acceso rápido
        return snapshots.reduce((acc, snapshot) => {
            acc[snapshot.usuario_id] = {
                position: snapshot.position,
                puntos: snapshot.puntos
            };
            return acc;
        }, {});
    }

    /**
     * Calcula los cambios de posición comparando ranking actual con snapshot anterior
     * @private
     */
    _calculatePositionChanges(currentRanking, lastSnapshotMap) {
        return currentRanking.map(current => {
            const previous = lastSnapshotMap[current.usuario_id];

            let position_change = 0;
            let change_indicator = 'neutral'; // 'up', 'down', 'neutral', 'new'

            if (!previous) {
                // Usuario nuevo en el ranking
                change_indicator = 'new';
            } else {
                position_change = previous.position - current.position;

                if (position_change > 0) {
                    change_indicator = 'up'; // Subió de posición (número menor = mejor)
                } else if (position_change < 0) {
                    change_indicator = 'down'; // Bajó de posición
                } else {
                    change_indicator = 'neutral'; // Mantuvo su posición
                }
            }

            return {
                ...current,
                position_change: Math.abs(position_change),
                change_indicator,
                previous_position: previous?.position || null,
                previous_points: previous?.puntos || null
            };
        });
    }

    /**
     * Crea un snapshot del leaderboard actual
     * Este método debería ejecutarse periódicamente (ej: cada hora, cada día)
     */
    async createSnapshot() {
        const transaction = await sequelize.transaction();

        try {
            logger.info('📸 Creando snapshot del leaderboard...');

            const currentRanking = await this._getCurrentRanking();
            const snapshotDate = new Date();

            const snapshotRecords = currentRanking.map(user => ({
                usuario_id: user.usuario_id,
                nickname: user.nickname,
                puntos: user.puntos,
                position: user.position,
                snapshot_date: snapshotDate,
                is_vip: user.is_vip,
                kick_data: user.kick_data
            }));

            await LeaderboardSnapshot.bulkCreate(snapshotRecords, { transaction });

            await transaction.commit();

            logger.info(`✅ Snapshot creado exitosamente: ${snapshotRecords.length} usuarios registrados`);

            return {
                success: true,
                snapshot_date: snapshotDate,
                users_count: snapshotRecords.length
            };
        } catch (error) {
            await transaction.rollback();
            logger.error('❌ Error al crear snapshot del leaderboard:', error);
            throw error;
        }
    }

    /**
     * Limpia snapshots antiguos para mantener la base de datos optimizada
     * @param {number} daysToKeep - Días de histórico a mantener (default: 30)
     */
    async cleanOldSnapshots(daysToKeep = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            const deleted = await LeaderboardSnapshot.destroy({
                where: {
                    snapshot_date: {
                        [Op.lt]: cutoffDate
                    }
                }
            });

            logger.info(`🧹 Limpieza de snapshots: ${deleted} registros antiguos eliminados`);

            return {
                success: true,
                deleted_count: deleted
            };
        } catch (error) {
            logger.error('❌ Error al limpiar snapshots antiguos:', error);
            throw error;
        }
    }

    /**
     * Obtiene el historial de posiciones de un usuario específico
     * @param {number} userId - ID del usuario
     * @param {number} days - Días de histórico a retornar (default: 7)
     */
    async getUserPositionHistory(userId, days = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            const history = await LeaderboardSnapshot.findAll({
                where: {
                    usuario_id: userId,
                    snapshot_date: {
                        [Op.gte]: cutoffDate
                    }
                },
                attributes: ['position', 'puntos', 'snapshot_date'],
                order: [['snapshot_date', 'ASC']],
                raw: true
            });

            // Agregar posición actual si no hay snapshot reciente
            const lastSnapshotDate = history.length > 0 ? new Date(history[history.length - 1].snapshot_date) : null;
            const hoursSinceLastSnapshot = lastSnapshotDate
                ? (Date.now() - lastSnapshotDate.getTime()) / (1000 * 60 * 60)
                : Infinity;

            if (hoursSinceLastSnapshot > 1) { // Si pasó más de 1 hora
                const usuario = await Usuario.findByPk(userId);
                if (usuario) {
                    const currentRanking = await this._getCurrentRanking();
                    const currentPosition = currentRanking.findIndex(u => u.usuario_id === userId) + 1;

                    history.push({
                        position: currentPosition || null,
                        puntos: usuario.puntos,
                        snapshot_date: new Date()
                    });
                }
            }

            return {
                success: true,
                history
            };
        } catch (error) {
            logger.error(`❌ Error al obtener historial del usuario ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Obtiene estadísticas generales del leaderboard
     */
    async getLeaderboardStats() {
        try {
            const totalUsers = await Usuario.count({
                where: {
                    puntos: {
                        [Op.gt]: 0
                    }
                }
            });

            const totalPoints = await Usuario.sum('puntos');

            const avgPoints = totalUsers > 0 ? Math.round(totalPoints / totalUsers) : 0;

            const topUser = await Usuario.findOne({
                where: {
                    puntos: {
                        [Op.gt]: 0
                    }
                },
                order: [['puntos', 'DESC']],
                attributes: ['nickname', 'puntos'],
                raw: true
            });

            const vipCount = await Usuario.count({
                where: {
                    is_vip: true,
                    [Op.or]: [
                        { vip_expires_at: null },
                        { vip_expires_at: { [Op.gt]: new Date() } }
                    ]
                }
            });

            return {
                success: true,
                stats: {
                    total_users: totalUsers,
                    total_points: totalPoints || 0,
                    average_points: avgPoints,
                    top_user: topUser,
                    vip_users: vipCount
                }
            };
        } catch (error) {
            logger.error('❌ Error al obtener estadísticas del leaderboard:', error);
            throw error;
        }
    }
}

module.exports = new LeaderboardService();
