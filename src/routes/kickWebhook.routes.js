const router = require('express').Router();
const kickWebhookCtrl = require('../controllers/kickWebhook.controller');

// Endpoint principal para recibir webhooks de Kick
router.post('/events', kickWebhookCtrl.handleWebhook);

// Endpoints de testing y debug
router.get('/test', kickWebhookCtrl.testWebhook);
router.get('/debug', kickWebhookCtrl.debugWebhook);

module.exports = router;
