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

module.exports = router;
