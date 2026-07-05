const { KickBotCommand } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const kickBotService = require('./kickBot.service'); // Import the singleton instance

/**
 * Service for automatic sending of Kick bot commands
 * Periodically checks commands with auto_send_interval_seconds > 0
 * and sends them automatically to the Kick chat
 * NOTE: This system is exclusive to Kick, it does NOT send to Discord
 */
class KickBotAutoSendService {
    constructor() {
        this.kickBotService = kickBotService; // Use the singleton instance
        this.intervalId = null;
        this.isRunning = false;
        this.checkInterval = 10000; // Check every 10 seconds
    }

    /**
     * Starts the auto-send service
     */
    start() {
        if (this.isRunning) {
            logger.info('[AUTO-SEND] Service is already running');
            return;
        }

        logger.info('[AUTO-SEND] Starting automatic command sending service');
        this.isRunning = true;

        // Run immediately the first time
        this.checkAndSendCommands();

        // Configure periodic interval
        this.intervalId = setInterval(() => {
            this.checkAndSendCommands();
        }, this.checkInterval);
    }

    /**
     * Stops the auto-send service
     */
    stop() {
        if (!this.isRunning) {
            logger.info('[AUTO-SEND] Service is already stopped');
            return;
        }

        logger.info('[AUTO-SEND] Stopping automatic command sending service');
        this.isRunning = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Checks and sends commands automatically
     */
    async checkAndSendCommands() {
        try {
            // Get commands with auto-send enabled
            const autoSendCommands = await KickBotCommand.findAll({
                where: {
                    enabled: true,
                    auto_send_interval_seconds: {
                        [Op.gt]: 0
                    }
                }
            });

            if (autoSendCommands.length === 0) {
                return; // No commands to send automatically
            }

            const now = new Date();

            for (const command of autoSendCommands) {
                try {
                    // Check if it is time to send this command
                    if (await this.shouldSendCommand(command, now)) {
                        await this.sendCommand(command);
                        // Update last sent
                        command.last_used_at = now;
                        await command.save();
                    }
                } catch (error) {
                    logger.error(`[AUTO-SEND] Error processing command ${command.command}:`, error);
                }
            }
        } catch (error) {
            logger.error('[AUTO-SEND] Error in checkAndSendCommands:', error);
        }
    }

    /**
     * Checks if a command should be sent at this time
     */
    async shouldSendCommand(command, now) {
        if (!command.last_used_at) {
            // Never sent, send now
            return true;
        }

        const timeSinceLastSend = now - command.last_used_at;
        const intervalMs = command.auto_send_interval_seconds * 1000;

        return timeSinceLastSend >= intervalMs;
    }

    /**
     * Sends a command automatically
     */
    async sendCommand(command) {
        try {
            logger.info(`[AUTO-SEND] Sending automatic command: !${command.command}`);

            let response;

            if (command.command_type === 'dynamic') {
                // For dynamic commands, we need to simulate the context
                // Use the corresponding handler
                const handler = command.dynamic_handler;
                if (handler === 'puntos_handler') {
                    // For puntos_handler, we need a user. Use a generic message
                    response = 'Remember you can check your points with !puntos!';
                } else {
                    // For other handlers, use the simple message
                    response = command.response_message;
                }
            } else {
                // Simple command: replace variables with default values
                response = command.response_message
                    .replace(/{username}/g, 'System')
                    .replace(/{channel}/g, 'luisardito')
                    .replace(/{args}/g, '')
                    .replace(/{target_user}/g, 'everyone')
                    .replace(/{points}/g, '0');
            }

            if (response) {
                // Send ONLY to Kick (auto-send is exclusive to the Kick bot)
                const kickResult = await this.kickBotService.sendMessage(response);
                if (kickResult.ok) {
                    logger.info(`[AUTO-SEND] Command sent to Kick: !${command.command}`);
                } else {
                    logger.error(`[AUTO-SEND] Error sending to Kick: ${kickResult.error}`);
                }


                // Increment usage counter
                await command.incrementUsage();
            }
        } catch (error) {
            logger.error(`[AUTO-SEND] Error sending command ${command.command}:`, error);
        }
    }

    /**
     * Gets the service status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            checkInterval: this.checkInterval,
            nextCheckIn: this.intervalId ? 'Next check shortly' : 'Service stopped'
        };
    }
}

module.exports = new KickBotAutoSendService();
