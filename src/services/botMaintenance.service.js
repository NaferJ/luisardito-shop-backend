// filepath: c:\Users\NaferJ\Projects\Private\luisardito-shop-backend\src\services\botMaintenance.service.js
const kickBotService = require('./kickBot.service');
const { KickBotToken } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Servicio de mantenimiento automático del bot de Kick
 * Se ejecuta cada hora para mantener los tokens activos
 */
class BotMaintenanceService {
    constructor() {
        this.intervalId = null;
        this.isRunning = false;
        this.intervalMinutes = parseInt(process.env.BOT_MAINTENANCE_INTERVAL_MINUTES || '60'); // Por defecto cada 60 minutos
    }

    /**
     * Inicia el mantenimiento automático
     */
    start() {
        if (this.isRunning) {
            logger.info('🤖 [BOT-MAINTENANCE] Servicio ya está ejecutándose');
            return;
        }

        logger.info(`🤖 [BOT-MAINTENANCE] Iniciando mantenimiento automático cada ${this.intervalMinutes} minutos`);

        // Ejecutar inmediatamente al iniciar
        this.performMaintenance();

        // Configurar intervalo
        const intervalMs = this.intervalMinutes * 60 * 1000;
        this.intervalId = setInterval(() => {
            this.performMaintenance();
        }, intervalMs);

        this.isRunning = true;

        // Manejar señales de terminación para detener el servicio correctamente
        process.on('SIGINT', () => this.stop());
        process.on('SIGTERM', () => this.stop());
    }

    /**
     * Detiene el mantenimiento automático
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        logger.info('🤖 [BOT-MAINTENANCE] Servicio detenido');
    }

    /**
     * Ejecuta el mantenimiento del bot
     */
    async performMaintenance() {
        try {
            logger.info('🔧 [BOT-MAINTENANCE] Iniciando mantenimiento programado...');

            // 1. Limpiar tokens expirados
            await this.cleanupExpiredTokens();

            // 2. Renovar todos los tokens que expiren pronto
            await this.refreshExpiringTokens();

            // 3. Opcional: Simular actividad del chat
            await this.simulateChatActivity();

            logger.info('🎉 [BOT-MAINTENANCE] Mantenimiento completado exitosamente');

        } catch (error) {
            logger.error('❌ [BOT-MAINTENANCE] Error en mantenimiento:', error.message);
        }
    }

    /**
     * Limpia tokens expirados
     */
    async cleanupExpiredTokens() {
        try {
            const now = new Date();
            const expiredTokens = await KickBotToken.findAll({
                where: {
                    is_active: true,
                    token_expires_at: { [Op.lt]: now }
                }
            });

            if (expiredTokens.length > 0) {
                await KickBotToken.update(
                    { is_active: false },
                    {
                        where: {
                            is_active: true,
                            token_expires_at: { [Op.lt]: now }
                        }
                    }
                );
                logger.info(`🧹 [BOT-MAINTENANCE] ${expiredTokens.length} tokens expirados marcados como inactivos`);
            } else {
                logger.info('✅ [BOT-MAINTENANCE] No hay tokens expirados para limpiar');
            }
        } catch (error) {
            logger.error('❌ [BOT-MAINTENANCE] Error limpiando tokens:', error.message);
        }
    }

    /**
     * Renueva todos los tokens que expiren pronto
     */
    async refreshExpiringTokens() {
        try {
            logger.info('🔄 [BOT-MAINTENANCE] Verificando tokens que expiran pronto...');
            const thresholdDate = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos a partir de ahora
            const tokens = await KickBotToken.findAll({
                where: {
                    is_active: true,
                    token_expires_at: { [Op.lt]: thresholdDate }
                }
            });

            for (const token of tokens) {
                await kickBotService.renewAccessToken(token);
            }

            if (tokens.length > 0) {
                logger.info(`✅ [BOT-MAINTENANCE] ${tokens.length} tokens renovados exitosamente`);
            } else {
                logger.info('✅ [BOT-MAINTENANCE] No hay tokens próximos a expirar');
            }
        } catch (error) {
            logger.error('❌ [BOT-MAINTENANCE] Error renovando tokens:', error.message);
        }
    }

    /**
     * Simula actividad del chat para mantener el bot activo
     */
    async simulateChatActivity() {
        try {
            // Solo simular actividad si está habilitado
            const simulateActivity = process.env.BOT_MAINTENANCE_SIMULATE_ACTIVITY === 'true';

            if (!simulateActivity) {
                return; // No simular actividad
            }

            logger.info('🛒 [BOT-MAINTENANCE] Simulando actividad del chat...');

            // Simular el comando !tienda (igual que el webhook)
            const reply = `Tienda del canal: https://shop.luisardito.com/`;
            const result = await kickBotService.sendMessage(reply);

            if (result.ok) {
                logger.info('✅ [BOT-MAINTENANCE] Actividad del chat simulada exitosamente');
            } else {
                logger.error('❌ [BOT-MAINTENANCE] Error simulando actividad:', result.error);
            }
        } catch (error) {
            logger.error('❌ [BOT-MAINTENANCE] Error en simulación de actividad:', error.message);
        }
    }

    /**
     * Obtiene estadísticas del servicio
     */
    getStats() {
        return {
            isRunning: this.isRunning,
            intervalMinutes: this.intervalMinutes,
            nextExecution: this.intervalId ? new Date(Date.now() + (this.intervalMinutes * 60 * 1000)) : null
        };
    }
}

// Exportar instancia singleton
const botMaintenanceService = new BotMaintenanceService();
module.exports = botMaintenanceService;
