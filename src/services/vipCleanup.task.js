const cron = require('node-cron');
const VipService = require('../services/vip.service');
const logger = require('../utils/logger');

class VipCleanupTask {
    static start() {
        // Ejecutar todos los días a las 3:00 AM
        cron.schedule('0 3 * * *', async () => {
            try {
                logger.info('🧹 [VIP CLEANUP] Iniciando limpieza de VIPs expirados...');
                const result = await VipService.cleanupExpiredVips();
                logger.info(`🧹 [VIP CLEANUP] Completado: ${result.cleaned_count} VIPs expirados removidos`);
            } catch (error) {
                logger.error('🧹 [VIP CLEANUP] Error en limpieza automática:', error);
            }
        });

        logger.info('🧹 [VIP CLEANUP] Tarea automática programada (todos los días a las 3:00 AM)');
    }

    static async runManually() {
        try {
            logger.info('🧹 [VIP CLEANUP] Ejecutando limpieza manual...');
            const result = await VipService.cleanupExpiredVips();
            logger.info(`🧹 [VIP CLEANUP] Manual completado: ${result.cleaned_count} VIPs expirados removidos`);
            return result;
        } catch (error) {
            logger.error('🧹 [VIP CLEANUP] Error en limpieza manual:', error);
            throw error;
        }
    }
}

module.exports = VipCleanupTask;
