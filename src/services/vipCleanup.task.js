const cron = require('node-cron');
const VipService = require('../services/vip.service');

class VipCleanupTask {
    static start() {
        // Ejecutar todos los días a las 3:00 AM
        cron.schedule('0 3 * * *', async () => {
            try {
                console.log('🧹 [VIP CLEANUP] Iniciando limpieza de VIPs expirados...');
                const result = await VipService.cleanupExpiredVips();
                console.log(`🧹 [VIP CLEANUP] Completado: ${result.cleaned_count} VIPs expirados removidos`);
            } catch (error) {
                console.error('🧹 [VIP CLEANUP] Error en limpieza automática:', error);
            }
        });

        console.log('🧹 [VIP CLEANUP] Tarea automática programada (todos los días a las 3:00 AM)');
    }

    static async runManually() {
        try {
            console.log('🧹 [VIP CLEANUP] Ejecutando limpieza manual...');
            const result = await VipService.cleanupExpiredVips();
            console.log(`🧹 [VIP CLEANUP] Manual completado: ${result.cleaned_count} VIPs expirados removidos`);
            return result;
        } catch (error) {
            console.error('🧹 [VIP CLEANUP] Error en limpieza manual:', error);
            throw error;
        }
    }
}

module.exports = VipCleanupTask;
