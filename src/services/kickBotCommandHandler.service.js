const { KickBotCommand, Usuario, DiscordUserLink } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * ==========================================
 * 🤖 SERVICIO DE MANEJO DE COMANDOS DEL BOT
 * ==========================================
 * Este servicio maneja la ejecución dinámica de comandos
 * configurados en la base de datos
 */

class KickBotCommandHandlerService {
    /**
     * Procesa un mensaje del chat para detectar y ejecutar comandos
     * @param {string} message - Mensaje del chat
     * @param {string} username - Usuario que envió el mensaje
     * @param {string} channelName - Nombre del canal
     * @param {object} bot - Instancia del bot service
     * @param {object} messageContext - Contexto del mensaje (para Discord)
     * @param {string} platform - Plataforma: 'kick' o 'discord'
     * @param {string} discordUserId - ID del usuario en Discord (solo para Discord)
     * @returns {Promise<boolean>} - True si se procesó un comando, false si no
     */
    async processMessage(message, username, channelName, bot, messageContext = null, platform = 'kick', discordUserId = null) {
        try {
            const content = String(message || '').trim();

            // Verificar si es un comando (empieza con !)
            if (!content.startsWith('!')) {
                return false;
            }

            // Buscar el comando en la base de datos
            const command = await KickBotCommand.findByCommand(content);

            if (!command) {
                // No es un comando registrado
                return false;
            }

            logger.info(`🤖 [BOT-COMMAND] Ejecutando comando: !${command.command} por ${username} (${platform})`);

            // Encontrar el usuario en la base de datos
            let usuario = null;
            if (platform === 'discord' && discordUserId) {
                // Para Discord, buscar por vinculación
                const link = await DiscordUserLink.findOne({
                    where: { discord_user_id: discordUserId },
                    include: [{ model: Usuario, as: 'usuario' }]
                });
                usuario = link?.usuario;
                logger.info(`🤖 [BOT-COMMAND] Usuario encontrado por Discord ID:`, usuario ? usuario.nickname : 'no encontrado');
            } else {
                // Para Kick, buscar por user_id_ext
                usuario = await Usuario.findOne({ where: { user_id_ext: username } });
                logger.info(`🤖 [BOT-COMMAND] Usuario encontrado por Kick ID:`, usuario ? usuario.nickname : 'no encontrado');
            }

            // Ejecutar el comando según su tipo
            let response;
            if (command.command_type === 'dynamic') {
                response = await this.executeDynamicCommand(command, content, username, channelName, usuario);
            } else {
                response = await this.executeSimpleCommand(command, content, username, channelName, usuario);
            }

            // Enviar la respuesta si existe
            if (response) {
                await bot.sendMessage(response, messageContext);

                // Incrementar contador de uso
                await command.incrementUsage();

                logger.info(`✅ [BOT-COMMAND] Comando !${command.command} ejecutado exitosamente`);
            }

            return true;
        } catch (error) {
            logger.error('[BOT-COMMAND] Error procesando comando:', error);
            return false;
        }
    }

    /**
     * Ejecuta un comando simple (respuesta estática con variables)
     */
    async executeSimpleCommand(command, content, username, channelName, usuario = null) {
        const args = this.extractArgs(content);

        // Reemplazar variables en el mensaje
        let response = command.response_message
            .replace(/{username}/g, username)
            .replace(/{channel}/g, channelName)
            .replace(/{args}/g, args.join(' '))
            .replace(/{points}/g, usuario ? usuario.puntos.toString() : '0');

        return response;
    }

    /**
     * Ejecuta un comando dinámico (con lógica especial)
     */
    async executeDynamicCommand(command, content, username, channelName, usuario = null) {
        const handler = command.dynamic_handler;

        if (!handler) {
            logger.error(`[BOT-COMMAND] Comando dinámico !${command.command} no tiene handler definido`);
            return null;
        }

        // Ejecutar el handler correspondiente
        switch (handler) {
            case 'puntos_handler':
                return await this.puntosHandler(command, content, username, channelName, usuario);

            // Aquí puedes agregar más handlers según necesites
            // case 'custom_handler':
            //     return await this.customHandler(command, content, username, channelName);

            default:
                logger.error(`[BOT-COMMAND] Handler desconocido: ${handler}`);
                return null;
        }
    }

    /**
     * Handler especial para el comando !puntos
     * Consulta los puntos de un usuario en la base de datos
     */
    async puntosHandler(command, content, username, channelName, usuario = null) {
        try {
            const args = this.extractArgs(content);

            // Si hay argumentos, buscar al usuario especificado
            if (args.length > 0) {
                const lookupName = args[0].replace(/^@/, '');

                // Buscar usuario en la base de datos
                const targetUser = await Usuario.findOne({
                    where: {
                        nickname: { [Op.like]: lookupName }
                    }
                });

                const puntos = targetUser ? Number(targetUser.puntos || 0) : null;

                let response;
                if (puntos !== null) {
                    // Usuario encontrado - usar template del comando
                    response = command.response_message
                        .replace(/{username}/g, username)
                        .replace(/{channel}/g, channelName)
                        .replace(/{target_user}/g, lookupName)
                        .replace(/{points}/g, puntos.toString());
                } else {
                    // Usuario no encontrado - respuesta por defecto
                    response = `${lookupName} no existe o no tiene puntos registrados.`;
                }

                return response;
            } else {
                // No hay argumentos, mostrar puntos del usuario actual
                if (!usuario) {
                    return `No pude encontrar tu información. ¿Estás registrado en la tienda? Regístrate en https://shop.luisardito.com/ para usar comandos de puntos.`;
                }

                const puntos = Number(usuario.puntos || 0);

                // Usar template del comando
                const response = command.response_message
                    .replace(/{username}/g, username)
                    .replace(/{channel}/g, channelName)
                    .replace(/{target_user}/g, usuario.nickname)
                    .replace(/{points}/g, puntos.toString());

                return response;
            }
        } catch (error) {
            logger.error('[BOT-COMMAND] Error en puntosHandler:', error);
            return `Ocurrió un error al verificar los puntos.`;
        }
    }

    /**
     * Extrae los argumentos de un comando
     * Ejemplo: "!comando arg1 arg2" -> ["arg1", "arg2"]
     */
    extractArgs(content) {
        const parts = content.trim().split(/\s+/);
        return parts.slice(1); // Remover el comando mismo
    }

    /**
     * Verifica si un usuario tiene el permiso requerido para ejecutar un comando
     * (Por ahora retorna true, pero puedes implementar lógica de permisos aquí)
     */
    async checkPermission(command, username) {
        if (!command.requires_permission) {
            return true;
        }

        // TODO: Implementar lógica de permisos según tu sistema
        // Por ejemplo, verificar si el usuario es moderador, VIP, etc.

        return true;
    }

    /**
     * Verifica el cooldown de un comando para un usuario
     * (Por ahora retorna true, pero puedes implementar lógica de cooldown aquí)
     */
    async checkCooldown(command, username) {
        if (command.cooldown_seconds === 0) {
            return true;
        }

        // TODO: Implementar lógica de cooldown usando Redis
        // Similar a como se maneja el cooldown en kickWebhook.controller.js

        return true;
    }
}

module.exports = new KickBotCommandHandlerService();
