const express = require("express");
const router = express.Router();
const kickWebhookCtrl = require("../controllers/kickWebhook.controller");
const kickWebhookDebugCtrl = require("../controllers/kickWebhookDebug.controller");
const {
  webhookCors,
  logWebhookRequest,
} = require("../middleware/webhook.middleware");

// Apply webhook-specific CORS to all routes
router.use(webhookCors);
router.use(logWebhookRequest);

router.post("/events", kickWebhookCtrl.handleWebhook);
router.get("/events", kickWebhookCtrl.handleWebhook); // For GET verifications

// Testing and debug endpoints
router.get("/test", kickWebhookDebugCtrl.testWebhook);
router.get("/debug", kickWebhookDebugCtrl.debugWebhook);
router.post("/simulate-chat", kickWebhookDebugCtrl.simulateChat);
router.post("/test-real-webhook", kickWebhookDebugCtrl.testRealWebhook);

// NEW: Specific endpoint to test CORS
router.get("/test-cors", kickWebhookDebugCtrl.testCors);
router.post("/test-cors", kickWebhookDebugCtrl.testCors);
router.options("/test-cors", kickWebhookDebugCtrl.testCors);

// DIAGNOSTIC: Check token issues
router.get("/diagnostic-tokens", kickWebhookDebugCtrl.diagnosticTokens);
router.get("/diagnostic-tokens-db", kickWebhookDebugCtrl.diagnosticTokensDB);

// REPAIR: Reactivate main broadcaster token
router.post(
  "/reactivate-broadcaster-token",
  kickWebhookDebugCtrl.reactivateBroadcasterToken
);

// DEBUG: Debug subscription process
router.get(
  "/debug-subscription-process",
  kickWebhookDebugCtrl.debugSubscriptionProcess
);

// DEBUG: Check table structure
router.get("/debug-table-structure", kickWebhookDebugCtrl.debugTableStructure);

// APP TOKEN: Permanent webhooks
router.post(
  "/setup-permanent-webhooks",
  kickWebhookDebugCtrl.setupPermanentWebhooks
);
router.get("/debug-app-token", kickWebhookDebugCtrl.debugAppTokenWebhooks);
router.get("/compare-token-types", kickWebhookDebugCtrl.compareTokenTypes);

// STATUS: Webhook system
router.get("/status", kickWebhookDebugCtrl.systemStatus);

// DEBUG: New features
router.post(
  "/debug-botrix-migration",
  kickWebhookDebugCtrl.debugBotrixMigration
);
router.get("/debug-system-info", kickWebhookDebugCtrl.debugSystemInfo);

// Stream
router.get("/debug-stream-status", kickWebhookDebugCtrl.debugStreamStatus);
router.post("/debug/force-stream-state", kickWebhookDebugCtrl.forceStreamState);

// PUBLIC ENDPOINT: Points configuration
router.get("/public/points-config", kickWebhookDebugCtrl.getPublicPointsConfig);

module.exports = router;
