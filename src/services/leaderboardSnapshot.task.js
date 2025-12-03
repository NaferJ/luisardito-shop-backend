const leaderboardService = require('./leaderboard.service');
const logger = require('../utils/logger');

class LeaderboardSnapshotTask {
    constructor() {
        this.intervalId = null;
        this.isRunning = false;
        // Configuración: ejecutar cada 6 horas por defecto
        this.intervalHours = parseInt(process.env.LEADERBOARD_SNAPSHOT_INTERVAL_HOURS) || 6;
        this.cleanupDays = parseInt(process.env.LEADERBOARD_CLEANUP_DAYS) || 30;
    }

    /**
     * Inicia la tarea programada de snapshots
     */
    start() {
        if (this.isRunning) {
            logger.warn('⚠️  [LEADERBOARD-SNAPSHOT] La tarea ya está en ejecución');
            return;
        }

        logger.info(`🚀 [LEADERBOARD-SNAPSHOT] Iniciando tarea programada (cada ${this.intervalHours} horas)`);

        // Ejecutar inmediatamente al iniciar (opcional, comentar si no se desea)
        this._executeSnapshot();

        // Programar ejecución periódica
        const intervalMs = this.intervalHours * 60 * 60 * 1000;
        this.intervalId = setInterval(() => {
            this._executeSnapshot();
        }, intervalMs);

        this.isRunning = true;

        logger.info(`✅ [LEADERBOARD-SNAPSHOT] Tarea programada iniciada correctamente`);
    }

    /**
     * Detiene la tarea programada
     */
    stop() {
        if (!this.isRunning) {
            logger.warn('⚠️  [LEADERBOARD-SNAPSHOT] La tarea no está en ejecución');
            return;
        }

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.isRunning = false;
        logger.info('🛑 [LEADERBOARD-SNAPSHOT] Tarea programada detenida');
    }

    /**
     * Ejecuta el snapshot y limpieza de datos antiguos
     * @private
     */
    async _executeSnapshot() {
        try {
            logger.info('📸 [LEADERBOARD-SNAPSHOT] Iniciando snapshot del leaderboard...');

            // 1. Crear snapshot del leaderboard actual
            const snapshotResult = await leaderboardService.createSnapshot();

            if (snapshotResult.success) {
                logger.info(
                    `✅ [LEADERBOARD-SNAPSHOT] Snapshot creado: ${snapshotResult.users_count} usuarios registrados`
                );
            }

            // 2. Limpiar snapshots antiguos solo si realmente hay datos que limpiar
            const shouldCleanup = await this._shouldCleanup();
            if (shouldCleanup) {
                logger.info(`🧹 [LEADERBOARD-SNAPSHOT] Iniciando limpieza de snapshots antiguos (>${this.cleanupDays} días)...`);

                const cleanupResult = await leaderboardService.cleanOldSnapshots(this.cleanupDays);

                if (cleanupResult.success) {
                    logger.info(
                        `✅ [LEADERBOARD-SNAPSHOT] Limpieza completada: ${cleanupResult.deleted_count} registros eliminados`
                    );
                }
            } else {
                logger.info('✅ [LEADERBOARD-SNAPSHOT] No hay snapshots antiguos para limpiar');
            }

        } catch (error) {
            logger.error('❌ [LEADERBOARD-SNAPSHOT] Error al ejecutar snapshot:', error);
            // No lanzar el error para que la tarea continúe ejecutándose
        }
    }

    /**
     * Verifica si debe ejecutarse la limpieza de snapshots antiguos
     * Consulta directamente la base de datos para determinar si hay snapshots
     * más antiguos que el período de retención configurado
     * @private
     */
    async _shouldCleanup() {
        try {
            const LeaderboardSnapshot = require('../models/leaderboardSnapshot.model');
            
            // Calcular la fecha límite de retención
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.cleanupDays);

            // Verificar si existen snapshots más antiguos que el límite
            const oldSnapshotsCount = await LeaderboardSnapshot.count({
                where: {
                    snapshot_date: {
                        [require('sequelize').Op.lt]: cutoffDate
                    }
                }
            });

            // Solo ejecutar limpieza si hay snapshots antiguos
            return oldSnapshotsCount > 0;
        } catch (error) {
            logger.error('❌ [LEADERBOARD-SNAPSHOT] Error al verificar necesidad de limpieza:', error);
            return false; // En caso de error, no ejecutar limpieza por seguridad
        }
    }

    /**
     * Obtiene la fecha de la última limpieza (deprecated - mantenido por compatibilidad)
     * @private
     * @deprecated Ya no se usa, la lógica ahora consulta directamente la BD
     */
    _getLastCleanupDate() {
        if (!this._lastCleanupDate) {
            return null;
        }
        return this._lastCleanupDate;
    }

    /**
     * Marca que se ejecutó la limpieza (deprecated - mantenido por compatibilidad)
     * @private
     * @deprecated Ya no se usa, la lógica ahora consulta directamente la BD
     */
    _markCleanupDone() {
        this._lastCleanupDate = new Date();
    }

    /**
     * Ejecuta un snapshot manual (útil para testing)
     */
    async executeManual() {
        logger.info('🔧 [LEADERBOARD-SNAPSHOT] Ejecución manual solicitada');
        await this._executeSnapshot();
    }

    /**
     * Obtiene el estado actual de la tarea
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            intervalHours: this.intervalHours,
            cleanupDays: this.cleanupDays,
            lastCleanup: this._lastCleanupDate || null,
            nextSnapshot: this.intervalId ? new Date(Date.now() + (this.intervalHours * 60 * 60 * 1000)) : null
        };
    }
}

module.exports = new LeaderboardSnapshotTask();
