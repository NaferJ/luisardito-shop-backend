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

// Stream
router.get("/debug-stream-status", kickWebhookDebugCtrl.debugStreamStatus);
router.post("/debug/force-stream-state", kickWebhookDebugCtrl.forceStreamState);

// PUBLIC ENDPOINT: Points configuration
router.get("/public/points-config", kickWebhookDebugCtrl.getPublicPointsConfig);

module.exports = router;
