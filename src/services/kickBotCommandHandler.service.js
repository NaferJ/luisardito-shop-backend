const { KickBotCommand, Usuario, DiscordUserLink, UserWatchtime } = require('../models');
const sequelize = require('sequelize');
const logger = require('../utils/logger');
const formatWatchtime = require('../utils/formatWatchtime');

// Import EmbedBuilder only if discord.js is available
let EmbedBuilder;
try {
    EmbedBuilder = require('discord.js').EmbedBuilder;
} catch (_error) {
    // discord.js is not available (e.g. in Kick environment)
    EmbedBuilder = null;
}

// Import axios for HTTP calls
const axios = require('axios');

/**
 * ==========================================
 * BOT COMMAND HANDLER SERVICE
 * ==========================================
 * This service handles the dynamic execution of commands
 * configured in the database
 */

class KickBotCommandHandlerService {
    /**
     * Processes a chat message to detect and execute commands
     * @param {string} message - Chat message
     * @param {string} username - User who sent the message
     * @param {string} channelName - Channel name
     * @param {object} bot - Bot service instance
     * @param {object} messageContext - Message context (for Discord)
     * @param {string} platform - Platform: 'kick' or 'discord'
     * @param {string} discordUserId - Discord user ID (Discord only)
     * @param {string} displayName - User display name on Kick
     * @returns {Promise<boolean>} - True if a command was processed, false otherwise
     */
    async processMessage(message, username, channelName, bot, messageContext = null, platform = 'kick', discordUserId = null, displayName = null) {
        try {
            const content = String(message || '').trim();

            // Check if it is a command (starts with !)
            if (!content.startsWith('!')) {
                return false;
            }

            // Look up the command in the database
            const command = await KickBotCommand.findByCommand(content);

            if (!command) {
                // Special !discord command for Discord - generate embed directly
                if (platform === 'discord' && content.trim() === '!discord') {
                    logger.info(`[BOT-COMMAND] Special !discord command detected in Discord (not in DB), generating embed`);
                    const embedResult = await this.createDiscordEmbed();
                    await bot.sendMessage(embedResult, messageContext);
                    return true;
                }

                // Not a registered command
                return false;
            }

            logger.info(`[BOT-COMMAND] Executing command: !${command.command} by ${username} (${platform}) - Type: ${command.command_type}`);

            // Find the user in the database
            let usuario = null;
            if (platform === 'discord' && discordUserId) {
                // For Discord, look up by link
                const link = await DiscordUserLink.findOne({
                    where: { discord_user_id: discordUserId },
                    include: [{ model: Usuario, as: 'usuario' }]
                });
                usuario = link?.usuario;
                logger.info(`[BOT-COMMAND] User found by Discord ID:`, usuario ? usuario.nickname : 'not found');
            } else {
                // For Kick, look up by user_id_ext
                usuario = await Usuario.findOne({ where: { user_id_ext: username } });
                logger.info(`[BOT-COMMAND] User found by Kick ID:`, usuario ? usuario.nickname : 'not found');
            }

            // Check cooldown
            if (!(await this.checkCooldown(command, username))) {
                logger.info(`[BOT-COMMAND] Command !${command.command} on cooldown for ${username}`);
                return false;
            }

            // Execute the command based on its type
            let response;
            if (command.command_type === 'dynamic') {
                response = await this.executeDynamicCommand(command, content, username, channelName, usuario, platform, discordUserId, messageContext, displayName);
            } else {
                response = await this.executeSimpleCommand(command, content, username, channelName, usuario);
            }

            // Send the response if any
            if (response) {
                await bot.sendMessage(response, messageContext);

                // Increment usage counter
                await command.incrementUsage();

                logger.info(`[BOT-COMMAND] Command !${command.command} executed successfully`);
            }

            return true;
        } catch (error) {
            logger.error('[BOT-COMMAND] Error processing command:', error);
            return false;
        }
    }

    /**
     * Executes a simple command (static response with variables)
     */
    async executeSimpleCommand(command, content, username, channelName, usuario = null, platform = 'kick') {
        const args = this.extractArgs(content);

        // Special !discord command with elegant embed for Discord
        if (command.command === 'discord' && platform === 'discord') {
            logger.info(`[BOT-COMMAND] Generating embed for !discord from executeSimpleCommand`);
            return await this.createDiscordEmbed();
        }

        // Replace variables in the message
        let response = command.response_message
            .replace(/{username}/g, username)
            .replace(/{channel}/g, channelName)
            .replace(/{args}/g, args.join(' '))
            .replace(/{points}/g, usuario ? usuario.puntos.toString() : '0');

        return response;
    }

    /**
     * Executes a dynamic command (with special logic)
     */
    async executeDynamicCommand(command, content, username, channelName, usuario = null, platform = 'kick', discordUserId = null, messageContext = null, displayName = null) {
        const handler = command.dynamic_handler;

        if (!handler) {
            logger.error(`[BOT-COMMAND] Dynamic command !${command.command} has no handler defined`);
            return null;
        }

        // Execute the corresponding handler
        switch (handler) {
            case 'puntos_handler':
                return await this.puntosHandler(command, content, username, channelName, usuario, platform, discordUserId, messageContext, displayName);

            case 'watchtime_handler':
                return await this.watchtimeHandler(command, content, username, channelName, usuario, platform, discordUserId, messageContext, displayName);

            // More handlers can be added here as needed
            // case 'custom_handler':
            //     return await this.customHandler(command, content, username, channelName);

            default:
                logger.error(`[BOT-COMMAND] Unknown handler: ${handler}`);
                return null;
        }
    }

    /**
     * Special handler for the !puntos command
     * Looks up a user's points in the database
     */
    async puntosHandler(command, content, username, channelName, usuario = null, platform = 'kick', _discordUserId = null, messageContext = null, displayName = null) {
        try {
            const args = this.extractArgs(content);

            // If there are arguments, look up the specified user
            if (args.length > 0) {
                const lookupArg = args[0];

                let targetUser = null;

                // Discord-specific logic: detect mentions
                if (platform === 'discord' && messageContext && lookupArg.match(/^<@!?(\d+)>$/)) {
                    const mentionedUserId = lookupArg.match(/^<@!?(\d+)>$/)[1];
                    logger.info(`[BOT-COMMAND] Looking up user by Discord mention: ${mentionedUserId}`);

                    // Look up in DiscordUserLink
                    const discordLink = await DiscordUserLink.findOne({
                        where: { discord_user_id: mentionedUserId },
                        include: [{ model: Usuario, as: 'usuario' }]
                    });

                    targetUser = discordLink?.usuario;
                    logger.info(`[BOT-COMMAND] User found by Discord ID:`, targetUser ? targetUser.nickname : 'not found');
                } else {
                    // Logic for Kick and Discord (lookup by nickname)
                    const lookupName = lookupArg.replace(/^@/, '');
                    logger.info(`[BOT-COMMAND] Looking up user by nickname: ${lookupName}`);

                    // For MySQL, use LOWER() for case insensitive
                    targetUser = await Usuario.findOne({
                        where: sequelize.where(
                            sequelize.fn('LOWER', sequelize.col('nickname')),
                            sequelize.fn('LOWER', lookupName)
                        )
                    });

                    logger.info(`[BOT-COMMAND] User found by nickname:`, targetUser ? targetUser.nickname : 'not found');
                }

                const puntos = targetUser ? Number(targetUser.puntos || 0) : null;

                let response;
                if (puntos !== null) {
                    // User found - use command template
                    const displayName = targetUser.nickname;
                    response = command.response_message
                        .replace(/{username}/g, username)
                        .replace(/{channel}/g, channelName)
                        .replace(/{target_user}/g, displayName)
                        .replace(/{points}/g, puntos.toString());
                } else {
                    // User not found - default response
                    let displayName = lookupArg.replace(/^@/, '');
                    if (lookupArg.match(/^<@!?(\d+)>/)) {
                        displayName = 'mentioned user';
                    }
                    response = `${displayName} does not exist or has no registered points.`;
                }

                return response;
            } else {
                // No arguments, show current user's points
                if (!usuario) {
                    if (platform === 'discord') {
                        return `@${username} Could not find your information. Have you linked your Discord account? Link it at https://shop.luisardito.com/perfil to use points commands.`;
                    } else {
                        if (displayName) {
                            return `@${displayName} Could not find your information. Are you registered in the store? Register at https://shop.luisardito.com/ to use points commands.`;
                        } else {
                            return `Could not find your information. Are you registered in the store? Register at https://shop.luisardito.com/ to use points commands.`;
                        }
                    }
                }

                const puntos = Number(usuario.puntos || 0);

                // Use command template
                const response = command.response_message
                    .replace(/{username}/g, username)
                    .replace(/{channel}/g, channelName)
                    .replace(/{target_user}/g, usuario.nickname)
                    .replace(/{points}/g, puntos.toString());

                return response;
            }
        } catch (error) {
            logger.error('[BOT-COMMAND] Error in puntosHandler:', error);
            return `An error occurred while checking points.`;
        }
    }

    /**
     * Special handler for the !watchtime command
     * Looks up a user's watchtime in the database
     */
    async watchtimeHandler(command, content, username, channelName, usuario = null, platform = 'kick', _discordUserId = null, messageContext = null, displayName = null) {
        try {
            const args = this.extractArgs(content);

            // If there are arguments, look up the specified user
            if (args.length > 0) {
                const lookupArg = args[0];

                let targetUser = null;

                // Discord-specific logic: detect mentions
                if (platform === 'discord' && messageContext && lookupArg.match(/^<@!?(\d+)>$/)) {
                    const mentionedUserId = lookupArg.match(/^<@!?(\d+)>$/)[1];
                    logger.info(`[BOT-COMMAND] Looking up user by Discord mention: ${mentionedUserId}`);

                    // Look up in DiscordUserLink
                    const discordLink = await DiscordUserLink.findOne({
                        where: { discord_user_id: mentionedUserId },
                        include: [{ model: Usuario, as: 'usuario' }]
                    });

                    targetUser = discordLink?.usuario;
                    logger.info(`[BOT-COMMAND] User found by Discord ID:`, targetUser ? targetUser.nickname : 'not found');
                } else {
                    // Logic for Kick and Discord (lookup by nickname)
                    const lookupName = lookupArg.replace(/^@/, '');
                    logger.info(`[BOT-COMMAND] Looking up user by nickname: ${lookupName}`);

                    // For MySQL, use LOWER() for case insensitive
                    targetUser = await Usuario.findOne({
                        where: sequelize.where(
                            sequelize.fn('LOWER', sequelize.col('nickname')),
                            sequelize.fn('LOWER', lookupName)
                        ),
                        include: [{ model: UserWatchtime, required: false }]
                    });

                    logger.info(`[BOT-COMMAND] User found by nickname:`, targetUser ? targetUser.nickname : 'not found');
                }

                let response;
                if (targetUser) {
                    // Get user watchtime
                    const userWatchtime = targetUser.UserWatchtime;
                    const watchtimeMinutes = userWatchtime ? userWatchtime.total_watchtime_minutes : 0;
                    const formattedWatchtime = formatWatchtime(watchtimeMinutes);

                    // User found - use command template
                    const displayNameTarget = targetUser.nickname;
                    response = command.response_message
                        .replace(/{username}/g, username)
                        .replace(/{channel}/g, channelName)
                        .replace(/{target_user}/g, displayNameTarget)
                        .replace(/{watchtime}/g, formattedWatchtime);
                } else {
                    // User not found - default response
                    let displayNameLookup = lookupArg.replace(/^@/, '');
                    if (lookupArg.match(/^<@!?(\d+)>/)) {
                        displayNameLookup = 'mentioned user';
                    }
                    response = `${displayNameLookup} does not exist or has no registered watchtime.`;
                }

                return response;
            } else {
                // No arguments, show current user's watchtime
                if (!usuario) {
                    if (platform === 'discord') {
                        return `@${username} Could not find your information. Have you linked your Discord account? Link it at https://shop.luisardito.com/perfil to use watchtime commands.`;
                    } else {
                        if (displayName) {
                            return `@${displayName} Could not find your information. Are you registered in the store? Register at https://shop.luisardito.com/ to use watchtime commands.`;
                        } else {
                            return `Could not find your information. Are you registered in the store? Register at https://shop.luisardito.com/ to use watchtime commands.`;
                        }
                    }
                }

                // Get user watchtime
                const userWatchtime = await UserWatchtime.findOne({
                    where: { usuario_id: usuario.id }
                });
                const watchtimeMinutes = userWatchtime ? userWatchtime.total_watchtime_minutes : 0;
                const formattedWatchtime = formatWatchtime(watchtimeMinutes);

                // Use command template
                const response = command.response_message
                    .replace(/{username}/g, username)
                    .replace(/{channel}/g, channelName)
                    .replace(/{target_user}/g, usuario.nickname)
                    .replace(/{watchtime}/g, formattedWatchtime);

                return response;
            }
        } catch (error) {
            logger.error('[BOT-COMMAND] Error in watchtimeHandler:', error);
            return `An error occurred while checking watchtime.`;
        }
    }

    /**
     * Extracts arguments from a command
     * Example: command arg1 arg2 returns array with arguments
     */
    extractArgs(content) {
        const parts = content.trim().split(/\s+/);
        return parts.slice(1); // Remove the command itself
    }

    /**
     * Checks if a user has the required permission to execute a command
     * (Currently returns true, but permission logic can be implemented here)
     */
    async checkPermission(command, _username) {
        if (!command.requires_permission) {
            return true;
        }

        // TODO: Implement permission logic according to your system
        // For example, check if the user is a moderator, VIP, etc.

        return true;
    }

    /**
     * Checks the cooldown of a command for a user
     * (Currently returns true, but cooldown logic can be implemented here)
     */
    async checkCooldown(command, username) {
        if (command.cooldown_seconds === 0) {
            return true;
        }

        const { getRedisClient } = require("../config/redis.config");
        const redis = getRedisClient();

        const key = `bot_command_cooldown:${command.command}:${username}`;

        // Check if the user is on cooldown for this command
        const exists = await redis.exists(key);
        if (exists) {
            return false; // On cooldown
        }

        // Set cooldown with TTL
        await redis.setex(key, command.cooldown_seconds, Date.now().toString());
        return true;
    }

    /**
     * Creates an elegant embed for the !discord command
     */
    async createDiscordEmbed() {
        if (!EmbedBuilder) {
            // Fallback if discord.js is not available
            return 'POXY CLUB\nJoin: https://discord.gg/arsANX7aWt\n\nGaming, anime and streams community\nPlatforms: Kick, Twitch, YouTube\nMembers: > 1.2K\n\nDirect link: https://discord.gg/arsANX7aWt';
        }

        // Get the banner URL
        const bannerUrl = this.getBannerUrl();

        // EMBED 1: Just the banner (full width, top)
        const bannerEmbed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setImage(bannerUrl);

        // EMBED 2: The content (bottom)
        const contentEmbed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('POXY CLUB')
            .setURL('https://discord.gg/arsANX7aWt')
            .setDescription('Greetings everyone! Join the gaming, anime and streams community on Discord.\n\n**Benefits:**')
            .addFields(
                { name: 'Gaming', value: 'Events and tournaments', inline: true },
                { name: 'Streams', value: 'Live broadcasts', inline: true },
                { name: 'Content', value: 'Anime and clips', inline: true }
            )
            .setFooter({ text: 'Participant | Coach' })
            .setTimestamp();

        return { embeds: [bannerEmbed, contentEmbed] }; // Returns object with array of embeds
    }

    /**
     * Gets dynamic Discord server info
     */
    async getDiscordServerInfo() {
        try {
            const config = require('../../config');

            // If there is no Discord configuration, return default values
            if (!config.discord?.botToken || !config.discord?.guildId) {
                logger.warn('[DISCORD-API] Incomplete Discord configuration:', {
                    hasToken: !!config.discord?.botToken,
                    hasGuildId: !!config.discord?.guildId
                });
                return { memberCount: '> 1.2K' };
            }

            logger.info('[DISCORD-API] Querying Discord server info...');

            // Make Discord API call
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
            logger.info('[DISCORD-API] Info retrieved:', {
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
            logger.error('[DISCORD-API] Error getting server info:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
            // On error, return default values
            return { memberCount: '> 1.2K' };
        }
    }

    /**
     * Gets the banner URL for the embed
     */
    getBannerUrl() {

        // In production, use external URL if configured
        if (process.env.NODE_ENV === 'production' && process.env.DISCORD_BANNER_URL) {
            return process.env.DISCORD_BANNER_URL;
        }

        // Use Cloudinary URL if configured
        if (process.env.DISCORD_BANNER_URL) {
            return process.env.DISCORD_BANNER_URL;
        }

        // Default banner uploaded to Cloudinary
        return 'https://res.cloudinary.com/naferj/image/upload/v1765492099/discordbanner_jjgpko.jpg';
    }

    /**
     * Formats the member count in a readable way
     */
    formatMemberCount(count) {
        if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K`;
        }
        return count.toString();
    }
}

module.exports = new KickBotCommandHandlerService();
