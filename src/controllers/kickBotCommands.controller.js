const { KickBotCommand } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * 📋 Obtener todos los comandos (con paginación y filtros)
 * GET /api/kick-admin/bot-commands
 */
exports.getAllCommands = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            enabled,
            command_type,
            search
        } = req.query;

        const offset = (page - 1) * limit;
        const where = {};

        // Filtros
        if (enabled !== undefined) {
            where.enabled = enabled === 'true';
        }

        if (command_type) {
            where.command_type = command_type;
        }

        if (search) {
            where[Op.or] = [
                { command: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows } = await KickBotCommand.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']]
        });

        logger.info(`📋 [BOT-COMMANDS] Lista de comandos solicitada: ${rows.length} comandos`);

        res.json({
            ok: true,
            data: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        logger.error('[BOT-COMMANDS] Error obteniendo comandos:', error);
        res.status(500).json({
            ok: false,
            message: 'Error al obtener los comandos',
            error: error.message
        });
    }
};

/**
 * 📋 Obtener todos los comandos públicos (solo lectura, sin filtros sensibles)
 * GET /api/kick-admin/bot-commands/public
 */
exports.getPublicCommands = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            enabled,
            command_type,
            search
        } = req.query;

        const offset = (page - 1) * limit;
        const where = {};

        // Filtros
        if (enabled !== undefined) {
            where.enabled = enabled === 'true';
        }

        if (command_type) {
            where.command_type = command_type;
        }

        if (search) {
            where[Op.or] = [
                { command: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows } = await KickBotCommand.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']]
        });

        logger.info(`📋 [BOT-COMMANDS] Lista pública de comandos solicitada: ${rows.length} comandos`);

        res.json({
            ok: true,
            data: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        logger.error('[BOT-COMMANDS] Error obteniendo comandos públicos:', error);
        res.status(500).json({
            ok: false,
            message: 'Error al obtener los comandos',
            error: error.message
        });
    }
};

/**
 * 🔍 Obtener un comando específico por ID
 * GET /api/kick-admin/bot-commands/:id
 */
exports.getCommandById = async (req, res) => {
    try {
        const { id } = req.params;

        const command = await KickBotCommand.findByPk(id);

        if (!command) {
            return res.status(404).json({
                ok: false,
                message: 'Comando no encontrado'
            });
        }

        logger.info(`🔍 [BOT-COMMANDS] Comando obtenido: !${command.command}`);

        res.json({
            ok: true,
            data: command
        });
    } catch (error) {
        logger.error('[BOT-COMMANDS] Error obteniendo comando:', error);
        res.status(500).json({
            ok: false,
            message: 'Error al obtener el comando',
            error: error.message
        });
    }
};

/**
 * ➕ Crear un nuevo comando
 * POST /api/kick-admin/bot-commands
 */
exports.createCommand = async (req, res) => {
    try {
        const {
            command,
            aliases = [],
            response_message,
            description,
            command_type = 'simple',
            dynamic_handler,
            enabled = true,
            requires_permission = false,
            permission_level = 'viewer',
            cooldown_seconds = 0,
            auto_send_interval_seconds = 0
        } = req.body;

        // Validaciones
        if (!command || !response_message) {
            return res.status(400).json({
                ok: false,
                message: 'Los campos "command" y "response_message" son obligatorios'
            });
        }

        // Validar que el comando no exista
        const existingCommand = await KickBotCommand.findOne({
            where: { command: command.toLowerCase() }
        });

        if (existingCommand) {
            return res.status(409).json({
                ok: false,
                message: `El comando "!${command}" ya existe`
            });
        }

        // Validar aliases únicos
        if (aliases && aliases.length > 0) {
            const existingAliases = await KickBotCommand.findAll({
                where: {
                    [Op.or]: aliases.map(alias => ({
                        command: alias.toLowerCase()
                    }))
                }
            });

            if (existingAliases.length > 0) {
                return res.status(409).json({
                    ok: false,
                    message: `Uno de los aliases ya existe como comando: ${existingAliases.map(c => c.command).join(', ')}`
                });
            }
        }

        // Crear el comando
        const newCommand = await KickBotCommand.create({
            command: command.toLowerCase(),
            aliases: aliases || [],
            response_message,
            description,
            command_type,
            dynamic_handler: command_type === 'dynamic' ? dynamic_handler : null,
            enabled,
            requires_permission,
            permission_level: requires_permission ? permission_level : 'viewer',
            cooldown_seconds: cooldown_seconds || 0,
            auto_send_interval_seconds: auto_send_interval_seconds || 0,
            usage_count: 0,
            last_used_at: null
        });

        logger.info(`✅ [BOT-COMMANDS] Comando creado: !${newCommand.command}`);

        res.status(201).json({
            ok: true,
            message: 'Comando creado exitosamente',
            data: newCommand
        });
    } catch (error) {
        logger.error('[BOT-COMMANDS] Error creando comando:', error);
        res.status(500).json({
            ok: false,
            message: 'Error al crear el comando',
            error: error.message
        });
    }
};

/**
 * ✏️ Actualizar un comando existente
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
            auto_send_interval_seconds
        } = req.body;

        const existingCommand = await KickBotCommand.findByPk(id);

        if (!existingCommand) {
            return res.status(404).json({
                ok: false,
                message: 'Comando no encontrado'
            });
        }

        // Si se está cambiando el nombre del comando, validar que no exista
        if (command && command.toLowerCase() !== existingCommand.command) {
            const duplicateCommand = await KickBotCommand.findOne({
                where: {
                    command: command.toLowerCase(),
                    id: { [Op.ne]: id }
                }
            });

            if (duplicateCommand) {
                return res.status(409).json({
                    ok: false,
                    message: `El comando "!${command}" ya existe`
                });
            }
        }

        // Actualizar campos
        if (command !== undefined) existingCommand.command = command.toLowerCase();
        if (aliases !== undefined) existingCommand.aliases = aliases;
        if (response_message !== undefined) existingCommand.response_message = response_message;
        if (description !== undefined) existingCommand.description = description;
        if (command_type !== undefined) existingCommand.command_type = command_type;
        if (dynamic_handler !== undefined) existingCommand.dynamic_handler = dynamic_handler;
        if (enabled !== undefined) existingCommand.enabled = enabled;
        if (requires_permission !== undefined) existingCommand.requires_permission = requires_permission;
        if (permission_level !== undefined) existingCommand.permission_level = permission_level;
        if (cooldown_seconds !== undefined) existingCommand.cooldown_seconds = cooldown_seconds;
        if (auto_send_interval_seconds !== undefined) existingCommand.auto_send_interval_seconds = auto_send_interval_seconds;

        await existingCommand.save();

        logger.info(`✏️ [BOT-COMMANDS] Comando actualizado: !${existingCommand.command}`);

        res.json({
            ok: true,
            message: 'Comando actualizado exitosamente',
            data: existingCommand
        });
    } catch (error) {
        logger.error('[BOT-COMMANDS] Error actualizando comando:', error);
        res.status(500).json({
            ok: false,
            message: 'Error al actualizar el comando',
            error: error.message
        });
    }
};

/**
 * 🗑️ Eliminar un comando
 * DELETE /api/kick-admin/bot-commands/:id
 */
exports.deleteCommand = async (req, res) => {
    try {
        const { id } = req.params;

        const command = await KickBotCommand.findByPk(id);

        if (!command) {
            return res.status(404).json({
                ok: false,
                message: 'Comando no encontrado'
            });
        }

        const commandName = command.command;
        await command.destroy();

        logger.info(`🗑️ [BOT-COMMANDS] Comando eliminado: !${commandName}`);

        res.json({
            ok: true,
            message: 'Comando eliminado exitosamente'
        });
    } catch (error) {
        logger.error('[BOT-COMMANDS] Error eliminando comando:', error);
        res.status(500).json({
            ok: false,
            message: 'Error al eliminar el comando',
            error: error.message
        });
    }
};

/**
 * 🔄 Alternar estado (enabled/disabled) de un comando
 * PATCH /api/kick-admin/bot-commands/:id/toggle
 */
exports.toggleCommandStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const command = await KickBotCommand.findByPk(id);

        if (!command) {
            return res.status(404).json({
                ok: false,
                message: 'Comando no encontrado'
            });
        }

        command.enabled = !command.enabled;
        await command.save();

        const status = command.enabled ? 'habilitado' : 'deshabilitado';
        logger.info(`🔄 [BOT-COMMANDS] Comando ${status}: !${command.command}`);

        res.json({
            ok: true,
            message: `Comando ${status} exitosamente`,
            data: command
        });
    } catch (error) {
        logger.error('[BOT-COMMANDS] Error alternando estado del comando:', error);
        res.status(500).json({
            ok: false,
            message: 'Error al cambiar el estado del comando',
            error: error.message
        });
    }
};

/**
 * 📊 Obtener estadísticas de uso de comandos
 * GET /api/kick-admin/bot-commands/stats
 */
exports.getCommandsStats = async (req, res) => {
    try {
        const totalCommands = await KickBotCommand.count();
        const enabledCommands = await KickBotCommand.count({ where: { enabled: true } });
        const disabledCommands = await KickBotCommand.count({ where: { enabled: false } });

        const simpleCommands = await KickBotCommand.count({ where: { command_type: 'simple' } });
        const dynamicCommands = await KickBotCommand.count({ where: { command_type: 'dynamic' } });

        const mostUsedCommands = await KickBotCommand.findAll({
            order: [['usage_count', 'DESC']],
            limit: 10,
            attributes: ['id', 'command', 'usage_count', 'last_used_at']
        });

        const recentlyUsedCommands = await KickBotCommand.findAll({
            where: {
                last_used_at: { [Op.ne]: null }
            },
            order: [['last_used_at', 'DESC']],
            limit: 10,
            attributes: ['id', 'command', 'usage_count', 'last_used_at']
        });

        logger.info('📊 [BOT-COMMANDS] Estadísticas solicitadas');

        res.json({
            ok: true,
            data: {
                summary: {
                    total: totalCommands,
                    enabled: enabledCommands,
                    disabled: disabledCommands,
                    simple: simpleCommands,
                    dynamic: dynamicCommands
                },
                mostUsed: mostUsedCommands,
                recentlyUsed: recentlyUsedCommands
            }
        });
    } catch (error) {
        logger.error('[BOT-COMMANDS] Error obteniendo estadísticas:', error);
        res.status(500).json({
            ok: false,
            message: 'Error al obtener las estadísticas',
            error: error.message
        });
    }
};

/**
 * 🔄 Duplicar un comando existente
 * POST /api/kick-admin/bot-commands/:id/duplicate
 */
exports.duplicateCommand = async (req, res) => {
    try {
        const { id } = req.params;

        const originalCommand = await KickBotCommand.findByPk(id);

        if (!originalCommand) {
            return res.status(404).json({
                ok: false,
                message: 'Comando no encontrado'
            });
        }

        // Generar nuevo nombre único
        let newCommandName = `${originalCommand.command}_copy`;
        let counter = 1;

        while (await KickBotCommand.findOne({ where: { command: newCommandName } })) {
            newCommandName = `${originalCommand.command}_copy${counter}`;
            counter++;
        }

        const duplicatedCommand = await KickBotCommand.create({
            command: newCommandName,
            aliases: [],
            response_message: originalCommand.response_message,
            description: `Copia de: ${originalCommand.description || originalCommand.command}`,
            command_type: originalCommand.command_type,
            dynamic_handler: originalCommand.dynamic_handler,
            enabled: false, // Por defecto deshabilitado
            requires_permission: originalCommand.requires_permission,
            permission_level: originalCommand.permission_level,
            cooldown_seconds: originalCommand.cooldown_seconds,
            auto_send_interval_seconds: 0, // Por defecto no enviar automáticamente
            usage_count: 0,
            last_used_at: null
        });

        logger.info(`🔄 [BOT-COMMANDS] Comando duplicado: !${originalCommand.command} -> !${newCommandName}`);

        res.status(201).json({
            ok: true,
            message: 'Comando duplicado exitosamente',
            data: duplicatedCommand
        });
    } catch (error) {
        logger.error('[BOT-COMMANDS] Error duplicando comando:', error);
        res.status(500).json({
            ok: false,
            message: 'Error al duplicar el comando',
            error: error.message
        });
    }
};

/**
 * 🧪 Probar un comando (sin guardarlo)
 * POST /api/kick-admin/bot-commands/test
 */
exports.testCommand = async (req, res) => {
    try {
        const { response_message, test_username = 'TestUser', test_args = '' } = req.body;

        if (!response_message) {
            return res.status(400).json({
                ok: false,
                message: 'El campo "response_message" es obligatorio'
            });
        }

        // Simular variables
        const processedMessage = response_message
            .replace(/{username}/g, test_username)
            .replace(/{channel}/g, 'luisardito')
            .replace(/{args}/g, test_args)
            .replace(/{target_user}/g, test_username)
            .replace(/{points}/g, '1000');

        logger.info('🧪 [BOT-COMMANDS] Comando de prueba ejecutado');

        res.json({
            ok: true,
            data: {
                original: response_message,
                processed: processedMessage,
                variables_used: {
                    username: test_username,
                    channel: 'luisardito',
                    args: test_args,
                    target_user: test_username,
                    points: '1000'
                }
            }
        });
    } catch (error) {
        logger.error('[BOT-COMMANDS] Error probando comando:', error);
        res.status(500).json({
            ok: false,
            message: 'Error al probar el comando',
            error: error.message
        });
    }
};
