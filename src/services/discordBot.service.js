const { Client, GatewayIntentBits, REST } = require('discord.js');
const { Routes } = require('discord-api-types/v9');
const config = require('../../config');
const logger = require('../utils/logger');
const KickBotCommandHandlerService = require('./kickBotCommandHandler.service');

/**
 * Servicio para el bot de Discord
 * Usa la misma lógica de comandos que el bot de Kick
 */
class DiscordBotService {
    constructor() {
        this.client = null;
        this.commandHandler = KickBotCommandHandlerService;
        this.isReady = false;
    }

    /**
     * Inicializar y conectar el bot de Discord
     */
    async initialize() {
        try {
            logger.info('[Discord Bot] 🚀 Inicializando bot de Discord...');

            // Verificar configuración
            if (!config.discord?.botToken) {
                logger.warn('[Discord Bot] ⚠️ DISCORD_BOT_TOKEN no configurado, bot desactivado');
                return false;
            }

            // Crear cliente de Discord
            this.client = new Client({
                intents: [
                    GatewayIntentBits.Guilds,
                    GatewayIntentBits.GuildMessages,
                    GatewayIntentBits.MessageContent,
                ],
            });

            // Evento: Bot listo
            this.client.once('ready', () => {
                logger.info(`[Discord Bot] ✅ Bot conectado como ${this.client.user.tag}`);
                this.isReady = true;
            });

            // Evento: Mensaje recibido
            this.client.on('messageCreate', async (message) => {
                await this.handleMessage(message);
            });

            // Evento: Error
            this.client.on('error', (error) => {
                logger.error('[Discord Bot] ❌ Error:', error);
            });

            // Conectar el bot
            await this.client.login(config.discord.botToken);
            logger.info('[Discord Bot] 🎉 Bot inicializado exitosamente');

            return true;
        } catch (error) {
            logger.error('[Discord Bot] ❌ Error inicializando bot:', error);
            return false;
        }
    }

    /**
     * Manejar mensajes del chat de Discord
     */
    async handleMessage(message) {
        try {
            // Ignorar mensajes del bot mismo
            if (message.author.bot) return;

            // Solo procesar en el servidor configurado (si está especificado)
            if (config.discord?.guildId && message.guild?.id !== config.discord.guildId) {
                return;
            }

            const content = message.content.trim();
            const username = message.author.username;
            const channelName = message.guild?.name || 'Discord';

            logger.info(`[Discord Bot] 📨 Mensaje de ${username}: ${content}`);

            // Procesar comandos (mismo sistema que Kick)
            if (content.startsWith('!')) {
                const commandProcessed = await this.commandHandler.processMessage(
                    content,
                    username,
                    channelName,
                    this, // Pasar this como bot service
                    message // Pasar el mensaje como contexto
                );

                if (commandProcessed) {
                    logger.info(`[Discord Bot] ✅ Comando procesado para ${username}`);
                }
            }
        } catch (error) {
            logger.error('[Discord Bot] ❌ Error manejando mensaje:', error);
        }
    }

    /**
     * Enviar mensaje al canal actual
     * @param {string} content - Contenido del mensaje
     * @param {object} message - Objeto de mensaje de Discord (opcional)
     */
    async sendMessage(content, message = null) {
        try {
            if (!this.isReady) {
                logger.warn('[Discord Bot] ⚠️ Bot no está listo para enviar mensajes');
                return { ok: false, error: 'Bot not ready' };
            }

            // Si tenemos un mensaje de contexto, responder en ese canal
            if (message) {
                await message.reply(content);
                logger.info(`[Discord Bot] 📤 Mensaje enviado como respuesta`);
                return { ok: true };
            }

            // Si no hay contexto, buscar un canal por defecto
            // Esto requiere más configuración, por ahora solo responder
            logger.warn('[Discord Bot] ⚠️ No hay contexto de mensaje para enviar respuesta');
            return { ok: false, error: 'No message context' };

        } catch (error) {
            logger.error('[Discord Bot] ❌ Error enviando mensaje:', error);
            return { ok: false, error: error.message };
        }
    }

    /**
     * Enviar mensaje a un canal específico
     * @param {string} channelId - ID del canal
     * @param {string} content - Contenido del mensaje
     */
    async sendMessageToChannel(channelId, content) {
        try {
            if (!this.isReady) {
                return { ok: false, error: 'Bot not ready' };
            }

            const channel = await this.client.channels.fetch(channelId);
            if (channel && channel.isTextBased()) {
                await channel.send(content);
                logger.info(`[Discord Bot] 📤 Mensaje enviado a canal ${channelId}`);
                return { ok: true };
            } else {
                return { ok: false, error: 'Invalid channel' };
            }
        } catch (error) {
            logger.error('[Discord Bot] ❌ Error enviando mensaje a canal:', error);
            return { ok: false, error: error.message };
        }
    }

    /**
     * Desconectar el bot
     */
    async disconnect() {
        if (this.client) {
            await this.client.destroy();
            this.isReady = false;
            logger.info('[Discord Bot] 👋 Bot desconectado');
        }
    }

    /**
     * Verificar si el bot está listo
     */
    isBotReady() {
        return this.isReady;
    }
}

module.exports = new DiscordBotService();