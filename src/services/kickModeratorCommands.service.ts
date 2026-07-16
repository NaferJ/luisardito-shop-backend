import { KickBotCommand } from "../models";
import logger from "../utils/logger";
import { Op } from "sequelize";

/**
 * ==========================================
 * MODERATOR COMMAND SYSTEM
 * ==========================================
 *
 * Allows moderators to manage bot commands directly from the Kick chat
 * without needing to access the admin interface.
 *
 * Available commands:
 * - !addcmd <name> <response> [--aliases alias1,alias2] [--cooldown 3] [--desc "description"]
 * - !editcmd <name> [--response "new response"] [--aliases alias1,alias2] [--cooldown 5] [--desc "new desc"]
 * - !delcmd <name>
 * - !cmdinfo <name>
 */

interface KickBadge {
  type: string;
}

interface KickIdentity {
  badges?: KickBadge[];
}

interface KickSender {
  user_id: string;
  username: string;
  identity?: KickIdentity;
}

interface KickBroadcaster {
  user_id: string;
  username: string;
}

interface ModeratorPayload {
  content: string;
  sender: KickSender;
  broadcaster: KickBroadcaster;
}

interface ParsedFlags {
  aliases?: string[];
  cooldown?: number;
  desc?: string;
  response?: string;
}

interface ParsedCommand {
  command: string;
  name: string | null;
  flags: ParsedFlags;
  error?: string;
}

interface CommandResult {
  success: boolean;
  processed: boolean;
  message: string | null;
  data?: KickBotCommand;
}

// List of protected commands that CANNOT be deleted
const PROTECTED_COMMANDS = new Set([
  "comandos",
  "puntos",
  "top",
  "tienda",
  "shop",
  "leaderboard",
  "rank",
  "ranking",
]);

/**
 * Checks if the user has moderator or broadcaster permissions
 * @param sender - Sender object from Kick webhook
 * @param broadcaster - Broadcaster object from Kick webhook
 * @returns true if the user is a moderator or broadcaster
 */
function isModerator(
  sender: KickSender,
  broadcaster: KickBroadcaster
): boolean {
  // The broadcaster always has permissions
  if (sender.user_id === broadcaster.user_id) {
    return true;
  }

  // Check if user has moderator badge
  const badges = sender.identity?.badges || [];
  return badges.some(
    (badge) => badge.type === "moderator" || badge.type === "broadcaster"
  );
}

/**
 * Reads a flag's value from the token list starting at index `i`.
 * Handles quoted multi-word values and returns the consumed value plus
 * the index of the next unprocessed token.
 * @param parts - Tokenized message parts
 * @param i - Index of the first value token
 * @returns The consumed value and the next unprocessed index
 */
function readFlagValue(
  parts: string[],
  i: number
): { value: string; nextIndex: number } {
  if (i >= parts.length) {
    return { value: "", nextIndex: i };
  }

  if (!parts[i].startsWith('"')) {
    return { value: parts[i], nextIndex: i + 1 };
  }

  // Quoted value spanning multiple words
  const quotedParts: string[] = [];
  while (i < parts.length) {
    quotedParts.push(parts[i]);
    if (parts[i].endsWith('"')) {
      return {
        value: quotedParts.join(" ").replace(/^"|"$/g, ""),
        nextIndex: i + 1,
      };
    }
    i++;
  }

  // Unclosed quote: consume the rest of the input
  return {
    value: quotedParts.join(" ").replace(/^"|"$/g, ""),
    nextIndex: i,
  };
}

/**
 * Assigns a parsed flag name and value into the flags object.
 * Unknown flag names are silently ignored.
 * @param flags - Flags object to mutate
 * @param flagName - Flag name without the leading "--"
 * @param flagValue - Raw flag value string
 */
function assignFlag(
  flags: ParsedFlags,
  flagName: string,
  flagValue: string
): void {
  if (flagName === "aliases") {
    flags.aliases = flagValue
      .split(",")
      .map((a) => a.trim().toLowerCase().replace(/^!/, ""))
      .filter(Boolean);
  } else if (flagName === "cooldown") {
    flags.cooldown = Number.parseInt(flagValue) || 3;
  } else if (flagName === "desc") {
    flags.desc = flagValue;
  } else if (flagName === "response") {
    flags.response = flagValue;
  }
}

/**
 * Parses a moderator command message and extracts parameters
 * @param content - Full message content
 * @returns Parsed command object or null if not a valid command
 */
function parseModeratorCommand(content: string): ParsedCommand | null {
  const trimmed = content.trim();
  const parts = trimmed.split(/\s+/);

  const command = parts[0]?.toLowerCase();

  // Check if it is a valid moderator command
  const validCommands = ["!addcmd", "!editcmd", "!delcmd", "!cmdinfo"];
  if (!validCommands.includes(command)) {
    return null;
  }

  const name = parts[1]?.toLowerCase().replace(/^!/, "") ?? null;

  if (!name) {
    return {
      command,
      name: null,
      flags: {},
      error: "You must specify the command name",
    };
  }

  const flags: ParsedFlags = {};
  const responseWords: string[] = [];

  let i = 2;
  while (i < parts.length) {
    const part = parts[i];

    if (part.startsWith("--")) {
      const flagName = part.substring(2);
      const { value: flagValue, nextIndex } = readFlagValue(parts, i + 1);
      i = nextIndex;
      assignFlag(flags, flagName, flagValue);
    } else {
      // Response part
      responseWords.push(part);
      i++;
    }
  }

  // If there are loose response words (without --response), assign them as the response
  if (responseWords.length > 0 && !flags.response) {
    flags.response = responseWords.join(" ");
  }

  return { command, name, flags };
}

/**
 * Processes a moderator command and executes the corresponding action
 * @param payload - Full Kick webhook payload (chat.message.sent)
 * @returns Result with success, message, and processed status
 */
async function processModeratorCommand(
  payload: ModeratorPayload
): Promise<CommandResult> {
  try {
    const { content, sender, broadcaster } = payload;

    // Check permissions
    if (!isModerator(sender, broadcaster)) {
      return {
        success: false,
        processed: false,
        message: null, // Do not respond to avoid spam
      };
    }

    // Parse command
    const parsed = parseModeratorCommand(content);

    if (!parsed) {
      return { success: false, processed: false, message: null };
    }

    if (parsed.error) {
      return {
        success: false,
        processed: true,
        message: parsed.error,
      };
    }

    const { command, name, flags } = parsed;

    logger.info(`[MOD-CMD] ${sender.username} executed: ${command} ${name}`);

    // Execute command based on type
    switch (command) {
      case "!addcmd":
        return await handleAddCommand(name!, flags, sender);

      case "!editcmd":
        return await handleEditCommand(name!, flags, sender);

      case "!delcmd":
        return await handleDeleteCommand(name!, sender, broadcaster);

      case "!cmdinfo":
        return await handleCommandInfo(name!);

      default:
        return { success: false, processed: false, message: null };
    }
  } catch (error: unknown) {
    logger.error("[MOD-CMD] Error processing moderator command:", error);
    return {
      success: false,
      processed: true,
      message: "Could not process the command",
    };
  }
}

/**
 * Handles the !addcmd command
 */
async function handleAddCommand(
  name: string,
  flags: ParsedFlags,
  sender: KickSender
): Promise<CommandResult> {
  try {
    // Validate that it has a response
    if (!flags.response) {
      return {
        success: false,
        processed: true,
        message: `You must specify a response for the command. Example: !addcmd ${name} Hello {username}`,
      };
    }

    // Check that the command does not already exist
    const existing = await KickBotCommand.findOne({
      where: { command: name },
    });

    if (existing) {
      return {
        success: false,
        processed: true,
        message: `Command "!${name}" already exists. Use !editcmd to modify it.`,
      };
    }

    // Validate that aliases do not already exist as commands
    if (flags.aliases && flags.aliases.length > 0) {
      const existingAliases = await KickBotCommand.findAll({
        where: {
          [Op.or]: flags.aliases.map((alias) => ({ command: alias })),
        },
      });

      if (existingAliases.length > 0) {
        const conflictingNames = existingAliases
          .map((c) => c.command)
          .join(", ");
        return {
          success: false,
          processed: true,
          message: `The following aliases already exist as commands: ${conflictingNames}`,
        };
      }
    }

    // Create the command
    const newCommand = await KickBotCommand.create({
      command: name,
      aliases: flags.aliases || [],
      response_message: flags.response,
      description: flags.desc || `Command created by @${sender.username}`,
      command_type: "simple",
      enabled: true,
      requires_permission: false,
      permission_level: "viewer",
      cooldown_seconds: flags.cooldown || 3,
      auto_send_interval_seconds: 0,
      usage_count: 0,
    });

    logger.info(`[MOD-CMD] Command !${name} created by ${sender.username}`);

    // Build confirmation message
    let confirmMsg = `Command "!${name}" created successfully`;
    if (flags.aliases && flags.aliases.length > 0) {
      confirmMsg += ` (Aliases: ${flags.aliases.join(", ")})`;
    }

    return {
      success: true,
      processed: true,
      message: confirmMsg,
      data: newCommand,
    };
  } catch (error: unknown) {
    logger.error("[MOD-CMD] Error in handleAddCommand:", error);
    return {
      success: false,
      processed: true,
      message: "Could not create the command",
    };
  }
}

/**
 * Handles the !editcmd command
 */
async function handleEditCommand(
  name: string,
  flags: ParsedFlags,
  sender: KickSender
): Promise<CommandResult> {
  try {
    // Find the command
    const command = await KickBotCommand.findOne({
      where: { command: name },
    });

    if (!command) {
      return {
        success: false,
        processed: true,
        message: `Command "!${name}" does not exist. Use !addcmd to create it.`,
      };
    }

    // Validate that at least one field is provided for update
    if (!flags.response && !flags.aliases && !flags.cooldown && !flags.desc) {
      return {
        success: false,
        processed: true,
        message: `You must specify at least one field to update. Example: !editcmd ${name} --response New response`,
      };
    }

    // Update only the specified fields
    const updates: {
      response_message?: string;
      aliases?: string[];
      cooldown_seconds?: number;
      description?: string;
    } = {};
    const changes: string[] = [];

    if (flags.response) {
      updates.response_message = flags.response;
      changes.push("response");
    }

    if (flags.aliases) {
      updates.aliases = flags.aliases;
      changes.push(`aliases (${flags.aliases.join(", ")})`);
    }

    if (flags.cooldown !== undefined) {
      updates.cooldown_seconds = flags.cooldown;
      changes.push(`cooldown (${flags.cooldown}s)`);
    }

    if (flags.desc) {
      updates.description = flags.desc;
      changes.push("description");
    }

    // Update
    await command.update(updates);

    logger.info(
      `[MOD-CMD] Command !${name} edited by ${sender.username}: ${changes.join(", ")}`
    );

    return {
      success: true,
      processed: true,
      message: `Command "!${name}" updated: ${changes.join(", ")}`,
      data: command,
    };
  } catch (error: unknown) {
    logger.error("[MOD-CMD] Error in handleEditCommand:", error);
    return {
      success: false,
      processed: true,
      message: "Could not edit the command",
    };
  }
}

/**
 * Handles the !delcmd command
 */
async function handleDeleteCommand(
  name: string,
  sender: KickSender,
  broadcaster: KickBroadcaster
): Promise<CommandResult> {
  try {
    // Check if the command is protected
    if (PROTECTED_COMMANDS.has(name)) {
      return {
        success: false,
        processed: true,
        message: `Command "!${name}" is protected and cannot be deleted`,
      };
    }

    // Only the broadcaster can delete commands
    if (sender.user_id !== broadcaster.user_id) {
      return {
        success: false,
        processed: true,
        message: `Only @${broadcaster.username} can delete commands`,
      };
    }

    // Find the command
    const command = await KickBotCommand.findOne({
      where: { command: name },
    });

    if (!command) {
      return {
        success: false,
        processed: true,
        message: `Command "!${name}" does not exist`,
      };
    }

    // Delete
    await command.destroy();

    logger.info(`[MOD-CMD] Command !${name} deleted by ${sender.username}`);

    return {
      success: true,
      processed: true,
      message: `Command "!${name}" deleted successfully`,
    };
  } catch (error: unknown) {
    logger.error("[MOD-CMD] Error in handleDeleteCommand:", error);
    return {
      success: false,
      processed: true,
      message: "Could not delete the command",
    };
  }
}

/**
 * Handles the !cmdinfo command
 */
async function handleCommandInfo(name: string): Promise<CommandResult> {
  try {
    // Find the command
    const command = await KickBotCommand.findOne({
      where: { command: name },
    });

    if (!command) {
      return {
        success: false,
        processed: true,
        message: `Command "!${name}" does not exist`,
      };
    }

    // Build info message
    const aliases =
      command.aliases && command.aliases.length > 0
        ? command.aliases.join(", ")
        : "none";

    const estado = command.enabled ? "Active" : "Disabled";

    // Show the FULL response without truncation
    const message =
      `Command info for "!${name}" | ` +
      `Response: ${command.response_message} | ` +
      `Aliases: ${aliases} | ` +
      `Cooldown: ${command.cooldown_seconds}s | ` +
      `Status: ${estado} | ` +
      `Uses: ${command.usage_count}`;

    return {
      success: true,
      processed: true,
      message,
      data: command,
    };
  } catch (error: unknown) {
    logger.error("[MOD-CMD] Error in handleCommandInfo:", error);
    return {
      success: false,
      processed: true,
      message: "Could not get command info",
    };
  }
}

export { processModeratorCommand, isModerator, parseModeratorCommand };
