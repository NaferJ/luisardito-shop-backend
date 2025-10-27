const router = require('express').Router();
const kickSubscriptionCtrl = require('../controllers/kickSubscription.controller');
const auth = require('../middleware/auth.middleware');
const permiso = require('../middleware/permisos.middleware');

// Endpoints para gestionar suscripciones de eventos de Kick (protegidos para admins)
router.get('/subscriptions', auth, permiso('ver_usuarios'), kickSubscriptionCtrl.getSubscriptions);
router.post('/subscriptions', auth, permiso('gestionar_usuarios'), kickSubscriptionCtrl.createSubscriptions);
router.delete('/subscriptions', auth, permiso('gestionar_usuarios'), kickSubscriptionCtrl.deleteSubscriptions);

// Endpoints para consultar suscripciones almacenadas localmente (protegido para admins)
router.get('/local-subscriptions', auth, permiso('ver_usuarios'), kickSubscriptionCtrl.getLocalSubscriptions);

module.exports = router;
