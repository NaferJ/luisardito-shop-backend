import {
  KickBotCommand,
  Usuario,
  DiscordUserLink,
  UserWatchtime,
} from "../models";
import sequelize from "sequelize";
import logger from "../utils/logger";
import formatWatchtime from "../utils/formatWatchtime";
import { getRedisClient } from "../config/redis.config";
import type { Includeable, WhereOptions } from "sequelize";

/**
 * ==========================================
 * BOT COMMAND HANDLER SERVICE
 * ==========================================
 * This service handles the dynamic execution of commands
 * configured in the database
 */

interface BotService {
  sendMessage: (message: string, context?: unknown) => Promise<unknown>;
}

interface CommandContext {
  messageContext?: unknown;
  platform?: string;
  discordUserId?: string | null;
  displayName?: string | null;
}

interface DynamicContext {
  username: string;
  channelName: string;
  usuario: Usuario | null;
  messageContext: unknown;
  platform: string;
  discordUserId: string | null;
  displayName: string | null;
}

type UsuarioWithWatchtime = Usuario & { UserWatchtime?: UserWatchtime };

class KickBotCommandHandlerService {
  /**
   * Processes a chat message to detect and execute commands
   * @param message - Chat message
   * @param username - User who sent the message
   * @param channelName - Channel name
   * @param bot - Bot service instance
   * @param ctx - Context object with messageContext, platform, discordUserId, displayName
   * @returns True if a command was processed, false otherwise
   */
  async processMessage(
    message: string,
    username: string,
    channelName: string,
    bot: BotService,
    ctx: CommandContext = {}
  ): Promise<boolean> {
    const {
      messageContext = null,
      platform = "kick",
      discordUserId = null,
      displayName = null,
    } = ctx || {};

    try {
      const content = String(message || "").trim();

      // Check if it is a command (starts with !)
      if (!content.startsWith("!")) {
        return false;
      }

      // Look up the command in the database
      const command = await KickBotCommand.findByCommand(content);

      if (!command) {
        // Not a registered command
        return false;
      }

      logger.info(
        `[BOT-COMMAND] Executing command: !${command.command} by ${username} (${platform}) - Type: ${command.command_type}`
      );

      // Find the user in the database
      const usuario = await this.findUser(platform, discordUserId, username);

      // Check cooldown
      if (!(await this.checkCooldown(command, username))) {
        logger.info(
          `[BOT-COMMAND] Command !${command.command} on cooldown for ${username}`
        );
        return false;
      }

      // Execute the command based on its type
      const dynamicCtx: DynamicContext = {
        username,
        channelName,
        usuario,
        messageContext,
        platform,
        discordUserId,
        displayName,
      };

      let response: string | null;
      if (command.command_type === "dynamic") {
        response = await this.executeDynamicCommand(
          command,
          content,
          dynamicCtx
        );
      } else {
        response = this.executeSimpleCommand(
          command,
          content,
          username,
          channelName,
          usuario
        );
      }

      // Send the response if any
      if (response) {
        await bot.sendMessage(response, messageContext);

        // Increment usage counter
        await command.incrementUsage();

        logger.info(
          `[BOT-COMMAND] Command !${command.command} executed successfully`
        );
      }

      return true;
    } catch (error: unknown) {
      logger.error("[BOT-COMMAND] Error processing command:", error);
      return false;
    }
  }

  /**
   * Finds the user in the database based on platform
   * @returns The user object or null
   */
  async findUser(
    platform: string,
    discordUserId: string | null,
    username: string
  ): Promise<Usuario | null> {
    if (platform === "discord" && discordUserId) {
      // For Discord, look up by link
      const link = await DiscordUserLink.findOne({
        where: { discord_user_id: discordUserId },
        include: [{ model: Usuario, as: "usuario" }],
      });
      const usuario = link?.usuario;
      logger.info(
        `[BOT-COMMAND] User found by Discord ID:`,
        usuario ? usuario.nickname : "not found"
      );
      return usuario ?? null;
    }

    // For Kick, look up by user_id_ext
    const usuario = await Usuario.findOne({
      where: { user_id_ext: username },
    });
    logger.info(
      `[BOT-COMMAND] User found by Kick ID:`,
      usuario ? usuario.nickname : "not found"
    );
    return usuario;
  }

  /**
   * Executes a simple command (static response with variables)
   */
  executeSimpleCommand(
    command: KickBotCommand,
    content: string,
    username: string,
    channelName: string,
    usuario: Usuario | null = null
  ): string {
    const args = this.extractArgs(content);

    // Replace variables in the message
    const response = command.response_message
      .replaceAll("{username}", username)
      .replaceAll("{channel}", channelName)
      .replaceAll("{args}", args.join(" "))
      .replaceAll("{points}", usuario ? usuario.puntos.toString() : "0");

    return response;
  }

  /**
   * Executes a dynamic command (with special logic)
   * @param ctx - Context object with username, channelName, usuario, platform, discordUserId, messageContext, displayName
   */
  async executeDynamicCommand(
    command: KickBotCommand,
    content: string,
    ctx: DynamicContext
  ): Promise<string | null> {
    const handler = command.dynamic_handler;

    if (!handler) {
      logger.error(
        `[BOT-COMMAND] Dynamic command !${command.command} has no handler defined`
      );
      return null;
    }

    // Execute the corresponding handler
    switch (handler) {
      case "puntos_handler":
        return await this.puntosHandler(command, content, ctx);

      case "watchtime_handler":
        return await this.watchtimeHandler(command, content, ctx);

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
   * @param ctx - Context object with username, channelName, usuario, platform, discordUserId, messageContext, displayName
   */
  async puntosHandler(
    command: KickBotCommand,
    content: string,
    ctx: DynamicContext
  ): Promise<string> {
    try {
      const args = this.extractArgs(content);

      // If there are arguments, look up the specified user
      if (args.length > 0) {
        return await this.handlePuntosLookup(command, ctx, args);
      }

      // No arguments, show current user's points
      return this.handleSelfPuntos(command, ctx);
    } catch (error: unknown) {
      logger.error("[BOT-COMMAND] Error in puntosHandler:", error);
      return `No pude consultar los puntos.`;
    }
  }

  /**
   * Handles the !puntos command when a target user is specified via arguments
   */
  async handlePuntosLookup(
    command: KickBotCommand,
    ctx: DynamicContext,
    args: string[]
  ): Promise<string> {
    const lookupArg = args[0];
    const { username, channelName, platform, messageContext } = ctx;

    const targetUser = await this.lookupTargetUser(
      lookupArg,
      platform,
      messageContext
    );

    const puntos = targetUser ? Number(targetUser.puntos || 0) : null;

    if (puntos !== null) {
      // User found - use command template
      const displayName = targetUser.nickname;
      return command.response_message
        .replaceAll("{username}", username)
        .replaceAll("{channel}", channelName)
        .replaceAll("{target_user}", displayName)
        .replaceAll("{points}", puntos.toString());
    }

    // User not found - default response
    return this.buildTargetNotFoundMessage(lookupArg, "puntos");
  }

  /**
   * Handles the !puntos command when no arguments are provided (current user)
   */
  handleSelfPuntos(command: KickBotCommand, ctx: DynamicContext): string {
    const { username, channelName, usuario, platform, displayName } = ctx;

    if (!usuario) {
      return this.buildUserNotFoundMessage(
        username,
        platform,
        displayName,
        "puntos"
      );
    }

    const puntos = Number(usuario.puntos || 0);

    // Use command template
    return command.response_message
      .replaceAll("{username}", username)
      .replaceAll("{channel}", channelName)
      .replaceAll("{target_user}", usuario.nickname)
      .replaceAll("{points}", puntos.toString());
  }

  /**
   * Special handler for the !watchtime command
   * Looks up a user's watchtime in the database
   * @param ctx - Context object with username, channelName, usuario, platform, discordUserId, messageContext, displayName
   */
  async watchtimeHandler(
    command: KickBotCommand,
    content: string,
    ctx: DynamicContext
  ): Promise<string> {
    try {
      const args = this.extractArgs(content);

      // If there are arguments, look up the specified user
      if (args.length > 0) {
        return await this.handleWatchtimeLookup(command, ctx, args);
      }

      // No arguments, show current user's watchtime
      return await this.handleSelfWatchtime(command, ctx);
    } catch (error: unknown) {
      logger.error("[BOT-COMMAND] Error in watchtimeHandler:", error);
      return `No pude consultar el tiempo en directo.`;
    }
  }

  /**
   * Handles the !watchtime command when a target user is specified via arguments
   */
  async handleWatchtimeLookup(
    command: KickBotCommand,
    ctx: DynamicContext,
    args: string[]
  ): Promise<string> {
    const lookupArg = args[0];
    const { username, channelName, platform, messageContext } = ctx;

    const targetUser = await this.lookupTargetUser(
      lookupArg,
      platform,
      messageContext,
      true
    );

    if (targetUser) {
      // Get user watchtime
      const targetWithWatch = targetUser as UsuarioWithWatchtime;
      const userWatchtime = targetWithWatch.UserWatchtime;
      const watchtimeMinutes = userWatchtime
        ? userWatchtime.total_watchtime_minutes
        : 0;
      const formattedWatchtime = formatWatchtime(watchtimeMinutes);

      // User found - use command template
      const displayNameTarget = targetUser.nickname;
      return command.response_message
        .replaceAll("{username}", username)
        .replaceAll("{channel}", channelName)
        .replaceAll("{target_user}", displayNameTarget)
        .replaceAll("{watchtime}", formattedWatchtime);
    }

    // User not found - default response
    return this.buildTargetNotFoundMessage(lookupArg, "tiempo en directo");
  }

  /**
   * Handles the !watchtime command when no arguments are provided (current user)
   */
  async handleSelfWatchtime(
    command: KickBotCommand,
    ctx: DynamicContext
  ): Promise<string> {
    const { username, channelName, usuario, platform, displayName } = ctx;

    if (!usuario) {
      return this.buildUserNotFoundMessage(
        username,
        platform,
        displayName,
        "tiempo en directo"
      );
    }

    // Get user watchtime
    const userWatchtime = await UserWatchtime.findOne({
      where: { usuario_id: usuario.id },
    });
    const watchtimeMinutes = userWatchtime
      ? userWatchtime.total_watchtime_minutes
      : 0;
    const formattedWatchtime = formatWatchtime(watchtimeMinutes);

    // Use command template
    return command.response_message
      .replace(/{username}/g, username)
      .replace(/{channel}/g, channelName)
      .replace(/{target_user}/g, usuario.nickname)
      .replace(/{watchtime}/g, formattedWatchtime);
  }

  /**
   * Looks up a target user by argument (Discord mention or nickname)
   * @param includeWatchtime - Whether to include the UserWatchtime association
   * @returns The target user object or null
   */
  async lookupTargetUser(
    lookupArg: string,
    platform: string,
    messageContext: unknown,
    includeWatchtime: boolean = false
  ): Promise<Usuario | null> {
    // Discord-specific logic: detect mentions
    const mentionMatch = /^<@!?(\d+)>$/.exec(lookupArg);
    if (platform === "discord" && messageContext && mentionMatch) {
      const mentionedUserId = mentionMatch[1];
      logger.info(
        `[BOT-COMMAND] Looking up user by Discord mention: ${mentionedUserId}`
      );

      // Look up in DiscordUserLink
      const discordLink = await DiscordUserLink.findOne({
        where: { discord_user_id: mentionedUserId },
        include: [{ model: Usuario, as: "usuario" }],
      });

      const targetUser = discordLink?.usuario;
      logger.info(
        `[BOT-COMMAND] User found by Discord ID:`,
        targetUser ? targetUser.nickname : "not found"
      );
      return targetUser ?? null;
    }

    // Logic for Kick and Discord (lookup by nickname)
    const lookupName = lookupArg.replace(/^@/, "");
    logger.info(`[BOT-COMMAND] Looking up user by nickname: ${lookupName}`);

    // For MySQL, use LOWER() for case insensitive
    const queryOptions: { where: WhereOptions; include?: Includeable[] } = {
      where: sequelize.where(
        sequelize.fn("LOWER", sequelize.col("nickname")),
        sequelize.fn("LOWER", lookupName)
      ),
    };

    if (includeWatchtime) {
      queryOptions.include = [{ model: UserWatchtime, required: false }];
    }

    const targetUser = await Usuario.findOne(queryOptions);

    logger.info(
      `[BOT-COMMAND] User found by nickname:`,
      targetUser ? targetUser.nickname : "not found"
    );
    return targetUser;
  }

  /**
   * Builds the response message when a target user is not found
   */
  buildTargetNotFoundMessage(lookupArg: string, type: string): string {
    let displayName = lookupArg.replace(/^@/, "");
    if (/^<@!?(\d+)>/.exec(lookupArg)) {
      displayName = "usuario mencionado";
    }
    return `${displayName} no existe o no tiene datos de ${type}.`;
  }

  /**
   * Builds the response message when the current user's info cannot be found
   */
  buildUserNotFoundMessage(
    username: string,
    platform: string,
    displayName: string | null,
    type: string
  ): string {
    if (platform === "discord") {
      return `@${username}, vincula tu cuenta de Discord en https://shop.luisardito.com/perfil para consultar ${type}.`;
    } else if (displayName) {
      return `@${displayName}, regístrate en https://shop.luisardito.com/ para consultar ${type}.`;
    }
    return `Regístrate en https://shop.luisardito.com/ para consultar ${type}.`;
  }

  /**
   * Extracts arguments from a command
   * Example: command arg1 arg2 returns array with arguments
   */
  extractArgs(content: string): string[] {
    const parts = content.trim().split(/\s+/);
    return parts.slice(1); // Remove the command itself
  }

  /**
   * Checks if a user has the required permission to execute a command
   * (Currently returns true, but permission logic can be implemented here)
   */
  checkPermission(command: KickBotCommand, _username: string): boolean {
    // Permission logic is not yet implemented — all commands are allowed.
    // When implementing, check if the user is a moderator, VIP, etc.
    return !command.requires_permission || true;
  }

  /**
   * Checks the cooldown of a command for a user
   * (Currently returns true, but cooldown logic can be implemented here)
   */
  async checkCooldown(
    command: KickBotCommand,
    username: string
  ): Promise<boolean> {
    if (command.cooldown_seconds === 0) {
      return true;
    }

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
}

const kickBotCommandHandlerService = new KickBotCommandHandlerService();
export = kickBotCommandHandlerService;
