const cron = require('node-cron');
const backupService = require('./backup.service');
const logger = require('../utils/logger');

class BackupScheduler {
    constructor() {
        this.scheduledTask = null;
    }

    /**
     * Inicia el scheduler de backups automáticos
     */
    start() {
        const backupTime = process.env.BACKUP_TIME || '03:00';
        const enabled = process.env.BACKUP_ENABLED === 'true';

        if (!enabled) {
            logger.info('ℹ️ Scheduler de backups deshabilitado');
            return;
        }

        // Parsear hora (formato HH:mm)
        const [hour, minute] = backupTime.split(':');
        
        // Cron expression: "minuto hora * * *"
        const cronExpression = `${minute} ${hour} * * *`;

        logger.info(`⏰ Programando backup diario a las ${backupTime}`);

        this.scheduledTask = cron.schedule(cronExpression, async () => {
            logger.info('🕐 Ejecutando backup programado...');
            
            try {
                const result = await backupService.createBackup();
                
                if (result.success) {
                    logger.info(`✅ Backup programado completado: ${result.filename}`);
                } else {
                    logger.error(`❌ Backup programado falló: ${result.error || result.reason}`);
                }
            } catch (error) {
                logger.error('❌ Error en backup programado:', error);
            }
        });

        logger.info(`✅ Scheduler de backups iniciado (${cronExpression})`);
    }

    /**
     * Detiene el scheduler
     */
    stop() {
        if (this.scheduledTask) {
            this.scheduledTask.stop();
            logger.info('⏹️ Scheduler de backups detenido');
        }
    }

    /**
     * Ejecuta un backup manual inmediatamente
     */
    async runManualBackup() {
        logger.info('🔄 Ejecutando backup manual...');
        return await backupService.createBackup();
    }
}

module.exports = new BackupScheduler();
