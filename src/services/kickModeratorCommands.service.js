const { KickBotCommand } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * ==========================================
 * 🛡️ SISTEMA DE COMANDOS PARA MODERADORES
 * ==========================================
 *
 * Permite a los moderadores gestionar comandos del bot directamente desde el chat de Kick
 * sin necesidad de acceder a la interfaz administrativa.
 *
 * Comandos disponibles:
 * - !addcmd <nombre> <respuesta> [--aliases alias1,alias2] [--cooldown 3] [--desc "descripción"]
 * - !editcmd <nombre> [--response "nueva respuesta"] [--aliases alias1,alias2] [--cooldown 5] [--desc "nueva desc"]
 * - !delcmd <nombre>
 * - !cmdinfo <nombre>
 */

// Lista de comandos protegidos que NO pueden ser eliminados
const PROTECTED_COMMANDS = [
  'comandos',
  'puntos',
  'top',
  'tienda',
  'shop',
  'leaderboard',
  'rank',
  'ranking'
];

/**
 * Verifica si el usuario tiene permisos de moderador o broadcaster
 * @param {object} sender - Objeto sender del webhook de Kick
 * @param {object} broadcaster - Objeto broadcaster del webhook de Kick
 * @returns {boolean}
 */
function isModerator(sender, broadcaster) {
  // El broadcaster siempre tiene permisos
  if (sender.user_id === broadcaster.user_id) {
    return true;
  }

  // Verificar si tiene badge de moderador
  const badges = sender.identity?.badges || [];
  return badges.some(badge =>
    badge.type === 'moderator' || badge.type === 'broadcaster'
  );
}

/**
 * Parsea un mensaje de comando de moderador y extrae los parámetros
 * @param {string} content - Contenido del mensaje completo
 * @returns {object|null} - { command, name, flags } o null si no es un comando válido
 */
function parseModeratorCommand(content) {
  const trimmed = content.trim();
  const parts = trimmed.split(/\s+/);

  const command = parts[0]?.toLowerCase();

  // Verificar si es un comando de moderador válido
  const validCommands = ['!addcmd', '!editcmd', '!delcmd', '!cmdinfo'];
  if (!validCommands.includes(command)) {
    return null;
  }

  const name = parts[1]?.toLowerCase().replace(/^!/, '');

  if (!name) {
    return { command, name: null, flags: {}, error: 'Debes especificar el nombre del comando' };
  }

  const flags = {};
  const responseWords = [];

  let i = 2;
  while (i < parts.length) {
    const part = parts[i];

    if (part.startsWith('--')) {
      const flagName = part.substring(2);
      i++;

      // Manejar valores entre comillas
      let flagValue = '';
      if (i < parts.length) {
        if (parts[i].startsWith('"')) {
          // Valor entre comillas
          const quotedParts = [];
          while (i < parts.length) {
            quotedParts.push(parts[i]);
            if (parts[i].endsWith('"')) {
              i++;
              break;
            }
            i++;
          }
          flagValue = quotedParts.join(' ').replace(/^"|"$/g, '');
        } else {
          // Valor simple
          flagValue = parts[i];
          i++;
        }
      }

      if (flagName === 'aliases') {
        flags.aliases = flagValue.split(',').map(a => a.trim().toLowerCase().replace(/^!/, '')).filter(a => a);
      } else if (flagName === 'cooldown') {
        flags.cooldown = parseInt(flagValue) || 3;
      } else if (flagName === 'desc') {
        flags.desc = flagValue;
      } else if (flagName === 'response') {
        flags.response = flagValue;
      }
    } else {
      // Parte de la respuesta
      responseWords.push(part);
      i++;
    }
  }

  // Si hay palabras de respuesta sueltas (sin --response), asignarlas como respuesta
  if (responseWords.length > 0 && !flags.response) {
    flags.response = responseWords.join(' ');
  }

  return { command, name, flags };
}

/**
 * Procesa un comando de moderador y ejecuta la acción correspondiente
 * @param {object} payload - Payload completo del webhook de Kick (chat.message.sent)
 * @returns {object} - { success, message, processed }
 */
async function processModeratorCommand(payload) {
  try {
    const { content, sender, broadcaster } = payload;

    // Verificar permisos
    if (!isModerator(sender, broadcaster)) {
      return {
        success: false,
        processed: false,
        message: null // No responder para no hacer spam
      };
    }

    // Parsear comando
    const parsed = parseModeratorCommand(content);

    if (!parsed) {
      return { success: false, processed: false, message: null };
    }

    if (parsed.error) {
      return {
        success: false,
        processed: true,
        message: `❌ Error: ${parsed.error}`
      };
    }

    const { command, name, flags } = parsed;

    logger.info(`🛡️ [MOD-CMD] ${sender.username} ejecutó: ${command} ${name}`);

    // Ejecutar comando según el tipo
    switch (command) {
      case '!addcmd':
        return await handleAddCommand(name, flags, sender);

      case '!editcmd':
        return await handleEditCommand(name, flags, sender);

      case '!delcmd':
        return await handleDeleteCommand(name, sender, broadcaster);

      case '!cmdinfo':
        return await handleCommandInfo(name);

      default:
        return { success: false, processed: false, message: null };
    }

  } catch (error) {
    logger.error('[MOD-CMD] Error procesando comando de moderador:', error);
    return {
      success: false,
      processed: true,
      message: '❌ Error interno procesando el comando'
    };
  }
}

/**
 * Maneja el comando !addcmd
 */
async function handleAddCommand(name, flags, sender) {
  try {
    // Validar que tenga respuesta
    if (!flags.response) {
      return {
        success: false,
        processed: true,
        message: `❌ Debes especificar una respuesta para el comando. Ejemplo: !addcmd ${name} Hola {username}`
      };
    }

    // Verificar que el comando no exista
    const existing = await KickBotCommand.findOne({
      where: { command: name }
    });

    if (existing) {
      return {
        success: false,
        processed: true,
        message: `❌ El comando "!${name}" ya existe. Usa !editcmd para modificarlo.`
      };
    }

    // Validar que los aliases no existan como comandos
    if (flags.aliases && flags.aliases.length > 0) {
      const existingAliases = await KickBotCommand.findAll({
        where: {
          [Op.or]: flags.aliases.map(alias => ({ command: alias }))
        }
      });

      if (existingAliases.length > 0) {
        const conflictingNames = existingAliases.map(c => c.command).join(', ');
        return {
          success: false,
          processed: true,
          message: `❌ Los siguientes aliases ya existen como comandos: ${conflictingNames}`
        };
      }
    }

    // Crear el comando
    const newCommand = await KickBotCommand.create({
      command: name,
      aliases: flags.aliases || [],
      response_message: flags.response,
      description: flags.desc || `Comando creado por @${sender.username}`,
      command_type: 'simple',
      enabled: true,
      requires_permission: false,
      permission_level: 'viewer',
      cooldown_seconds: flags.cooldown || 3,
      auto_send_interval_seconds: 0,
      usage_count: 0
    });

    logger.info(`✅ [MOD-CMD] Comando !${name} creado por ${sender.username}`);

    // Construir mensaje de confirmación
    let confirmMsg = `✅ Comando "!${name}" creado exitosamente`;
    if (flags.aliases && flags.aliases.length > 0) {
      confirmMsg += ` (Aliases: ${flags.aliases.join(', ')})`;
    }

    return {
      success: true,
      processed: true,
      message: confirmMsg,
      data: newCommand
    };

  } catch (error) {
    logger.error('[MOD-CMD] Error en handleAddCommand:', error);
    return {
      success: false,
      processed: true,
      message: '❌ Error creando el comando'
    };
  }
}

/**
 * Maneja el comando !editcmd
 */
async function handleEditCommand(name, flags, sender) {
  try {
    // Buscar el comando
    const command = await KickBotCommand.findOne({
      where: { command: name }
    });

    if (!command) {
      return {
        success: false,
        processed: true,
        message: `❌ El comando "!${name}" no existe. Usa !addcmd para crearlo.`
      };
    }

    // Validar que al menos se envíe un campo para actualizar
    if (!flags.response && !flags.aliases && !flags.cooldown && !flags.desc) {
      return {
        success: false,
        processed: true,
        message: `❌ Debes especificar al menos un campo para actualizar. Ejemplo: !editcmd ${name} --response Nueva respuesta`
      };
    }

    // Actualizar solo los campos especificados
    const updates = {};
    const changes = [];

    if (flags.response) {
      updates.response_message = flags.response;
      changes.push('respuesta');
    }

    if (flags.aliases) {
      updates.aliases = flags.aliases;
      changes.push(`aliases (${flags.aliases.join(', ')})`);
    }

    if (flags.cooldown !== undefined) {
      updates.cooldown_seconds = flags.cooldown;
      changes.push(`cooldown (${flags.cooldown}s)`);
    }

    if (flags.desc) {
      updates.description = flags.desc;
      changes.push('descripción');
    }

    // Actualizar
    await command.update(updates);

    logger.info(`✅ [MOD-CMD] Comando !${name} editado por ${sender.username}: ${changes.join(', ')}`);

    return {
      success: true,
      processed: true,
      message: `✅ Comando "!${name}" actualizado: ${changes.join(', ')}`,
      data: command
    };

  } catch (error) {
    logger.error('[MOD-CMD] Error en handleEditCommand:', error);
    return {
      success: false,
      processed: true,
      message: '❌ Error editando el comando'
    };
  }
}

/**
 * Maneja el comando !delcmd
 */
async function handleDeleteCommand(name, sender, broadcaster) {
  try {
    // Verificar si el comando está protegido
    if (PROTECTED_COMMANDS.includes(name)) {
      return {
        success: false,
        processed: true,
        message: `🔒 El comando "!${name}" está protegido y no puede ser eliminado`
      };
    }

    // Solo el broadcaster puede eliminar comandos
    if (sender.user_id !== broadcaster.user_id) {
      return {
        success: false,
        processed: true,
        message: `❌ Solo @${broadcaster.username} puede eliminar comandos`
      };
    }

    // Buscar el comando
    const command = await KickBotCommand.findOne({
      where: { command: name }
    });

    if (!command) {
      return {
        success: false,
        processed: true,
        message: `❌ El comando "!${name}" no existe`
      };
    }

    // Eliminar
    await command.destroy();

    logger.info(`✅ [MOD-CMD] Comando !${name} eliminado por ${sender.username}`);

    return {
      success: true,
      processed: true,
      message: `✅ Comando "!${name}" eliminado exitosamente`
    };

  } catch (error) {
    logger.error('[MOD-CMD] Error en handleDeleteCommand:', error);
    return {
      success: false,
      processed: true,
      message: '❌ Error eliminando el comando'
    };
  }
}

/**
 * Maneja el comando !cmdinfo
 */
async function handleCommandInfo(name) {
  try {
    // Buscar el comando
    const command = await KickBotCommand.findOne({
      where: { command: name }
    });

    if (!command) {
      return {
        success: false,
        processed: true,
        message: `❌ El comando "!${name}" no existe`
      };
    }

    // Construir mensaje informativo
    const aliases = command.aliases && command.aliases.length > 0
      ? command.aliases.join(', ')
      : 'ninguno';

    const estado = command.enabled ? 'Activo ✅' : 'Desactivado ❌';

    const message = `📋 Información del comando "!${name}" | ` +
      `Respuesta: "${command.response_message.substring(0, 50)}${command.response_message.length > 50 ? '...' : ''}" | ` +
      `Aliases: ${aliases} | ` +
      `Cooldown: ${command.cooldown_seconds}s | ` +
      `Estado: ${estado} | ` +
      `Usos: ${command.usage_count}`;

    return {
      success: true,
      processed: true,
      message,
      data: command
    };

  } catch (error) {
    logger.error('[MOD-CMD] Error en handleCommandInfo:', error);
    return {
      success: false,
      processed: true,
      message: '❌ Error obteniendo información del comando'
    };
  }
}

module.exports = {
  processModeratorCommand,
  isModerator,
  parseModeratorCommand
};

