const cron = require('node-cron');
const DbCleanupService = require('./dbCleanup.service');
const logger = require('../utils/logger');
/**
 * Tarea programada de limpieza de base de datos.
 * Se ejecuta diariamente a las 4:30 AM (antes del backup de las 3:00 AM del dia siguiente).
 *
 * Limpia:
 *  - kick_webhook_events procesados > 7 dias
 *  - historial_puntos: JSON > 30 dias, registros de chat > 90 dias
 *  - notificaciones leidas > 60 dias, no leidas > 120 dias
 *  - refresh_tokens revocados y expirados > 7 dias
 */
class DbCleanupTask {
    constructor() {
        this.scheduledTask = null;
    }
    /**
     * Inicia la tarea programada de limpieza
     */
    start() {
        const cronExpression = '30 4 * * *';
        logger.info('🧹 [DB-CLEANUP] Programando limpieza diaria a las 04:30');
        this.scheduledTask = cron.schedule(cronExpression, async () => {
            logger.info('🕐 [DB-CLEANUP] Ejecutando limpieza programada...');
            try {
                const results = await DbCleanupService.runAll();
                logger.info('✅ [DB-CLEANUP] Limpieza programada completada:', JSON.stringify(results));
            } catch (error) {
                logger.error('❌ [DB-CLEANUP] Error en limpieza programada:', error);
            }
        });
        logger.info('✅ [DB-CLEANUP] Tarea de limpieza programada iniciada');
    }
    /**
     * Detiene la tarea programada
     */
    stop() {
        if (this.scheduledTask) {
            this.scheduledTask.stop();
            logger.info('⏹️ [DB-CLEANUP] Tarea de limpieza detenida');
        }
    }
    /**
     * Ejecuta una limpieza manual (util para testing o ejecucion inmediata)
     */
    async runManual() {
        logger.info('🔧 [DB-CLEANUP] Ejecucion manual solicitada');
        return await DbCleanupService.runAll();
    }
}
module.exports = new DbCleanupTask();
