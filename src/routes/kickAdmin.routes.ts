import express from "express";
import type { Request, Response } from "express";
import kickAdminController from "../controllers/kickAdmin.controller";
import authRequired from "../middleware/authRequired.middleware";
import checkPermission from "../middleware/permisos.middleware";
import botMaintenanceService from "../services/botMaintenance.service";

const router = express.Router();

// Strict authentication middleware for all admin routes
router.use(authRequired);

// ============================================================================
// CONFIGURATION ROUTES
// ============================================================================

/**
 * GET /api/kick-admin/config
 * Get current migration and VIP configuration
 */
router.get(
  "/config",
  checkPermission("gestionar_usuarios"),
  kickAdminController.getConfig
);

/**
 * PUT /api/kick-admin/migration
 * Enable/disable Botrix migration
 */
router.put(
  "/migration",
  checkPermission("gestionar_usuarios"),
  kickAdminController.updateMigrationConfig
);

/**
 * PUT /api/kick-admin/vip-config
 * Update VIP points configuration
 */
router.put(
  "/vip-config",
  checkPermission("gestionar_usuarios"),
  kickAdminController.updateVipConfig
);

/**
 * PUT /api/kick-admin/watchtime-migration
 * Enable/disable Botrix watchtime migration
 */
router.put(
  "/watchtime-migration",
  checkPermission("gestionar_usuarios"),
  kickAdminController.updateWatchtimeMigrationConfig
);

// ============================================================================
// VIP MANAGEMENT ROUTES
// ============================================================================

/**
 * POST /api/kick-admin/canje/:canjeId/grant-vip
 * Grant VIP from a delivered canje
 */
router.post(
  "/canje/:canjeId/grant-vip",
  checkPermission("gestionar_canjes"),
  kickAdminController.grantVipFromCanje
);

/**
 * POST /api/kick-admin/usuario/:usuarioId/vip
 * Grant VIP manually to a user
 */
router.post(
  "/usuario/:usuarioId/vip",
  checkPermission("gestionar_usuarios"),
  kickAdminController.grantVipManually
);

/**
 * DELETE /api/kick-admin/usuario/:usuarioId/vip
 * Remove VIP from a user
 */
router.delete(
  "/usuario/:usuarioId/vip",
  checkPermission("gestionar_usuarios"),
  kickAdminController.removeVip
);

/**
 * POST /api/kick-admin/cleanup-expired-vips
 * Clean up expired VIPs
 */
router.post(
  "/cleanup-expired-vips",
  checkPermission("gestionar_usuarios"),
  kickAdminController.cleanupExpiredVips
);

// ============================================================================
// QUERY ROUTES
// ============================================================================

/**
 * GET /api/kick-admin/users
 * Get list of users with VIP and migration details
 * Query params: page, limit, filter (all|vip|migrated|pending_migration)
 */
router.get(
  "/users",
  checkPermission("ver_usuarios"),
  kickAdminController.getUsersWithDetails
);

// ============================================================================
// TESTING/DEVELOPMENT ROUTES
// ============================================================================

/**
 * POST /api/kick-admin/manual-migration
 * Manual points migration (testing only)
 */
router.post(
  "/manual-migration",
  checkPermission("gestionar_usuarios"),
  kickAdminController.manualBotrixMigration
);

// ============================================================================
// AUTOMATIC BOT MAINTENANCE ROUTES
// ============================================================================

/**
 * GET /api/kick-admin/bot-maintenance/status
 * Get status of the automatic bot maintenance service
 */
router.get(
  "/bot-maintenance/status",
  checkPermission("gestionar_usuarios"),
  (_req: Request, res: Response) => {
    const stats = botMaintenanceService.getStats();

    res.json({
      success: true,
      service: {
        name: "Bot Maintenance Service",
        isRunning: stats.isRunning,
        intervalMinutes: stats.intervalMinutes,
        nextExecution: stats.nextExecution,
      },
    });
  }
);

/**
 * POST /api/kick-admin/bot-maintenance/start
 * Start the automatic bot maintenance service
 */
router.post(
  "/bot-maintenance/start",
  checkPermission("gestionar_usuarios"),
  (_req: Request, res: Response) => {
    if (botMaintenanceService.isRunning) {
      res.json({
        success: false,
        message: "The maintenance service is already running",
      });
      return;
    }

    botMaintenanceService.start();

    res.json({
      success: true,
      message: "Bot maintenance service started",
      intervalMinutes: botMaintenanceService.intervalMinutes,
    });
  }
);

/**
 * POST /api/kick-admin/bot-maintenance/stop
 * Stop the automatic bot maintenance service
 */
router.post(
  "/bot-maintenance/stop",
  checkPermission("gestionar_usuarios"),
  (_req: Request, res: Response) => {
    if (!botMaintenanceService.isRunning) {
      res.json({
        success: false,
        message: "The maintenance service is not running",
      });
      return;
    }

    botMaintenanceService.stop();

    res.json({
      success: true,
      message: "Bot maintenance service stopped",
    });
  }
);

/**
 * POST /api/kick-admin/bot-maintenance/trigger
 * Run maintenance manually (for testing)
 */
router.post(
  "/bot-maintenance/trigger",
  checkPermission("gestionar_usuarios"),
  async (_req: Request, res: Response) => {
    try {
      await botMaintenanceService.performMaintenance();
      res.json({
        success: true,
        message: "Maintenance executed manually",
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        success: false,
        error: msg,
      });
    }
  }
);

// ============================================================================
// BOT TOKEN MANAGEMENT ROUTES
// ============================================================================

/**
 * GET /api/kick-admin/bot-tokens
 * Get status of all bot tokens
 */
router.get(
  "/bot-tokens",
  checkPermission("gestionar_usuarios"),
  kickAdminController.getBotTokensStatus
);

/**
 * POST /api/kick-admin/bot-tokens/cleanup
 * Clean up expired bot tokens
 */
router.post(
  "/bot-tokens/cleanup",
  checkPermission("gestionar_usuarios"),
  kickAdminController.cleanupExpiredBotTokens
);

/**
 * POST /api/kick-admin/bot-tokens/:tokenId/refresh
 * Manually refresh a specific bot token
 */
router.post(
  "/bot-tokens/:tokenId/refresh",
  checkPermission("gestionar_usuarios"),
  kickAdminController.refreshBotToken
);

/**
 * DELETE /api/kick-admin/bot-tokens/:tokenId
 * Deactivate a specific bot token
 */
router.delete(
  "/bot-tokens/:tokenId",
  checkPermission("gestionar_usuarios"),
  kickAdminController.deactivateBotToken
);

/**
 * POST /api/kick-admin/bot-test-message
 * Test sending a message with the bot
 */
router.post(
  "/bot-test-message",
  checkPermission("gestionar_usuarios"),
  kickAdminController.testBotMessage
);

export = router;
