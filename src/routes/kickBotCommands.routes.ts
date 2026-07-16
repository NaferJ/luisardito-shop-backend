import express from "express";
import kickBotCommandsController from "../controllers/kickBotCommands.controller";
import authRequired from "../middleware/authRequired.middleware";
import permiso from "../middleware/permisos.middleware";

const router = express.Router();

/**
 * ==========================================
 * RUTAS DE GESTIÓN DE COMANDOS DEL BOT
 * ==========================================
 * Todas las rutas requieren autenticación y permisos de administrador
 */

/**
 * GET /public - Obtener todos los comandos (público, solo lectura)
 * Query params:
 * - page: número de página (default: 1)
 * - limit: límite por página (default: 20)
 * - enabled: filtrar por habilitados/deshabilitados (true/false)
 * - command_type: filtrar por tipo (simple/dynamic)
 * - search: buscar por nombre o descripción
 */
router.get("/public", kickBotCommandsController.getPublicCommands);

// Middleware para todas las rutas (autenticación requerida)
router.use(authRequired);

/**
 * GET /stats - Obtener estadísticas de comandos
 * Debe ir antes de /:id para evitar conflictos
 */
router.get(
  "/stats",
  permiso("editar_puntos"),
  kickBotCommandsController.getCommandsStats
);

/**
 * POST /test - Probar un comando sin guardarlo
 */
router.post(
  "/test",
  permiso("editar_puntos"),
  kickBotCommandsController.testCommand
);

/**
 * GET / - Obtener todos los comandos
 * Query params:
 * - page: número de página (default: 1)
 * - limit: límite por página (default: 20)
 * - enabled: filtrar por habilitados/deshabilitados (true/false)
 * - command_type: filtrar por tipo (simple/dynamic)
 * - search: buscar por nombre o descripción
 */
router.get(
  "/",
  permiso("editar_puntos"),
  kickBotCommandsController.getAllCommands
);

/**
 * GET /:id - Obtener un comando específico
 */
router.get(
  "/:id",
  permiso("editar_puntos"),
  kickBotCommandsController.getCommandById
);

/**
 * POST / - Crear un nuevo comando
 * Body: {
 *   command: string (requerido),
 *   aliases: string[] (opcional),
 *   response_message: string (requerido),
 *   description: string (opcional),
 *   command_type: 'simple' | 'dynamic' (default: 'simple'),
 *   dynamic_handler: string (opcional, requerido si command_type = 'dynamic'),
 *   enabled: boolean (default: true),
 *   requires_permission: boolean (default: false),
 *   permission_level: 'viewer' | 'vip' | 'moderator' | 'broadcaster' (default: 'viewer'),
 *   cooldown_seconds: number (default: 0),
 *   auto_send_interval_seconds: number (default: 0) - Intervalo en segundos para envío automático (0 = no enviar)
 * }
 */
router.post(
  "/",
  permiso("editar_puntos"),
  kickBotCommandsController.createCommand
);

/**
 * PUT /:id - Actualizar un comando existente
 * Body: mismos campos que POST (todos opcionales)
 */
router.put(
  "/:id",
  permiso("editar_puntos"),
  kickBotCommandsController.updateCommand
);

/**
 * PATCH /:id/toggle - Alternar estado enabled/disabled
 */
router.patch(
  "/:id/toggle",
  permiso("editar_puntos"),
  kickBotCommandsController.toggleCommandStatus
);

/**
 * POST /:id/duplicate - Duplicar un comando existente
 */
router.post(
  "/:id/duplicate",
  permiso("editar_puntos"),
  kickBotCommandsController.duplicateCommand
);

/**
 * DELETE /:id - Eliminar un comando
 */
router.delete(
  "/:id",
  permiso("editar_puntos"),
  kickBotCommandsController.deleteCommand
);

export = router;
