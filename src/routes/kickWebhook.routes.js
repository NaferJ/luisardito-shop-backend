const express = require('express');
const router = express.Router();
const kickWebhookCtrl = require('../controllers/kickWebhook.controller');
const { webhookCors, logWebhookRequest } = require('../middleware/webhook.middleware');

// Aplicar CORS específico para webhooks a todas las rutas
router.use(webhookCors);
router.use(logWebhookRequest);

router.post('/events', kickWebhookCtrl.handleWebhook);
router.get('/events', kickWebhookCtrl.handleWebhook); // Para verificaciones GET

// Endpoints de testing y debug
router.get('/test', kickWebhookCtrl.testWebhook);
router.get('/debug', kickWebhookCtrl.debugWebhook);
router.post('/simulate-chat', kickWebhookCtrl.simulateChat);
router.post('/test-real-webhook', kickWebhookCtrl.testRealWebhook);

// 🧪 NUEVO: Endpoint específico para probar CORS
router.get('/test-cors', kickWebhookCtrl.testCors);
router.post('/test-cors', kickWebhookCtrl.testCors);
router.options('/test-cors', kickWebhookCtrl.testCors);

// 🔍 DIAGNÓSTICO: Verificar problema de tokens
router.get('/diagnostic-tokens', kickWebhookCtrl.diagnosticTokens);
router.get('/diagnostic-tokens-db', kickWebhookCtrl.diagnosticTokensDB);

// 🔧 REPARAR: Reactivar token del broadcaster principal
router.post('/reactivate-broadcaster-token', kickWebhookCtrl.reactivateBroadcasterToken);

// 🔧 DEPURACIÓN: Debug proceso de suscripción
router.get('/debug-subscription-process', kickWebhookCtrl.debugSubscriptionProcess);

// 🔧 DEPURACIÓN: Verificar estructura de tabla
router.get('/debug-table-structure', kickWebhookCtrl.debugTableStructure);

// 🚀 APP TOKEN: Webhooks permanentes
router.post('/setup-permanent-webhooks', kickWebhookCtrl.setupPermanentWebhooks);
router.get('/debug-app-token', kickWebhookCtrl.debugAppTokenWebhooks);
router.get('/compare-token-types', kickWebhookCtrl.compareTokenTypes);

// 📊 ESTADO: Sistema de webhooks
router.get('/status', kickWebhookCtrl.systemStatus);

// 🧪 DEBUG: Nuevas funcionalidades
router.post('/debug-botrix-migration', kickWebhookCtrl.debugBotrixMigration);
router.get('/debug-system-info', kickWebhookCtrl.debugSystemInfo);

// Stream
router.get('/debug-stream-status', kickWebhookCtrl.debugStreamStatus);

module.exports = router;
