// ⚠️ DEPRECADO - Este archivo ya no es necesario
// Los comandos ahora son dinámicos desde la base de datos
// Ver: src/services/kickBotCommandHandler.service.js

/**
 * @deprecated Este script está obsoleto desde la implementación del sistema de comandos dinámicos.
 *
 * ANTES: Los comandos estaban hardcodeados y se simulaban con este script
 * AHORA: Los comandos se gestionan desde la base de datos (tabla: kick_bot_commands)
 *
 * Si necesitas simular actividad del bot, considera:
 * 1. Usar el sistema de comandos dinámicos desde la DB
 * 2. Enviar un mensaje genérico de mantenimiento
 * 3. Configurar BOT_MAINTENANCE_SIMULATE_ACTIVITY=false en .env
 *
 * Documentación completa en:
 * - BOT-COMMANDS-SYSTEM.md
 * - INICIO-RAPIDO-COMANDOS.md
 *
 * Fecha de deprecación: 2025-11-25
 */

console.warn("⚠️  [DEPRECATED] simulate-tienda-command.js está obsoleto");
console.warn(
  "ℹ️  Los comandos ahora se gestionan dinámicamente desde la base de datos",
);
console.warn("📖 Ver documentación en: BOT-COMMANDS-SYSTEM.md");

process.exit(0);
