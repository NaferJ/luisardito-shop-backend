const { KickBotCommand } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const kickBotService = require('./kickBot.service'); // Importar la instancia singleton

/**
 * Servicio para envío automático de comandos del bot de Kick
 * Revisa periódicamente los comandos con auto_send_interval_seconds > 0
 * y los envía automáticamente al chat de Kick
 * NOTA: Este sistema es exclusivo para Kick, NO envía a Discord
 */
class KickBotAutoSendService {
    constructor() {
        this.kickBotService = kickBotService; // Usar la instancia singleton
        this.intervalId = null;
        this.isRunning = false;
        this.checkInterval = 10000; // Revisar cada 10 segundos
    }

    /**
     * Inicia el servicio de envío automático
     */
    start() {
        if (this.isRunning) {
            logger.info('[AUTO-SEND] Servicio ya está ejecutándose');
            return;
        }

        logger.info('[AUTO-SEND] 🚀 Iniciando servicio de envío automático de comandos');
        this.isRunning = true;

        // Ejecutar inmediatamente la primera vez
        this.checkAndSendCommands();

        // Configurar intervalo periódico
        this.intervalId = setInterval(() => {
            this.checkAndSendCommands();
        }, this.checkInterval);
    }

    /**
     * Detiene el servicio de envío automático
     */
    stop() {
        if (!this.isRunning) {
            logger.info('[AUTO-SEND] Servicio ya está detenido');
            return;
        }

        logger.info('[AUTO-SEND] 🛑 Deteniendo servicio de envío automático');
        this.isRunning = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Revisa y envía comandos automáticamente
     */
    async checkAndSendCommands() {
        try {
            // Obtener comandos con envío automático habilitado
            const autoSendCommands = await KickBotCommand.findAll({
                where: {
                    enabled: true,
                    auto_send_interval_seconds: {
                        [Op.gt]: 0
                    }
                }
            });

            if (autoSendCommands.length === 0) {
                return; // No hay comandos para enviar automáticamente
            }

            const now = new Date();

            for (const command of autoSendCommands) {
                try {
                    // Verificar si es tiempo de enviar este comando
                    if (await this.shouldSendCommand(command, now)) {
                        await this.sendCommand(command);
                        // Actualizar el último envío
                        command.last_used_at = now;
                        await command.save();
                    }
                } catch (error) {
                    logger.error(`[AUTO-SEND] Error procesando comando ${command.command}:`, error);
                }
            }
        } catch (error) {
            logger.error('[AUTO-SEND] Error en checkAndSendCommands:', error);
        }
    }

    /**
     * Verifica si un comando debe enviarse en este momento
     */
    async shouldSendCommand(command, now) {
        if (!command.last_used_at) {
            // Nunca se ha enviado, enviar ahora
            return true;
        }

        const timeSinceLastSend = now - command.last_used_at;
        const intervalMs = command.auto_send_interval_seconds * 1000;

        return timeSinceLastSend >= intervalMs;
    }

    /**
     * Envía un comando automáticamente
     */
    async sendCommand(command) {
        try {
            logger.info(`[AUTO-SEND] 📤 Enviando comando automático: !${command.command}`);

            let response;

            if (command.command_type === 'dynamic') {
                // Para comandos dinámicos, necesitamos simular el contexto
                // Usar el handler correspondiente
                const handler = command.dynamic_handler;
                if (handler === 'puntos_handler') {
                    // Para puntos_handler, necesitamos un usuario. Usar un mensaje genérico
                    response = '¡Recuerda que puedes consultar tus puntos con !puntos!';
                } else {
                    // Para otros handlers, usar el mensaje simple
                    response = command.response_message;
                }
            } else {
                // Comando simple: reemplazar variables con valores por defecto
                response = command.response_message
                    .replace(/{username}/g, 'Sistema')
                    .replace(/{channel}/g, 'luisardito')
                    .replace(/{args}/g, '')
                    .replace(/{target_user}/g, 'todos')
                    .replace(/{points}/g, '0');
            }

            if (response) {
                // Enviar SOLO a Kick (el auto-send es exclusivo para Kick bot)
                const kickResult = await this.kickBotService.sendMessage(response);
                if (kickResult.ok) {
                    logger.info(`[AUTO-SEND] ✅ Comando enviado a Kick: !${command.command}`);
                } else {
                    logger.error(`[AUTO-SEND] ❌ Error enviando a Kick: ${kickResult.error}`);
                }


                // Incrementar contador de uso
                await command.incrementUsage();
            }
        } catch (error) {
            logger.error(`[AUTO-SEND] Error enviando comando ${command.command}:`, error);
        }
    }

    /**
     * Obtiene el estado del servicio
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            checkInterval: this.checkInterval,
            nextCheckIn: this.intervalId ? 'Próxima revisión en breve' : 'Servicio detenido'
        };
    }
}

module.exports = new KickBotAutoSendService();
