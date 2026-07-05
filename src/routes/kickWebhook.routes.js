const express = require('express');
const router = express.Router();
const kickWebhookCtrl = require('../controllers/kickWebhook.controller');
const { webhookCors, logWebhookRequest } = require('../middleware/webhook.middleware');

// Apply webhook-specific CORS to all routes
router.use(webhookCors);
router.use(logWebhookRequest);

router.post('/events', kickWebhookCtrl.handleWebhook);
router.get('/events', kickWebhookCtrl.handleWebhook); // For GET verifications

// Testing and debug endpoints
router.get('/test', kickWebhookCtrl.testWebhook);
router.get('/debug', kickWebhookCtrl.debugWebhook);
router.post('/simulate-chat', kickWebhookCtrl.simulateChat);
router.post('/test-real-webhook', kickWebhookCtrl.testRealWebhook);

// NEW: Specific endpoint to test CORS
router.get('/test-cors', kickWebhookCtrl.testCors);
router.post('/test-cors', kickWebhookCtrl.testCors);
router.options('/test-cors', kickWebhookCtrl.testCors);

// DIAGNOSTIC: Check token issues
router.get('/diagnostic-tokens', kickWebhookCtrl.diagnosticTokens);
router.get('/diagnostic-tokens-db', kickWebhookCtrl.diagnosticTokensDB);

// REPAIR: Reactivate main broadcaster token
router.post('/reactivate-broadcaster-token', kickWebhookCtrl.reactivateBroadcasterToken);

// DEBUG: Debug subscription process
router.get('/debug-subscription-process', kickWebhookCtrl.debugSubscriptionProcess);

// DEBUG: Check table structure
router.get('/debug-table-structure', kickWebhookCtrl.debugTableStructure);

// APP TOKEN: Permanent webhooks
router.post('/setup-permanent-webhooks', kickWebhookCtrl.setupPermanentWebhooks);
router.get('/debug-app-token', kickWebhookCtrl.debugAppTokenWebhooks);
router.get('/compare-token-types', kickWebhookCtrl.compareTokenTypes);

// STATUS: Webhook system
router.get('/status', kickWebhookCtrl.systemStatus);

// DEBUG: New features
router.post('/debug-botrix-migration', kickWebhookCtrl.debugBotrixMigration);
router.get('/debug-system-info', kickWebhookCtrl.debugSystemInfo);

// Stream
router.get('/debug-stream-status', kickWebhookCtrl.debugStreamStatus);
router.post('/debug/force-stream-state', kickWebhookCtrl.forceStreamState);

// PUBLIC ENDPOINT: Points configuration
router.get('/public/points-config', kickWebhookCtrl.getPublicPointsConfig);

module.exports = router;
