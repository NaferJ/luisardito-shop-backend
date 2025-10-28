const express = require('express');
const router = express.Router();
const kickAdminController = require('../controllers/kickAdmin.controller');
const authMiddleware = require('../middleware/auth.middleware');
const checkPermission = require('../middleware/permisos.middleware');

// Middleware de autenticación para todas las rutas
router.use(authMiddleware);

// ============================================================================
// RUTAS DE CONFIGURACIÓN
// ============================================================================

/**
 * GET /api/kick-admin/config
 * Obtener configuración actual de migración y VIP
 */
router.get('/config',
    checkPermission('gestionar_usuarios'),
    kickAdminController.getConfig
);

/**
 * PUT /api/kick-admin/migration
 * Activar/desactivar migración de Botrix
 */
router.put('/migration',
    checkPermission('gestionar_usuarios'),
    kickAdminController.updateMigrationConfig
);

/**
 * PUT /api/kick-admin/vip-config
 * Actualizar configuración de puntos VIP
 */
router.put('/vip-config',
    checkPermission('gestionar_usuarios'),
    kickAdminController.updateVipConfig
);

// ============================================================================
// RUTAS DE GESTIÓN VIP
// ============================================================================

/**
 * POST /api/kick-admin/canje/:canjeId/grant-vip
 * Otorgar VIP desde un canje entregado
 */
router.post('/canje/:canjeId/grant-vip',
    checkPermission('gestionar_canjes'),
    kickAdminController.grantVipFromCanje
);

/**
 * POST /api/kick-admin/usuario/:usuarioId/vip
 * Otorgar VIP manualmente a un usuario
 */
router.post('/usuario/:usuarioId/vip',
    checkPermission('gestionar_usuarios'),
    kickAdminController.grantVipManually
);

/**
 * DELETE /api/kick-admin/usuario/:usuarioId/vip
 * Remover VIP de un usuario
 */
router.delete('/usuario/:usuarioId/vip',
    checkPermission('gestionar_usuarios'),
    kickAdminController.removeVip
);

/**
 * POST /api/kick-admin/cleanup-expired-vips
 * Limpiar VIPs expirados
 */
router.post('/cleanup-expired-vips',
    checkPermission('gestionar_usuarios'),
    kickAdminController.cleanupExpiredVips
);

// ============================================================================
// RUTAS DE CONSULTA
// ============================================================================

/**
 * GET /api/kick-admin/users
 * Obtener lista de usuarios con detalles VIP y migración
 * Query params: page, limit, filter (all|vip|migrated|pending_migration)
 */
router.get('/users',
    checkPermission('ver_usuarios'),
    kickAdminController.getUsersWithDetails
);

// ============================================================================
// RUTAS DE TESTING/DESARROLLO
// ============================================================================

/**
 * POST /api/kick-admin/manual-migration
 * Migración manual de puntos (solo para testing)
 */
router.post('/manual-migration',
    checkPermission('gestionar_usuarios'),
    kickAdminController.manualBotrixMigration
);

module.exports = router;
