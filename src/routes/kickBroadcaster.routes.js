const router = require('express').Router();
const kickBroadcasterCtrl = require('../controllers/kickBroadcaster.controller');
const authRequired = require('../middleware/authRequired.middleware');
const permiso = require('../middleware/permisos.middleware');

// ✅ Rutas protegidas - Todas requieren autenticación estricta + permisos

// Endpoints para gestionar conexión del broadcaster (protegidos para admins)
router.get('/broadcaster/status', authRequired, permiso('ver_usuarios'), kickBroadcasterCtrl.getConnectionStatus);
router.post('/broadcaster/disconnect', authRequired, permiso('gestionar_usuarios'), kickBroadcasterCtrl.disconnect);
router.get('/broadcaster/token', authRequired, permiso('gestionar_usuarios'), kickBroadcasterCtrl.getActiveToken);

// Endpoints para refresh de tokens (protegidos para admins)
router.post('/broadcaster/refresh-token', authRequired, permiso('gestionar_usuarios'), kickBroadcasterCtrl.refreshToken);
router.get('/broadcaster/refresh-service/status', authRequired, permiso('ver_usuarios'), kickBroadcasterCtrl.getRefreshServiceStatus);

// Debug endpoint (solo para desarrolladores/admins con permisos completos)
router.get('/broadcaster/debug', authRequired, permiso('editar_puntos'), kickBroadcasterCtrl.debugConfig);

module.exports = router;
