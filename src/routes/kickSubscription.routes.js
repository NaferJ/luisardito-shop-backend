const router = require('express').Router();
const kickSubscriptionCtrl = require('../controllers/kickSubscription.controller');

// Endpoints para gestionar suscripciones de eventos de Kick
router.get('/subscriptions', kickSubscriptionCtrl.getSubscriptions);
router.post('/subscriptions', kickSubscriptionCtrl.createSubscriptions);
router.delete('/subscriptions', kickSubscriptionCtrl.deleteSubscriptions);

// Endpoints para consultar suscripciones almacenadas localmente
router.get('/local-subscriptions', kickSubscriptionCtrl.getLocalSubscriptions);

module.exports = router;
