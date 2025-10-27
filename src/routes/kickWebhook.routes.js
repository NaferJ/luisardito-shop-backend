const router = require('express').Router();
const kickWebhookCtrl = require('../controllers/kickWebhook.controller');

// Endpoint principal para recibir webhooks de Kick
router.post('/events', kickWebhookCtrl.handleWebhook);
router.get('/events', kickWebhookCtrl.handleWebhook); // Para verificaciones GET

// Endpoints de testing y debug
router.get('/test', kickWebhookCtrl.testWebhook);
router.get('/debug', kickWebhookCtrl.debugWebhook);
router.post('/simulate-chat', kickWebhookCtrl.simulateChat);

// Endpoint catch-all para cualquier petición
router.all('*', (req, res) => {
    console.log('🚨 [Webhook Catch-All] Petición recibida:');
    console.log('🚨 Method:', req.method);
    console.log('🚨 URL:', req.url);
    console.log('🚨 Headers:', req.headers);
    console.log('🚨 Body:', req.body);

    res.status(200).json({
        message: 'Webhook catch-all endpoint',
        method: req.method,
        url: req.url,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
