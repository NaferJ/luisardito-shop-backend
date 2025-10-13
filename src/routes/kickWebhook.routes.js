const router = require('express').Router();
const kickWebhookCtrl = require('../controllers/kickWebhook.controller');

// Endpoint principal para recibir webhooks de Kick
router.post('/events', kickWebhookCtrl.handleWebhook);

module.exports = router;
