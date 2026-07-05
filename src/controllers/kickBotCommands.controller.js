const { KickBotCommand } = require("../models");
const logger = require("../utils/logger");
const { Op } = require("sequelize");

/**
 * Get all commands (with pagination and filters)
 * GET /api/kick-admin/bot-commands
 */
exports.getAllCommands = async (req, res) => {
  try {
    const { page = 1, limit = 20, enabled, command_type, search } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Filters
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
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    logger.info(
      `[BOT-COMMANDS] Command list requested: ${rows.length} commands`
    );

    res.json({
      ok: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    logger.error("[BOT-COMMANDS] Error fetching commands:", error);
    res.status(500).json({
      ok: false,
      message: "Error fetching commands",
      error: error.message,
    });
  }
};

/**
 * Get all public commands (read-only, no sensitive filters)
 * GET /api/kick-admin/bot-commands/public
 */
exports.getPublicCommands = async (req, res) => {
  try {
    const { page = 1, limit = 20, enabled, command_type, search } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Filters
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
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["created_at", "DESC"]],
    });

    logger.info(
      `[BOT-COMMANDS] Public command list requested: ${rows.length} commands`
    );

    res.json({
      ok: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    logger.error("[BOT-COMMANDS] Error fetching public commands:", error);
    res.status(500).json({
      ok: false,
      message: "Error fetching commands",
      error: error.message,
    });
  }
};

/**
 * Get a specific command by ID
 * GET /api/kick-admin/bot-commands/:id
 */
exports.getCommandById = async (req, res) => {
  try {
    const { id } = req.params;

    const command = await KickBotCommand.findByPk(id);

    if (!command) {
      return res.status(404).json({
        ok: false,
        message: "Command not found",
      });
    }

    logger.info(`[BOT-COMMANDS] Command fetched: !${command.command}`);

    res.json({
      ok: true,
      data: command,
    });
  } catch (error) {
    logger.error("[BOT-COMMANDS] Error fetching command:", error);
    res.status(500).json({
      ok: false,
      message: "Error fetching command",
      error: error.message,
    });
  }
};

/**
 * Create a new command
 * POST /api/kick-admin/bot-commands
 */
exports.createCommand = async (req, res) => {
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
      return res.status(400).json({
        ok: false,
        message: 'The fields "command" and "response_message" are required',
      });
    }

    // Validate that the command does not already exist
    const existingCommand = await KickBotCommand.findOne({
      where: { command: command.toLowerCase() },
    });

    if (existingCommand) {
      return res.status(409).json({
        ok: false,
        message: `The command "!${command}" already exists`,
      });
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
        return res.status(409).json({
          ok: false,
          message: `One of the aliases already exists as a command: ${existingAliases.map((c) => c.command).join(", ")}`,
        });
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
    logger.error("[BOT-COMMANDS] Error creating command:", error);
    res.status(500).json({
      ok: false,
      message: "Error creating command",
      error: error.message,
    });
  }
};

/**
 * Update an existing command
 * PUT /api/kick-admin/bot-commands/:id
 */
exports.updateCommand = async (req, res) => {
  try {
    const { id } = req.params;
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
    } = req.body;

    const existingCommand = await KickBotCommand.findByPk(id);

    if (!existingCommand) {
      return res.status(404).json({
        ok: false,
        message: "Command not found",
      });
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
        return res.status(409).json({
          ok: false,
          message: `The command "!${command}" already exists`,
        });
      }
    }

    // Update fields
    if (command !== undefined) existingCommand.command = command.toLowerCase();
    if (aliases !== undefined) existingCommand.aliases = aliases;
    if (response_message !== undefined)
      existingCommand.response_message = response_message;
    if (description !== undefined) existingCommand.description = description;
    if (command_type !== undefined) existingCommand.command_type = command_type;
    if (dynamic_handler !== undefined)
      existingCommand.dynamic_handler = dynamic_handler;
    if (enabled !== undefined) existingCommand.enabled = enabled;
    if (requires_permission !== undefined)
      existingCommand.requires_permission = requires_permission;
    if (permission_level !== undefined)
      existingCommand.permission_level = permission_level;
    if (cooldown_seconds !== undefined)
      existingCommand.cooldown_seconds = cooldown_seconds;
    if (auto_send_interval_seconds !== undefined)
      existingCommand.auto_send_interval_seconds = auto_send_interval_seconds;

    await existingCommand.save();

    logger.info(`[BOT-COMMANDS] Command updated: !${existingCommand.command}`);

    res.json({
      ok: true,
      message: "Command updated successfully",
      data: existingCommand,
    });
  } catch (error) {
    logger.error("[BOT-COMMANDS] Error updating command:", error);
    res.status(500).json({
      ok: false,
      message: "Error updating command",
      error: error.message,
    });
  }
};

/**
 * Delete a command
 * DELETE /api/kick-admin/bot-commands/:id
 */
exports.deleteCommand = async (req, res) => {
  try {
    const { id } = req.params;

    const command = await KickBotCommand.findByPk(id);

    if (!command) {
      return res.status(404).json({
        ok: false,
        message: "Command not found",
      });
    }

    const commandName = command.command;
    await command.destroy();

    logger.info(`[BOT-COMMANDS] Command deleted: !${commandName}`);

    res.json({
      ok: true,
      message: "Command deleted successfully",
    });
  } catch (error) {
    logger.error("[BOT-COMMANDS] Error deleting command:", error);
    res.status(500).json({
      ok: false,
      message: "Error deleting command",
      error: error.message,
    });
  }
};

/**
 * Toggle command status (enabled/disabled)
 * PATCH /api/kick-admin/bot-commands/:id/toggle
 */
exports.toggleCommandStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const command = await KickBotCommand.findByPk(id);

    if (!command) {
      return res.status(404).json({
        ok: false,
        message: "Command not found",
      });
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
    logger.error("[BOT-COMMANDS] Error toggling command status:", error);
    res.status(500).json({
      ok: false,
      message: "Error toggling command status",
      error: error.message,
    });
  }
};

/**
 * Get command usage statistics
 * GET /api/kick-admin/bot-commands/stats
 */
exports.getCommandsStats = async (req, res) => {
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
    logger.error("[BOT-COMMANDS] Error fetching stats:", error);
    res.status(500).json({
      ok: false,
      message: "Error fetching stats",
      error: error.message,
    });
  }
};

/**
 * Duplicate an existing command
 * POST /api/kick-admin/bot-commands/:id/duplicate
 */
exports.duplicateCommand = async (req, res) => {
  try {
    const { id } = req.params;

    const originalCommand = await KickBotCommand.findByPk(id);

    if (!originalCommand) {
      return res.status(404).json({
        ok: false,
        message: "Command not found",
      });
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
    logger.error("[BOT-COMMANDS] Error duplicating command:", error);
    res.status(500).json({
      ok: false,
      message: "Error duplicating command",
      error: error.message,
    });
  }
};

/**
 * Test a command (without saving it)
 * POST /api/kick-admin/bot-commands/test
 */
exports.testCommand = async (req, res) => {
  try {
    const {
      response_message,
      test_username = "TestUser",
      test_args = "",
    } = req.body;

    if (!response_message) {
      return res.status(400).json({
        ok: false,
        message: 'The field "response_message" is required',
      });
    }

    // Simulate variables
    const processedMessage = response_message
      .replace(/{username}/g, test_username)
      .replace(/{channel}/g, "luisardito")
      .replace(/{args}/g, test_args)
      .replace(/{target_user}/g, test_username)
      .replace(/{points}/g, "1000");

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
    logger.error("[BOT-COMMANDS] Error testing command:", error);
    res.status(500).json({
      ok: false,
      message: "Error testing command",
      error: error.message,
    });
  }
};
