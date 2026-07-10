const { KickBotCommand } = require("../models");
const logger = require("../utils/logger");
const { Op } = require("sequelize");

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

// List of protected commands that CANNOT be deleted
const PROTECTED_COMMANDS = [
  "comandos",
  "puntos",
  "top",
  "tienda",
  "shop",
  "leaderboard",
  "rank",
  "ranking",
];

/**
 * Checks if the user has moderator or broadcaster permissions
 * @param {object} sender - Sender object from Kick webhook
 * @param {object} broadcaster - Broadcaster object from Kick webhook
 * @returns {boolean}
 */
function isModerator(sender, broadcaster) {
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
 * Parses a moderator command message and extracts parameters
 * @param {string} content - Full message content
 * @returns {object|null} - { command, name, flags } or null if not a valid command
 */
function parseModeratorCommand(content) {
  const trimmed = content.trim();
  const parts = trimmed.split(/\s+/);

  const command = parts[0]?.toLowerCase();

  // Check if it is a valid moderator command
  const validCommands = ["!addcmd", "!editcmd", "!delcmd", "!cmdinfo"];
  if (!validCommands.includes(command)) {
    return null;
  }

  const name = parts[1]?.toLowerCase().replace(/^!/, "");

  if (!name) {
    return {
      command,
      name: null,
      flags: {},
      error: "You must specify the command name",
    };
  }

  const flags = {};
  const responseWords = [];

  let i = 2;
  while (i < parts.length) {
    const part = parts[i];

    if (part.startsWith("--")) {
      const flagName = part.substring(2);
      i++;

      // Handle quoted values
      let flagValue = "";
      if (i < parts.length) {
        if (parts[i].startsWith('"')) {
          // Quoted value
          const quotedParts = [];
          while (i < parts.length) {
            quotedParts.push(parts[i]);
            if (parts[i].endsWith('"')) {
              i++;
              break;
            }
            i++;
          }
          flagValue = quotedParts.join(" ").replace(/^"|"$/g, "");
        } else {
          // Simple value
          flagValue = parts[i];
          i++;
        }
      }

      if (flagName === "aliases") {
        flags.aliases = flagValue
          .split(",")
          .map((a) => a.trim().toLowerCase().replace(/^!/, ""))
          .filter((a) => a);
      } else if (flagName === "cooldown") {
        flags.cooldown = parseInt(flagValue) || 3;
      } else if (flagName === "desc") {
        flags.desc = flagValue;
      } else if (flagName === "response") {
        flags.response = flagValue;
      }
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
 * @param {object} payload - Full Kick webhook payload (chat.message.sent)
 * @returns {Promise<object>} - { success, message, processed }
 */
async function processModeratorCommand(payload) {
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
        return await handleAddCommand(name, flags, sender);

      case "!editcmd":
        return await handleEditCommand(name, flags, sender);

      case "!delcmd":
        return await handleDeleteCommand(name, sender, broadcaster);

      case "!cmdinfo":
        return await handleCommandInfo(name);

      default:
        return { success: false, processed: false, message: null };
    }
  } catch (error) {
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
async function handleAddCommand(name, flags, sender) {
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
  } catch (error) {
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
async function handleEditCommand(name, flags, sender) {
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
    const updates = {};
    const changes = [];

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
  } catch (error) {
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
async function handleDeleteCommand(name, sender, broadcaster) {
  try {
    // Check if the command is protected
    if (PROTECTED_COMMANDS.includes(name)) {
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
  } catch (error) {
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
async function handleCommandInfo(name) {
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
  } catch (error) {
    logger.error("[MOD-CMD] Error in handleCommandInfo:", error);
    return {
      success: false,
      processed: true,
      message: "Could not get command info",
    };
  }
}

module.exports = {
  processModeratorCommand,
  isModerator,
  parseModeratorCommand,
};
