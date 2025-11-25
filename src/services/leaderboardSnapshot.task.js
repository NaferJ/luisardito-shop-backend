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

            // 2. Limpiar snapshots antiguos (se ejecuta solo una vez al día)
            if (this._shouldCleanup()) {
                logger.info(`🧹 [LEADERBOARD-SNAPSHOT] Iniciando limpieza de snapshots antiguos (>${this.cleanupDays} días)...`);

                const cleanupResult = await leaderboardService.cleanOldSnapshots(this.cleanupDays);

                if (cleanupResult.success) {
                    logger.info(
                        `✅ [LEADERBOARD-SNAPSHOT] Limpieza completada: ${cleanupResult.deleted_count} registros eliminados`
                    );
                }

                this._markCleanupDone();
            }

        } catch (error) {
            logger.error('❌ [LEADERBOARD-SNAPSHOT] Error al ejecutar snapshot:', error);
            // No lanzar el error para que la tarea continúe ejecutándose
        }
    }

    /**
     * Verifica si debe ejecutarse la limpieza de snapshots antiguos
     * Se ejecuta solo una vez al día
     * @private
     */
    _shouldCleanup() {
        const lastCleanup = this._getLastCleanupDate();
        if (!lastCleanup) return true;

        const now = new Date();
        const hoursSinceLastCleanup = (now - lastCleanup) / (1000 * 60 * 60);

        return hoursSinceLastCleanup >= 24;
    }

    /**
     * Obtiene la fecha de la última limpieza
     * @private
     */
    _getLastCleanupDate() {
        if (!this._lastCleanupDate) {
            return null;
        }
        return this._lastCleanupDate;
    }

    /**
     * Marca que se ejecutó la limpieza
     * @private
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
