const express = require('express');
const router = express.Router();
const kickAdminController = require('../controllers/kickAdmin.controller');
const authRequired = require('../middleware/authRequired.middleware');
const checkPermission = require('../middleware/permisos.middleware');

// ✅ Middleware de autenticación ESTRICTA para todas las rutas de admin
router.use(authRequired);

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

// ============================================================================
// RUTAS DE MANTENIMIENTO AUTOMÁTICO DEL BOT
// ============================================================================

/**
 * GET /api/kick-admin/bot-maintenance/status
 * Obtener estado del servicio de mantenimiento automático del bot
 */
router.get('/bot-maintenance/status',
    checkPermission('gestionar_usuarios'),
    (req, res) => {
        const botMaintenanceService = require('../services/botMaintenance.service');
        const stats = botMaintenanceService.getStats();

        res.json({
            success: true,
            service: {
                name: 'Bot Maintenance Service',
                isRunning: stats.isRunning,
                intervalMinutes: stats.intervalMinutes,
                nextExecution: stats.nextExecution
            }
        });
    }
);

/**
 * POST /api/kick-admin/bot-maintenance/start
 * Iniciar el servicio de mantenimiento automático del bot
 */
router.post('/bot-maintenance/start',
    checkPermission('gestionar_usuarios'),
    (req, res) => {
        const botMaintenanceService = require('../services/botMaintenance.service');

        if (botMaintenanceService.isRunning) {
            return res.json({
                success: false,
                message: 'El servicio de mantenimiento ya está ejecutándose'
            });
        }

        botMaintenanceService.start();

        res.json({
            success: true,
            message: 'Servicio de mantenimiento del bot iniciado',
            intervalMinutes: botMaintenanceService.intervalMinutes
        });
    }
);

/**
 * POST /api/kick-admin/bot-maintenance/stop
 * Detener el servicio de mantenimiento automático del bot
 */
router.post('/bot-maintenance/stop',
    checkPermission('gestionar_usuarios'),
    (req, res) => {
        const botMaintenanceService = require('../services/botMaintenance.service');

        if (!botMaintenanceService.isRunning) {
            return res.json({
                success: false,
                message: 'El servicio de mantenimiento no está ejecutándose'
            });
        }

        botMaintenanceService.stop();

        res.json({
            success: true,
            message: 'Servicio de mantenimiento del bot detenido'
        });
    }
);

/**
 * POST /api/kick-admin/bot-maintenance/trigger
 * Ejecutar mantenimiento manualmente (para testing)
 */
router.post('/bot-maintenance/trigger',
    checkPermission('gestionar_usuarios'),
    async (req, res) => {
        const botMaintenanceService = require('../services/botMaintenance.service');

        try {
            await botMaintenanceService.performMaintenance();
            res.json({
                success: true,
                message: 'Mantenimiento ejecutado manualmente'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

// ============================================================================
// RUTAS DE GESTIÓN DE TOKENS DEL BOT
// ============================================================================

/**
 * GET /api/kick-admin/bot-tokens
 * Obtener estado de todos los tokens del bot
 */
router.get('/bot-tokens',
    checkPermission('gestionar_usuarios'),
    kickAdminController.getBotTokensStatus
);

/**
 * POST /api/kick-admin/bot-tokens/cleanup
 * Limpiar tokens expirados del bot
 */
router.post('/bot-tokens/cleanup',
    checkPermission('gestionar_usuarios'),
    kickAdminController.cleanupExpiredBotTokens
);

/**
 * POST /api/kick-admin/bot-tokens/:tokenId/refresh
 * Renovar un token específico del bot manualmente
 */
router.post('/bot-tokens/:tokenId/refresh',
    checkPermission('gestionar_usuarios'),
    kickAdminController.refreshBotToken
);

/**
 * DELETE /api/kick-admin/bot-tokens/:tokenId
 * Desactivar un token específico del bot
 */
router.delete('/bot-tokens/:tokenId',
    checkPermission('gestionar_usuarios'),
    kickAdminController.deactivateBotToken
);

/**
 * POST /api/kick-admin/bot-test-message
 * Probar envío de mensaje con el bot
 */
router.post('/bot-test-message',
    checkPermission('gestionar_usuarios'),
    kickAdminController.testBotMessage
);

module.exports = router;
