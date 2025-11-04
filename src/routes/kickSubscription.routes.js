const router = require('express').Router();
const kickSubscriptionCtrl = require('../controllers/kickSubscription.controller');
const authRequired = require('../middleware/authRequired.middleware');
const permiso = require('../middleware/permisos.middleware');

// ✅ Rutas protegidas - Todas requieren autenticación estricta + permisos

// Endpoints para gestionar suscripciones de eventos de Kick (protegidos para admins)
router.get('/subscriptions', authRequired, permiso('ver_usuarios'), kickSubscriptionCtrl.getSubscriptions);
router.post('/subscriptions', authRequired, permiso('gestionar_usuarios'), kickSubscriptionCtrl.createSubscriptions);
router.delete('/subscriptions', authRequired, permiso('gestionar_usuarios'), kickSubscriptionCtrl.deleteSubscriptions);

// Endpoints para consultar suscripciones almacenadas localmente (protegido para admins)
router.get('/local-subscriptions', authRequired, permiso('ver_usuarios'), kickSubscriptionCtrl.getLocalSubscriptions);

module.exports = router;
