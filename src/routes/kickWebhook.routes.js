const express = require('express');
const router = express.Router();
const kickWebhookCtrl = require('../controllers/kickWebhook.controller');

router.post('/events', kickWebhookCtrl.handleWebhook);
router.get('/events', kickWebhookCtrl.handleWebhook); // Para verificaciones GET

// Endpoints de testing y debug
router.get('/test', kickWebhookCtrl.testWebhook);
router.get('/debug', kickWebhookCtrl.debugWebhook);
router.post('/simulate-chat', kickWebhookCtrl.simulateChat);

module.exports = router;
