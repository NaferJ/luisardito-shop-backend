const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Routes } = require('discord-api-types/v9');
const config = require('../../config');
const logger = require('../utils/logger');
const KickBotCommandHandlerService = require('./kickBotCommandHandler.service');

/**
 * Discord bot service
 * Uses the same command logic as the Kick bot
 */
class DiscordBotService {
    constructor() {
        this.client = null;
        this.commandHandler = KickBotCommandHandlerService;
        this.isReady = false;
    }

    /**
     * Initialize and connect the Discord bot
     */
    async initialize() {
        try {
            logger.info('[Discord Bot] Initializing Discord bot...');

            // Check configuration
            if (!config.discord?.botToken) {
                logger.warn('[Discord Bot] DISCORD_BOT_TOKEN not configured, bot disabled');
                return false;
            }

            // Create Discord client
            this.client = new Client({
                intents: [
                    GatewayIntentBits.Guilds,
                    GatewayIntentBits.GuildMessages,
                    GatewayIntentBits.MessageContent,
                ],
            });

            // Event: Bot ready
            this.client.once('ready', () => {
                logger.info(`[Discord Bot] Bot connected as ${this.client.user.tag}`);
                this.isReady = true;
            });

            // Event: Message received
            this.client.on('messageCreate', async (message) => {
                await this.handleMessage(message);
            });

            // Event: Error
            this.client.on('error', (error) => {
                logger.error('[Discord Bot] Error:', error);
            });

            // Connect the bot
            await this.client.login(config.discord.botToken);
            logger.info('[Discord Bot] Bot initialized successfully');

            return true;
        } catch (error) {
            logger.error('[Discord Bot] Error initializing bot:', error);
            return false;
        }
    }

    /**
     * Handle Discord chat messages
     */
    async handleMessage(message) {
        try {
            // Ignore messages from the bot itself
            if (message.author.bot) return;

            // Only process in the configured guild (if specified)
            if (config.discord?.guildId && message.guild?.id !== config.discord.guildId) {
                return;
            }

            const content = message.content.trim();
            const username = message.author.username;
            const channelName = message.guild?.name || 'Discord';

            logger.info(`[Discord Bot] Message from ${username}: ${content}`);

            // Process commands (same system as Kick)
            if (content.startsWith('!')) {
                const commandProcessed = await this.commandHandler.processMessage(
                    content,
                    username,
                    channelName,
                    this, // Pass this as bot service
                    message, // Pass the message as context
                    'discord', // Indicate it comes from Discord
                    message.author.id // Pass the Discord user ID
                );

                if (commandProcessed) {
                    logger.info(`[Discord Bot] Command processed for ${username}`);
                }
            }
        } catch (error) {
            logger.error('[Discord Bot] Error handling message:', error);
        }
    }

    /**
     * Send message to the current channel
     * @param {string|object} content - Message content (string or embed object)
     * @param {object} message - Discord message object (optional)
     */
    async sendMessage(content, message = null) {
        try {
            if (!this.isReady) {
                logger.warn('[Discord Bot] Bot is not ready to send messages');
                return { ok: false, error: 'Bot not ready' };
            }

            // If we have a context message, reply in that channel
            if (message) {
                if (typeof content === 'string') {
                    await message.reply(content);
                } else if (content && typeof content === 'object') {
                    // Check if it is an object with embeds (multiple embeds)
                    if (content.embeds) {
                        await message.reply({ embeds: content.embeds });
                    }
                    // Check if it is an individual embed (backwards compatibility)
                    else if (content.data) {
                        await message.reply({ embeds: [content] });
                    }
                    else {
                        await message.reply(String(content));
                    }
                } else {
                    await message.reply(String(content));
                }
                logger.info(`[Discord Bot] Message sent as reply`);
                return { ok: true };
            }

            // If no context, look for a default channel
            // This requires more configuration, for now just reply
            logger.warn('[Discord Bot] No message context to send reply');
            return { ok: false, error: 'No message context' };

        } catch (error) {
            logger.error('[Discord Bot] Error sending message:', error);
            return { ok: false, error: error.message };
        }
    }

    /**
     * Send message to a specific channel
     * @param {string} channelId - Channel ID
     * @param {string|object} content - Message content (string or embed object)
     */
    async sendMessageToChannel(channelId, content) {
        try {
            if (!this.isReady) {
                return { ok: false, error: 'Bot not ready' };
            }

            const channel = await this.client.channels.fetch(channelId);
            if (channel && channel.isTextBased()) {
                if (typeof content === 'string') {
                    await channel.send(content);
                } else if (content && typeof content === 'object') {
                    // Check if it is an object with embeds (multiple embeds)
                    if (content.embeds) {
                        await channel.send({ embeds: content.embeds });
                    }
                    // Check if it is an individual embed (backwards compatibility)
                    else if (content.data) {
                        await channel.send({ embeds: [content] });
                    }
                    else {
                        await channel.send(String(content));
                    }
                } else {
                    await channel.send(String(content));
                }
                logger.info(`[Discord Bot] Message sent to channel ${channelId}`);
                return { ok: true };
            } else {
                return { ok: false, error: 'Invalid channel' };
            }
        } catch (error) {
            logger.error('[Discord Bot] Error sending message to channel:', error);
            return { ok: false, error: error.message };
        }
    }

    /**
     * Disconnect the bot
     */
    async disconnect() {
        if (this.client) {
            await this.client.destroy();
            this.isReady = false;
            logger.info('[Discord Bot] Bot disconnected');
        }
    }

    /**
     * Check if the bot is ready
     */
    isBotReady() {
        return this.isReady;
    }
}

// Export both the class and a singleton instance
const instance = new DiscordBotService();
module.exports = instance;
module.exports.DiscordBotService = DiscordBotService;
module.exports.default = instance;
