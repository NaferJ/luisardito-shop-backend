const { KickBotCommand, Usuario, DiscordUserLink } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('sequelize');
const logger = require('../utils/logger');

// Importar EmbedBuilder solo si discord.js está disponible
let EmbedBuilder;
try {
    EmbedBuilder = require('discord.js').EmbedBuilder;
} catch (error) {
    // discord.js no está disponible (ej. en entorno Kick)
    EmbedBuilder = null;
}

// Importar axios para llamadas HTTP
const axios = require('axios');

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
                // Comando especial !discord para Discord - generar embed directamente
                if (platform === 'discord' && content.trim() === '!discord') {
                    logger.info(`🤖 [BOT-COMMAND] Comando especial !discord detectado en Discord (no existe en DB), generando embed`);
                    const embedResult = await this.createDiscordEmbed();
                    await bot.sendMessage(embedResult, messageContext);
                    return true;
                }

                // No es un comando registrado
                return false;
            }

            logger.info(`🤖 [BOT-COMMAND] Ejecutando comando: !${command.command} por ${username} (${platform}) - Tipo: ${command.command_type}`);

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
                response = await this.executeDynamicCommand(command, content, username, channelName, usuario, platform, discordUserId, messageContext);
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
    async executeSimpleCommand(command, content, username, channelName, usuario = null, platform = 'kick') {
        const args = this.extractArgs(content);

        // Comando especial !discord con embed elegante para Discord
        if (command.command === 'discord' && platform === 'discord') {
            logger.info(`🤖 [BOT-COMMAND] Generando embed para !discord desde executeSimpleCommand`);
            return await this.createDiscordEmbed();
        }

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
    async executeDynamicCommand(command, content, username, channelName, usuario = null, platform = 'kick', discordUserId = null, messageContext = null) {
        const handler = command.dynamic_handler;

        if (!handler) {
            logger.error(`[BOT-COMMAND] Comando dinámico !${command.command} no tiene handler definido`);
            return null;
        }

        // Ejecutar el handler correspondiente
        switch (handler) {
            case 'puntos_handler':
                return await this.puntosHandler(command, content, username, channelName, usuario, platform, discordUserId, messageContext);

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
    async puntosHandler(command, content, username, channelName, usuario = null, platform = 'kick', discordUserId = null, messageContext = null) {
        try {
            const args = this.extractArgs(content);

            // Si hay argumentos, buscar al usuario especificado
            if (args.length > 0) {
                const lookupArg = args[0];

                let targetUser = null;

                // Lógica específica para Discord: detectar menciones
                if (platform === 'discord' && messageContext && lookupArg.match(/^<@!?(\d+)>$/)) {
                    const mentionedUserId = lookupArg.match(/^<@!?(\d+)>$/)[1];
                    logger.info(`[BOT-COMMAND] Buscando usuario por mención Discord: ${mentionedUserId}`);

                    // Buscar en DiscordUserLink
                    const discordLink = await DiscordUserLink.findOne({
                        where: { discord_user_id: mentionedUserId },
                        include: [{ model: Usuario, as: 'usuario' }]
                    });

                    targetUser = discordLink?.usuario;
                    logger.info(`[BOT-COMMAND] Usuario encontrado por Discord ID:`, targetUser ? targetUser.nickname : 'no encontrado');
                } else {
                    // Lógica para Kick y Discord (búsqueda por nickname)
                    const lookupName = lookupArg.replace(/^@/, '');
                    logger.info(`[BOT-COMMAND] Buscando usuario por nickname: ${lookupName}`);

                    // Para MySQL, usar LOWER() para case insensitive
                    targetUser = await Usuario.findOne({
                        where: sequelize.where(
                            sequelize.fn('LOWER', sequelize.col('nickname')),
                            sequelize.fn('LOWER', lookupName)
                        )
                    });

                    logger.info(`[BOT-COMMAND] Usuario encontrado por nickname:`, targetUser ? targetUser.nickname : 'no encontrado');
                }

                const puntos = targetUser ? Number(targetUser.puntos || 0) : null;

                let response;
                if (puntos !== null) {
                    // Usuario encontrado - usar template del comando
                    const displayName = targetUser.nickname;
                    response = command.response_message
                        .replace(/{username}/g, username)
                        .replace(/{channel}/g, channelName)
                        .replace(/{target_user}/g, displayName)
                        .replace(/{points}/g, puntos.toString());
                } else {
                    // Usuario no encontrado - respuesta por defecto
                    let displayName = lookupArg.replace(/^@/, '');
                    if (lookupArg.match(/^<@!?(\d+)>/)) {
                        displayName = 'usuario mencionado';
                    }
                    response = `${displayName} no existe o no tiene puntos registrados.`;
                }

                return response;
            } else {
                // No hay argumentos, mostrar puntos del usuario actual
                if (!usuario) {
                    if (platform === 'discord') {
                        return `No pude encontrar tu información. ¿Has vinculado tu cuenta de Discord? Vincúlala en https://shop.luisardito.com/perfil para usar comandos de puntos.`;
                    } else {
                        return `No pude encontrar tu información. ¿Estás registrado en la tienda? Regístrate en https://shop.luisardito.com/ para usar comandos de puntos.`;
                    }
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

    /**
     * Crea un embed elegante para el comando !discord
     */
    async createDiscordEmbed() {
        if (!EmbedBuilder) {
            // Fallback si discord.js no está disponible
            return 'POXY CLUB\nUnite: https://discord.gg/arsANX7aWt\n\nComunidad de gaming, anime y streams\nPlataformas: Kick, Twitch, YouTube\nMiembros: > 1.2K\n\nEnlace directo: https://discord.gg/arsANX7aWt';
        }

        // Obtener la URL del banner
        const bannerUrl = this.getBannerUrl();

        // EMBED 1: Solo el banner (ancho completo, arriba)
        const bannerEmbed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setImage(bannerUrl);

        // EMBED 2: El contenido (abajo)
        const contentEmbed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('POXY CLUB')
            .setURL('https://discord.gg/arsANX7aWt')
            .setDescription('¡Saludos a todos! Únete a la comunidad de gaming, anime y streams en Discord.\n\n**Beneficios:**')
            .addFields(
                { name: '🎮 Gaming', value: 'Eventos y torneos', inline: true },
                { name: '📺 Streams', value: 'Transmisiones en vivo', inline: true },
                { name: '🎬 Contenido', value: 'Anime y clips', inline: true }
            )
            .setFooter({ text: '🥇 Participante | 🧢 Coach' })
            .setTimestamp();

        return { embeds: [bannerEmbed, contentEmbed] }; // 👈 Devuelve objeto con array de embeds
    }

    /**
     * Obtiene información dinámica del servidor de Discord
     */
    async getDiscordServerInfo() {
        try {
            const config = require('../../config');

            // Si no hay configuración de Discord, devolver valores por defecto
            if (!config.discord?.botToken || !config.discord?.guildId) {
                logger.warn('[DISCORD-API] Configuración de Discord incompleta:', {
                    hasToken: !!config.discord?.botToken,
                    hasGuildId: !!config.discord?.guildId
                });
                return { memberCount: '> 1.2K' };
            }

            logger.info('[DISCORD-API] Consultando información del servidor Discord...');

            // Hacer llamada a la API de Discord
            const response = await axios.get(
                `https://discord.com/api/guilds/${config.discord.guildId}`,
                {
                    headers: {
                        'Authorization': `Bot ${config.discord.botToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const guildData = response.data;
            logger.info('[DISCORD-API] Información obtenida:', {
                name: guildData.name,
                memberCount: guildData.approximate_member_count
            });

            return {
                memberCount: guildData.approximate_member_count ?
                    this.formatMemberCount(guildData.approximate_member_count) :
                    '> 1.2K',
                name: guildData.name || 'POXY CLUB',
                description: guildData.description || ''
            };

        } catch (error) {
            logger.error('[DISCORD-API] Error obteniendo información del servidor:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
            // En caso de error, devolver valores por defecto
            return { memberCount: '> 1.2K' };
        }
    }

    /**
     * Obtiene la URL del banner para el embed
     */
    getBannerUrl() {
        const config = require('../../config');

        // En producción, usar URL externa si está configurada
        if (process.env.NODE_ENV === 'production' && process.env.DISCORD_BANNER_URL) {
            return process.env.DISCORD_BANNER_URL;
        }

        // Usar URL de Cloudinary si está configurada
        if (process.env.DISCORD_BANNER_URL) {
            return process.env.DISCORD_BANNER_URL;
        }

        // Banner por defecto subido a Cloudinary
        return 'https://res.cloudinary.com/naferj/image/upload/v1765492099/discordbanner_jjgpko.jpg';
    }

    /**
     * Formatea el conteo de miembros de manera legible
     */
    formatMemberCount(count) {
        if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K`;
        }
        return count.toString();
    }
}

module.exports = new KickBotCommandHandlerService();
