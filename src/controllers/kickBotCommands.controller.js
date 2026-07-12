const { KickBotCommand } = require("../models");
const logger = require("../utils/logger");
const { Op } = require("sequelize");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

/**
 * Shared logic for building filters, querying, and paginating bot commands.
 * Used by both getAllCommands and getPublicCommands.
 * @param {Object} req - Express request
 * @param {string} label - Label for logging (e.g. "Public command" or "Command")
 * @returns {Promise<Object>} { count, rows, pagination }
 */
async function fetchCommandsList(req, label) {
  const { page = 1, limit = 20, enabled, command_type, search } = req.query;

  const offset = (page - 1) * limit;
  const where = {};

  if (enabled !== undefined) {
    where.enabled = enabled === "true";
  }

  if (command_type) {
    where.command_type = command_type;
  }

  if (search) {
    where[Op.or] = [
      { command: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
    ];
  }

  const { count, rows } = await KickBotCommand.findAndCountAll({
    where,
    limit: Number.parseInt(limit),
    offset: Number.parseInt(offset),
    order: [["created_at", "DESC"]],
  });

  logger.info(
    `[BOT-COMMANDS] ${label} list requested: ${rows.length} commands`
  );

  return {
    count,
    rows,
    pagination: {
      total: count,
      page: Number.parseInt(page),
      limit: Number.parseInt(limit),
      totalPages: Math.ceil(count / limit),
    },
  };
}

/**
 * Get all commands (with pagination and filters)
 * GET /api/kick-admin/bot-commands
 */
exports.getAllCommands = asyncHandler(async (req, res) => {
  try {
    const { rows, pagination } = await fetchCommandsList(req, "Command");

    res.json({ ok: true, data: rows, pagination });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[BOT-COMMANDS] Error fetching commands:", error);
    throw new AppError("Error fetching commands", 500);
  }
});

/**
 * Get all public commands (read-only, no sensitive filters)
 * GET /api/kick-admin/bot-commands/public
 */
exports.getPublicCommands = asyncHandler(async (req, res) => {
  try {
    const { rows, pagination } = await fetchCommandsList(req, "Public command");

    res.json({ ok: true, data: rows, pagination });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[BOT-COMMANDS] Error fetching public commands:", error);
    throw new AppError("Error fetching commands", 500);
  }
});

/**
 * Get a specific command by ID
 * GET /api/kick-admin/bot-commands/:id
 */
exports.getCommandById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const command = await KickBotCommand.findByPk(id);

    if (!command) {
      throw new AppError("Command not found", 404);
    }

    logger.info(`[BOT-COMMANDS] Command fetched: !${command.command}`);

    res.json({
      ok: true,
      data: command,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[BOT-COMMANDS] Error fetching command:", error);
    throw new AppError("Error fetching command", 500);
  }
});

/**
 * Create a new command
 * POST /api/kick-admin/bot-commands
 */
exports.createCommand = asyncHandler(async (req, res) => {
  try {
    const {
      command,
      aliases = [],
      response_message,
      description,
      command_type = "simple",
      dynamic_handler,
      enabled = true,
      requires_permission = false,
      permission_level = "viewer",
      cooldown_seconds = 0,
      auto_send_interval_seconds = 0,
    } = req.body;

    // Validations
    if (!command || !response_message) {
      throw new AppError(
        'The fields "command" and "response_message" are required',
        400
      );
    }

    // Validate that the command does not already exist
    const existingCommand = await KickBotCommand.findOne({
      where: { command: command.toLowerCase() },
    });

    if (existingCommand) {
      throw new AppError(`The command "!${command}" already exists`, 409);
    }

    // Validate unique aliases
    if (aliases && aliases.length > 0) {
      const existingAliases = await KickBotCommand.findAll({
        where: {
          [Op.or]: aliases.map((alias) => ({
            command: alias.toLowerCase(),
          })),
        },
      });

      if (existingAliases.length > 0) {
        throw new AppError(
          `One of the aliases already exists as a command: ${existingAliases.map((c) => c.command).join(", ")}`,
          409
        );
      }
    }

    // Create the command
    const newCommand = await KickBotCommand.create({
      command: command.toLowerCase(),
      aliases: aliases || [],
      response_message,
      description,
      command_type,
      dynamic_handler: command_type === "dynamic" ? dynamic_handler : null,
      enabled,
      requires_permission,
      permission_level: requires_permission ? permission_level : "viewer",
      cooldown_seconds: cooldown_seconds || 0,
      auto_send_interval_seconds: auto_send_interval_seconds || 0,
      usage_count: 0,
      last_used_at: null,
    });

    logger.info(`[BOT-COMMANDS] Command created: !${newCommand.command}`);

    res.status(201).json({
      ok: true,
      message: "Command created successfully",
      data: newCommand,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[BOT-COMMANDS] Error creating command:", error);
    throw new AppError("Error creating command", 500);
  }
});

/**
 * Apply field updates to a command instance (only defined fields).
 * Extracted to reduce cognitive complexity of updateCommand.
 */
function applyCommandUpdates(commandInstance, updates) {
  const {
    command,
    aliases,
    response_message,
    description,
    command_type,
    dynamic_handler,
    enabled,
    requires_permission,
    permission_level,
    cooldown_seconds,
    auto_send_interval_seconds,
  } = updates;

  if (command !== undefined) commandInstance.command = command.toLowerCase();
  if (aliases !== undefined) commandInstance.aliases = aliases;
  if (response_message !== undefined)
    commandInstance.response_message = response_message;
  if (description !== undefined) commandInstance.description = description;
  if (command_type !== undefined) commandInstance.command_type = command_type;
  if (dynamic_handler !== undefined)
    commandInstance.dynamic_handler = dynamic_handler;
  if (enabled !== undefined) commandInstance.enabled = enabled;
  if (requires_permission !== undefined)
    commandInstance.requires_permission = requires_permission;
  if (permission_level !== undefined)
    commandInstance.permission_level = permission_level;
  if (cooldown_seconds !== undefined)
    commandInstance.cooldown_seconds = cooldown_seconds;
  if (auto_send_interval_seconds !== undefined)
    commandInstance.auto_send_interval_seconds = auto_send_interval_seconds;
}

/**
 * Update an existing command
 * PUT /api/kick-admin/bot-commands/:id
 */
exports.updateCommand = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { command } = req.body;

    const existingCommand = await KickBotCommand.findByPk(id);

    if (!existingCommand) {
      throw new AppError("Command not found", 404);
    }

    // If renaming the command, validate that the new name does not exist
    if (command && command.toLowerCase() !== existingCommand.command) {
      const duplicateCommand = await KickBotCommand.findOne({
        where: {
          command: command.toLowerCase(),
          id: { [Op.ne]: id },
        },
      });

      if (duplicateCommand) {
        throw new AppError(`The command "!${command}" already exists`, 409);
      }
    }

    // Update fields
    applyCommandUpdates(existingCommand, req.body);

    await existingCommand.save();

    logger.info(`[BOT-COMMANDS] Command updated: !${existingCommand.command}`);

    res.json({
      ok: true,
      message: "Command updated successfully",
      data: existingCommand,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[BOT-COMMANDS] Error updating command:", error);
    throw new AppError("Error updating command", 500);
  }
});

/**
 * Delete a command
 * DELETE /api/kick-admin/bot-commands/:id
 */
exports.deleteCommand = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const command = await KickBotCommand.findByPk(id);

    if (!command) {
      throw new AppError("Command not found", 404);
    }

    const commandName = command.command;
    await command.destroy();

    logger.info(`[BOT-COMMANDS] Command deleted: !${commandName}`);

    res.json({
      ok: true,
      message: "Command deleted successfully",
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[BOT-COMMANDS] Error deleting command:", error);
    throw new AppError("Error deleting command", 500);
  }
});

/**
 * Toggle command status (enabled/disabled)
 * PATCH /api/kick-admin/bot-commands/:id/toggle
 */
exports.toggleCommandStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const command = await KickBotCommand.findByPk(id);

    if (!command) {
      throw new AppError("Command not found", 404);
    }

    command.enabled = !command.enabled;
    await command.save();

    const status = command.enabled ? "enabled" : "disabled";
    logger.info(`[BOT-COMMANDS] Command ${status}: !${command.command}`);

    res.json({
      ok: true,
      message: `Command ${status} successfully`,
      data: command,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[BOT-COMMANDS] Error toggling command status:", error);
    throw new AppError("Error toggling command status", 500);
  }
});

/**
 * Get command usage statistics
 * GET /api/kick-admin/bot-commands/stats
 */
exports.getCommandsStats = asyncHandler(async (req, res) => {
  try {
    const totalCommands = await KickBotCommand.count();
    const enabledCommands = await KickBotCommand.count({
      where: { enabled: true },
    });
    const disabledCommands = await KickBotCommand.count({
      where: { enabled: false },
    });

    const simpleCommands = await KickBotCommand.count({
      where: { command_type: "simple" },
    });
    const dynamicCommands = await KickBotCommand.count({
      where: { command_type: "dynamic" },
    });

    const mostUsedCommands = await KickBotCommand.findAll({
      order: [["usage_count", "DESC"]],
      limit: 10,
      attributes: ["id", "command", "usage_count", "last_used_at"],
    });

    const recentlyUsedCommands = await KickBotCommand.findAll({
      where: {
        last_used_at: { [Op.ne]: null },
      },
      order: [["last_used_at", "DESC"]],
      limit: 10,
      attributes: ["id", "command", "usage_count", "last_used_at"],
    });

    logger.info("[BOT-COMMANDS] Stats requested");

    res.json({
      ok: true,
      data: {
        summary: {
          total: totalCommands,
          enabled: enabledCommands,
          disabled: disabledCommands,
          simple: simpleCommands,
          dynamic: dynamicCommands,
        },
        mostUsed: mostUsedCommands,
        recentlyUsed: recentlyUsedCommands,
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[BOT-COMMANDS] Error fetching stats:", error);
    throw new AppError("Error fetching stats", 500);
  }
});

/**
 * Duplicate an existing command
 * POST /api/kick-admin/bot-commands/:id/duplicate
 */
exports.duplicateCommand = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const originalCommand = await KickBotCommand.findByPk(id);

    if (!originalCommand) {
      throw new AppError("Command not found", 404);
    }

    // Generate a unique name
    let newCommandName = `${originalCommand.command}_copy`;
    let counter = 1;

    while (
      await KickBotCommand.findOne({ where: { command: newCommandName } })
    ) {
      newCommandName = `${originalCommand.command}_copy${counter}`;
      counter++;
    }

    const duplicatedCommand = await KickBotCommand.create({
      command: newCommandName,
      aliases: [],
      response_message: originalCommand.response_message,
      description: `Copy of: ${originalCommand.description || originalCommand.command}`,
      command_type: originalCommand.command_type,
      dynamic_handler: originalCommand.dynamic_handler,
      enabled: false, // Disabled by default
      requires_permission: originalCommand.requires_permission,
      permission_level: originalCommand.permission_level,
      cooldown_seconds: originalCommand.cooldown_seconds,
      auto_send_interval_seconds: 0, // Do not auto-send by default
      usage_count: 0,
      last_used_at: null,
    });

    logger.info(
      `[BOT-COMMANDS] Command duplicated: !${originalCommand.command} -> !${newCommandName}`
    );

    res.status(201).json({
      ok: true,
      message: "Command duplicated successfully",
      data: duplicatedCommand,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[BOT-COMMANDS] Error duplicating command:", error);
    throw new AppError("Error duplicating command", 500);
  }
});

/**
 * Test a command (without saving it)
 * POST /api/kick-admin/bot-commands/test
 */
exports.testCommand = asyncHandler(async (req, res) => {
  try {
    const {
      response_message,
      test_username = "TestUser",
      test_args = "",
    } = req.body;

    if (!response_message) {
      throw new AppError('The field "response_message" is required', 400);
    }

    // Simulate variables
    const processedMessage = response_message
      .replaceAll("{username}", test_username)
      .replaceAll("{channel}", "luisardito")
      .replaceAll("{args}", test_args)
      .replaceAll("{target_user}", test_username)
      .replaceAll("{points}", "1000");

    logger.info("[BOT-COMMANDS] Test command executed");

    res.json({
      ok: true,
      data: {
        original: response_message,
        processed: processedMessage,
        variables_used: {
          username: test_username,
          channel: "luisardito",
          args: test_args,
          target_user: test_username,
          points: "1000",
        },
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("[BOT-COMMANDS] Error testing command:", error);
    throw new AppError("Error testing command", 500);
  }
});
